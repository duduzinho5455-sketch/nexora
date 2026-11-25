#!/usr/bin/env node
/**
 * Auryx Nexos — restaurar um backup
 *
 *   node scripts/restaurar-backup.js <arquivo .json.gz ou .axb>              (só confere e mostra o resumo)
 *   node scripts/restaurar-backup.js <arquivo> --confirmar                   (restaura de verdade)
 *
 * Variáveis de ambiente:
 *   DATABASE_URL  banco PostgreSQL de destino (o mesmo do Render, ou um banco novo)
 *                 sem DATABASE_URL: restaura no arquivo local data/nexora.json (ou DATA_DIR)
 *   BACKUP_KEY    a senha dos backups, se o arquivo estiver criptografado (.axb)
 *
 * Segurança:
 *   - antes de mexer, salva uma cópia do que está no banco agora (seguranca-antes-de-restaurar-*.json.gz/.axb);
 *   - tudo vai numa transação só: se algo falhar no meio, o banco fica como estava;
 *   - recusa rodar com o servidor ligado (ele gravaria por cima). No Render: suspenda o serviço antes
 *     (Settings › Suspend), restaure e depois retome. Para forçar mesmo assim: --forcar.
 *   - imagens e vídeos enviados (tabela nexora_files) não estão no backup e não são tocados.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const BK = require("../backup");

const MSG_MIG = "2026-11-msgs-table";      // igual ao server.js: o servidor passa a ler as mensagens da tabela
const MSG_STATE_KEEP = 50;
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const CONFIRM = args.includes("--confirmar"), FORCE = args.includes("--forcar");
const key = BK.keyOf(process.env.BACKUP_KEY || "");
const say = (...a) => console.log(...a);
const fail = msg => { console.error("\n  ERRO: " + msg + "\n"); process.exit(1); };

function summary(j) {
  const d = j.db, msgs = d.messages || {};
  let total = 0, chans = 0;
  for (const l of Object.values(msgs)) if (Array.isArray(l) && l.length) { chans++; total += l.length; }
  return {
    feito: j.at ? new Date(j.at).toLocaleString("pt-BR") : "?", versao: j.version || 1,
    contas: Object.keys(d.users || {}).length, servidores: Object.keys(d.servers || {}).length,
    conversas: chans, mensagens: total, pedidos: Object.keys(d.orders || {}).length, sessoes: Object.keys(d.sessions || {}).length
  };
}
// mensagens únicas por canal (o mesmo id duas vezes quebraria o INSERT)
function msgRows(messages) {
  const map = new Map();
  for (const [c, l] of Object.entries(messages || {})) for (const m of Array.isArray(l) ? l : []) if (m && m.id) map.set(c + "\n" + m.id, { c, id: String(m.id), m });
  return [...map.values()];
}
function stateOf(d) {
  const out = Object.assign({}, d), msgs = {};
  for (const [c, l] of Object.entries(d.messages || {})) if (Array.isArray(l) && l.length) msgs[c] = l.slice(-MSG_STATE_KEEP);
  out.messages = msgs;
  out.migrations = Array.from(new Set([...(Array.isArray(d.migrations) ? d.migrations : []), MSG_MIG]));
  return out;
}
function saveSafety(dbObj, at) {
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ app: "auryx-nexos", version: 2, at, db: dbObj, note: "cópia automática antes de restaurar" })), { level: 9 });
  const name = `seguranca-antes-de-restaurar-${at}${key ? ".axb" : ".json.gz"}`;
  fs.writeFileSync(name, key ? BK.encrypt(gz, key) : gz);
  return path.resolve(name);
}

(async () => {
  if (!file) fail("Diga qual arquivo restaurar: node scripts/restaurar-backup.js <arquivo> [--confirmar]");
  let raw;
  try { raw = fs.readFileSync(file); } catch { fail("Arquivo não encontrado: " + file); }
  say(`\n  Arquivo: ${path.resolve(file)} (${(raw.length / 1024).toFixed(0)} KB${BK.isEncrypted(raw) ? ", criptografado" : ""})`);
  let j;
  try { j = BK.open(raw, key); } catch (e) { fail(e.message); }
  if (!Object.keys(j.db.users || {}).length) fail("O backup não tem nenhuma conta — não parece um backup válido.");
  const sum = summary(j);
  say("  Conteúdo:", sum);
  const rows = msgRows(j.db.messages);
  if (!CONFIRM) { say("\n  Nada foi alterado. Para restaurar de verdade, rode de novo com --confirmar.\n"); return; }

  const at = Date.now();
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    const url = process.env.DATABASE_URL;
    const ssl = process.env.NODE_ENV === "production" || /render\.com|neon\.tech|supabase|sslmode=require/.test(url) ? { rejectUnauthorized: false } : false;
    const pool = new Pool({ connectionString: url, ssl, max: 2 });
    pool.on("error", () => {});
    try {
      await pool.query("CREATE TABLE IF NOT EXISTS nexora_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      const cur = (await pool.query("SELECT data, updated_at FROM nexora_state WHERE id = 1")).rows[0];
      if (cur && Date.now() - new Date(cur.updated_at).getTime() < 90e3 && !FORCE)
        fail("O banco foi gravado há menos de 90 segundos: o servidor parece estar LIGADO e gravaria por cima da restauração. Suspenda o serviço no Render e rode de novo (ou use --forcar).");
      // 1) cópia de segurança do que existe agora
      if (cur) {
        const hasMsgs = (await pool.query("SELECT to_regclass('nexora_msgs') AS t")).rows[0].t;
        const now = Object.assign({}, cur.data);
        if (hasMsgs) {
          const all = {};
          for (const r of (await pool.query("SELECT channel, data FROM nexora_msgs ORDER BY channel, ts, id")).rows) (all[r.channel] || (all[r.channel] = [])).push(r.data);
          now.messages = all;
        }
        say("  Cópia de segurança do banco atual: " + saveSafety(now, at));
      }
      // 2) restaura tudo numa transação
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("CREATE TABLE IF NOT EXISTS nexora_msgs (channel TEXT NOT NULL, id TEXT NOT NULL, ts BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (channel, id))");
        await client.query("CREATE INDEX IF NOT EXISTS nexora_msgs_ch_ts_id ON nexora_msgs (channel, ts, id)");
        await client.query("INSERT INTO nexora_state (id, data, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()", [JSON.stringify(stateOf(j.db))]);
        await client.query("DELETE FROM nexora_msgs");
        for (let i = 0; i < rows.length; i += 500) {
          const part = rows.slice(i, i + 500);
          await client.query("INSERT INTO nexora_msgs (channel, id, ts, data) SELECT * FROM UNNEST($1::text[], $2::text[], $3::bigint[], $4::jsonb[])",
            [part.map(x => x.c), part.map(x => x.id), part.map(x => Number(x.m.ts) || 0), part.map(x => JSON.stringify(x.m))]);
        }
        const n = +(await client.query("SELECT count(*) AS n FROM nexora_msgs")).rows[0].n;
        if (n !== rows.length) throw new Error(`conferência falhou: ${n} mensagens gravadas de ${rows.length}`);
        await client.query("COMMIT");
        say(`  Restaurado no PostgreSQL: ${sum.contas} contas, ${sum.servidores} servidores, ${n} mensagens (conferidas).`);
      } catch (e) { await client.query("ROLLBACK").catch(() => {}); fail("Restauração desfeita, o banco ficou como estava: " + e.message); }
      finally { client.release(); }
    } finally { await pool.end().catch(() => {}); }
  } else {
    const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data"), dbFile = path.join(dir, "nexora.json");
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(dbFile)) { const copy = dbFile + ".antes-de-restaurar-" + at; fs.copyFileSync(dbFile, copy); say("  Cópia de segurança do arquivo atual: " + copy); }
    // no modo arquivo as mensagens ficam no próprio JSON
    fs.writeFileSync(dbFile + ".tmp", JSON.stringify(j.db));
    fs.renameSync(dbFile + ".tmp", dbFile);
    say(`  Restaurado em ${dbFile}: ${sum.contas} contas, ${sum.servidores} servidores, ${sum.mensagens} mensagens.`);
  }
  say("\n  Pronto. Ligue (ou retome) o servidor para ele carregar os dados restaurados.\n");
})().catch(e => fail(e.message));
