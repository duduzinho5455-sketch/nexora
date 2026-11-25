// Teste de ponta a ponta do UPDATE 1 (servidor real + PostgreSQL local PGlite + Google Drive falso)
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const APPDIR = path.join(__dirname, "..");
const { Pool } = require(path.join(APPDIR, "node_modules", "pg"));
const { io } = require("socket.io-client");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "auryx-teste-"));
const PG1 = 54401, PG2 = 54402, APP = 3301, APP2 = 3303, DRIVE = 3302, KEY = "senha-teste-123";
const url = p => `postgres://postgres:postgres@127.0.0.1:${p}/postgres`;
let pass = 0, failN = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  OK    " + msg); } else { failN++; console.log("  FALHA " + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tk = () => crypto.randomBytes(32).toString("base64url");
const tokenKey = t => crypto.createHash("sha256").update(t).digest("base64url");
const get = (p, u, headers = {}) => new Promise(res => { const r = http.get({ host: "127.0.0.1", port: p, path: u, headers }, x => { const c = []; x.on("data", d => c.push(d)); x.on("end", () => res({ status: x.statusCode, body: Buffer.concat(c), headers: x.headers })); }); r.on("error", () => res({ status: 0 })); });
const procs = [];
function run(cmd, args, env, tag) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  p.out = ""; p.stdout.on("data", d => (p.out += d)); p.stderr.on("data", d => (p.out += d));
  p.tag = tag; procs.push(p); return p;
}
async function waitFor(fn, ms = 30000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; }

/* ---------- Google Drive falso ---------- */
const drive = { files: [], sessions: new Map(), n: 0 };
http.createServer((req, res) => {
  const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => {
    const body = Buffer.concat(chunks), u = new URL(req.url, "http://x");
    if (u.pathname === "/token") { res.end(JSON.stringify({ access_token: "token-falso", expires_in: 3600 })); return; }
    if (req.method === "POST" && u.pathname === "/upload/drive/v3/files") {
      const id = "s" + ++drive.n; drive.sessions.set(id, JSON.parse(body.toString()));
      res.writeHead(200, { location: `http://127.0.0.1:${DRIVE}/sessao/${id}` }); res.end(); return;
    }
    if (req.method === "PUT" && u.pathname.startsWith("/sessao/")) {
      const meta = drive.sessions.get(u.pathname.split("/").pop());
      const f = { id: "f" + drive.n, name: meta.name, size: String(body.length), md5Checksum: crypto.createHash("md5").update(body).digest("hex"), createdTime: new Date(Date.now() + drive.n).toISOString(), trashed: false, data: body, app: meta.appProperties };
      drive.files.push(f); res.end(JSON.stringify({ id: f.id, name: f.name, size: f.size, md5Checksum: f.md5Checksum })); return;
    }
    if (req.method === "GET" && u.pathname === "/drive/v3/files") {
      const list = drive.files.filter(f => !f.trashed && f.app && f.app.auryx === "backup").sort((a, b) => b.createdTime.localeCompare(a.createdTime));
      res.end(JSON.stringify({ files: list.map(f => ({ id: f.id, name: f.name, createdTime: f.createdTime })) })); return;
    }
    if (req.method === "PATCH" && u.pathname.startsWith("/drive/v3/files/")) {
      const f = drive.files.find(x => x.id === decodeURIComponent(u.pathname.split("/").pop()));
      if (f) Object.assign(f, JSON.parse(body.toString() || "{}"));
      res.end(JSON.stringify({ id: f && f.id })); return;
    }
    res.statusCode = 404; res.end();
  });
}).listen(DRIVE, "127.0.0.1");

/* ---------- dados iniciais (formato antigo: tudo no JSON) ---------- */
const now = Date.now(), T = { owner: tk(), ana: tk(), expired: tk(), idle: tk(), banned: tk() };
const U = { owner: "u_owner000001", ana: "u_ana00000001", bia: "u_bia00000001", ban: "u_ban00000001" };
const user = (id, name, extra = {}) => ({ id, username: name, email: name + "@t.local", emailVerified: true, color: "#7c5cff", avatar: "", about: "", status: "online", salt: "x", hash: "00", created: now - 30 * 86400e3, ...extra });
const FILE_OK = "arquivoUsadoAAAAAAAA", FILE_ORPHAN = "arquivoOrfaoBBBBBBBB";
function seedState() {
  const c1 = [], c2 = [], dm = [];
  for (let i = 0; i < 700; i++) c1.push({ id: "m" + String(i).padStart(4, "0") + "x", a: U.ana, t: "mensagem " + i, ts: now - (800 - i) * 60e3 });
  c1[3].f = [{ id: FILE_OK, n: "foto.png", t: "image/png", s: 10 }];        // anexo numa mensagem bem antiga
  for (let i = 0; i < 5; i++) c2.push({ id: "c2m" + i, a: U.owner, t: "outro canal " + i, ts: now - (10 - i) * 60e3 });
  const dmId = "d." + [U.ana, U.bia].sort().join(".");
  for (let i = 0; i < 3; i++) dm.push({ id: "dm" + i, a: U.ana, t: "privado " + i, ts: now - (5 - i) * 60e3 });
  return {
    users: { [U.owner]: user(U.owner, "duduzinho5455"), [U.ana]: user(U.ana, "ana"), [U.bia]: user(U.bia, "bia"), [U.ban]: user(U.ban, "banido", { banned: { at: now, reason: "teste" } }) },
    sessions: {
      [tokenKey(T.owner)]: { userId: U.owner, created: now, last: now }, [tokenKey(T.ana)]: { userId: U.ana, created: now, last: now },
      [tokenKey(T.expired)]: { userId: U.ana, created: now - 400 * 86400e3, last: now }, [tokenKey(T.idle)]: { userId: U.ana, created: now - 100 * 86400e3, last: now - 70 * 86400e3 },
      [tokenKey(T.banned)]: { userId: U.ban, created: now, last: now }
    },
    servers: { s1: { id: "s1", name: "Teste", icon: "", color: "#7c5cff", description: "", public: false, ownerId: U.owner, created: now, members: [U.owner, U.ana], channels: [{ id: "c1", name: "geral", type: "text", topic: "" }, { id: "c2", name: "outro", type: "text", topic: "" }] } },
    invites: {}, messages: { c1, c2, [dmId]: dm }, dms: { [dmId]: { id: dmId, members: [U.ana, U.bia], created: now } },
    files: { [FILE_OK]: { o: U.ana, n: "foto.png", t: "image/png", s: 10, c: now - 10 * 86400e3, u: 1 }, [FILE_ORPHAN]: { o: U.ana, n: "velha.png", t: "image/png", s: 10, c: now - 10 * 86400e3 } },
    orders: {}, migrations: ["2026-11-auryx-nexos", "2026-11-mod-santhsz"], settings: { regOpen: true, maintenance: "", pixKey: "", links: {}, minApp: null, announce: null }
  };
}
const SEED_MSGS = 708;

function appEnv(pgPort, port) {
  const env = { PORT: String(port), DATABASE_URL: url(pgPort), DATA_DIR: path.join(TMP, "data" + port), BACKUP_KEY: KEY, GC_FIRST_MS: "6000",
    GDRIVE_CLIENT_ID: "id", GDRIVE_CLIENT_SECRET: "segredo", GDRIVE_REFRESH_TOKEN: "refresh", GDRIVE_TOKEN_URL: `http://127.0.0.1:${DRIVE}/token`, GDRIVE_API_URL: `http://127.0.0.1:${DRIVE}`, GDRIVE_KEEP: "2", NODE_ENV: "test" };
  for (const k of ["RENDER", "RESEND_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "ADMIN_USERS", "OLD_DATABASE_URL", "ALLOW_EMPTY_DB", "TRUST_PROXY"]) env[k] = "";
  return env;
}
const startApp = (pgPort, port) => run(process.execPath, [path.join(APPDIR, "server.js")], appEnv(pgPort, port), "app" + port);
const sock = (port, token) => new Promise(res => {
  const s = io(`http://127.0.0.1:${port}`, { auth: { token, v: 4 }, transports: ["websocket"], reconnection: false, timeout: 5000 });
  s.on("ready", d => res({ s, ready: d }));
  s.on("connect_error", e => { res({ s, error: e.message }); s.close(); });
});
const ask = (s, ev, data) => new Promise(res => s.timeout(10000).emit(ev, data || {}, (err, r) => res(err ? { error: "timeout" } : r)));

(async () => {
  try {
    console.log("Pasta do teste:", TMP);
    const pg1 = run(process.execPath, [path.join(__dirname, "pg-ctl.mjs"), String(PG1)], {}, "pg1");
    const pg2 = run(process.execPath, [path.join(__dirname, "pg-ctl.mjs"), String(PG2)], {}, "pg2");
    ok(await waitFor(() => pg1.out.includes("PGLITE_READY") && pg2.out.includes("PGLITE_READY")), "Postgres de teste ligado (2 bancos)");
    const P1 = new Pool({ connectionString: url(PG1), max: 2 }); P1.on("error", () => {});
    await P1.query("CREATE TABLE IF NOT EXISTS nexora_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await P1.query("CREATE TABLE IF NOT EXISTS nexora_files (id TEXT PRIMARY KEY, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await P1.query("INSERT INTO nexora_state (id, data) VALUES (1, $1::jsonb)", [JSON.stringify(seedState())]);
    await P1.query("INSERT INTO nexora_files (id, data) VALUES ($1, $2), ($3, $4)", [FILE_OK, Buffer.from("png-usado"), FILE_ORPHAN, Buffer.from("png-orfao")]);

    console.log("\n1) Migração das mensagens para a tabela própria");
    let app = startApp(PG1, APP);
    ok(await waitFor(async () => (await get(APP, "/health")).status === 200, 40000), "servidor ligou com o banco antigo");
    const count = async () => +(await P1.query("SELECT count(*) AS n FROM nexora_msgs")).rows[0].n;
    ok(await count() === SEED_MSGS, `todas as ${SEED_MSGS} mensagens foram para a tabela (inclusive as além de 500 por canal)`);
    const bk0 = (await P1.query("SELECT id, reason, ok, enc FROM nexora_backups")).rows;
    ok(bk0.some(b => b.reason === "antes-msgs" && b.ok && b.enc), "backup criptografado e conferido feito ANTES da migração");
    await sleep(1500);
    const st = (await P1.query("SELECT data FROM nexora_state WHERE id = 1")).rows[0].data;
    ok(st.migrations.includes("2026-11-msgs-table"), "migração registrada (não roda de novo)");
    ok(st.messages.c1.length === 50, `estado guarda só as últimas 50 do canal (para poder voltar versão): ${st.messages.c1.length}`);

    console.log("\n2) Sessões e contas suspensas");
    let r = await sock(APP, T.expired); ok(r.error === "auth", "sessão com mais de 1 ano é recusada");
    r = await sock(APP, T.idle); ok(r.error === "auth", "sessão sem uso há 70 dias é recusada");
    r = await sock(APP, T.banned); ok(r.error === "banned", "conta suspensa não conecta");
    const up = await new Promise(res => { const q = http.request({ host: "127.0.0.1", port: APP, path: "/api/upload", method: "POST", headers: { authorization: "Bearer " + T.banned, "content-length": 3, "content-type": "text/plain" } }, x => { x.resume(); res(x.statusCode); }); q.end("abc"); });
    ok(up === 401, `conta suspensa não envia arquivo pela API (${up})`);
    const A = await sock(APP, T.ana); ok(!!A.ready, "sessão válida conecta normalmente");
    const O = await sock(APP, T.owner);

    console.log("\n3) Envio repetido não duplica");
    const s1 = await ask(A.s, "send", { channelId: "c1", text: "oi de novo", nonce: "nonce-1" });
    const s2 = await ask(A.s, "send", { channelId: "c1", text: "oi de novo", nonce: "nonce-1" });
    ok(s1.id && s2.id === s1.id && s2.dup === true, "o mesmo envio repetido devolve a mesma mensagem (sem duplicar)");
    await sleep(1600);
    ok(await count() === SEED_MSGS + 1, "só 1 mensagem nova foi gravada");

    console.log("\n4) Histórico completo (sem limite de 500)");
    let page = await ask(A.s, "history", { channelId: "c1" }), all = [...page.messages], guard = 0;
    while (page.more && guard++ < 40) { page = await ask(A.s, "history", { channelId: "c1", before: all[0].id }); all = [...page.messages, ...all]; }
    const ids = new Set(all.map(m => m.id));
    ok(all.length === 701 && ids.size === 701, `rolando para cima chega nas 701 mensagens, sem repetir (${all.length})`);
    ok(all.every((m, i) => i === 0 || m.ts >= all[i - 1].ts), "em ordem do mais antigo para o mais novo");
    ok(all[0].id === "m0000x", "a mensagem mais antiga de todas aparece");

    console.log("\n5) Editar, reagir, responder e apagar mensagem antiga (fora da memória)");
    let e = await ask(A.s, "edit", { channelId: "c1", id: "m0000x", text: "mensagem 0 editada" }); ok(!e.error, "editou mensagem antiga " + (e.error || ""));
    e = await ask(A.s, "react", { channelId: "c1", id: "m0000x", emoji: "🔥" }); ok(!e.error, "reagiu em mensagem antiga " + (e.error || ""));
    e = await ask(A.s, "send", { channelId: "c1", text: "respondendo a antiga", replyTo: "m0000x", nonce: "nonce-2" });
    const latest = await ask(A.s, "history", { channelId: "c1" });
    const reply = latest.messages.find(m => m.id === e.id);
    ok(reply && reply.re && reply.re.t === "mensagem 0 editada", "resposta a mensagem antiga mostra o texto certo");
    e = await ask(A.s, "delete", { channelId: "c1", id: "m0001x" }); ok(!e.error, "apagou mensagem antiga " + (e.error || ""));
    const after = await ask(A.s, "history", { channelId: "c1" });
    ok(after.messages[after.messages.length - 1].id === reply.id, "apagar mensagem antiga NÃO apagou a última do canal (bug antigo do indexOf -1)");
    await sleep(1600);
    const row0 = (await P1.query("SELECT data FROM nexora_msgs WHERE channel = 'c1' AND id = 'm0000x'")).rows[0].data;
    ok(row0.t === "mensagem 0 editada" && row0.r && row0.r["🔥"], "edição e reação gravadas na tabela");
    ok((await P1.query("SELECT count(*) AS n FROM nexora_msgs WHERE id = 'm0001x'")).rows[0].n === "0", "mensagem apagada saiu da tabela");

    console.log("\n6) Limpeza de arquivos respeita mensagens antigas");
    await waitFor(() => /Limpeza/.test(app.out), 15000);
    const files = (await P1.query("SELECT id FROM nexora_files")).rows.map(x => x.id);
    ok(files.includes(FILE_OK), "foto anexada numa mensagem antiga (só na tabela) foi MANTIDA");
    ok(!files.includes(FILE_ORPHAN), "arquivo sem uso foi apagado");

    console.log("\n7) Backup: criptografia, conferência, Google Drive e retenção");
    let b = await ask(O.s, "admin:backup:now");
    ok(b.backup && b.backup.ok && b.backup.enc, `backup manual criptografado e conferido (${b.backup ? b.backup.msgs : "?"} mensagens)`);
    ok(b.backup && b.backup.msgs === SEED_MSGS + 1, "o backup leva TODAS as mensagens da tabela");
    await sleep(1500);
    await ask(O.s, "admin:backup:now"); await sleep(1500);
    await ask(O.s, "admin:backup:now"); await sleep(2000);
    const info = await ask(O.s, "admin:backups");
    ok(info.enc === true && info.drive && info.drive.on && info.drive.last && info.drive.last.ok, "painel mostra criptografia ligada e último envio ao Drive ok");
    const live = drive.files.filter(f => !f.trashed), trashed = drive.files.filter(f => f.trashed);
    ok(drive.files.length >= 4 && live.length === 2 && trashed.length >= 2, `Drive guarda as 2 últimas e manda as antigas para a LIXEIRA (${live.length} ativas, ${trashed.length} na lixeira)`);
    ok(drive.files.every(f => f.data.subarray(0, 4).toString() === "AXB1" && f.name.endsWith(".axb")), "o que vai para o Drive está criptografado");
    const kept = (await P1.query("SELECT reason FROM nexora_backups")).rows.map(x => x.reason);
    ok(kept.filter(x => x === "manual").length === 3 && kept.includes("antes-msgs"), `no banco: 3 últimos + o de antes da migração (${kept.join(", ")})`);

    console.log("\n8) Restauração");
    const list = info.list, last = list.find(x => x.reason === "manual");
    const dl = await get(APP, "/api/admin/backup/" + last.id, { authorization: "Bearer " + T.owner });
    ok(dl.status === 200 && /\.axb"/.test(dl.headers["content-disposition"] || ""), "dono baixa o backup criptografado (.axb)");
    const deny = await get(APP, "/api/admin/backup/" + last.id, { authorization: "Bearer " + T.ana });
    ok(deny.status === 403, "pessoa comum não baixa backup");
    const bkFile = path.join(TMP, last.id + ".axb"); fs.writeFileSync(bkFile, dl.body);
    const script = path.join(APPDIR, "scripts", "restaurar-backup.js");
    let out = "";
    try { execFileSync(process.execPath, [script, bkFile], { env: { ...process.env, BACKUP_KEY: "senha-errada", DATABASE_URL: "" }, cwd: TMP, stdio: "pipe" }); } catch (x) { out = String(x.stdout) + String(x.stderr); }
    ok(/senha|BACKUP_KEY/i.test(out), "senha errada: o backup não abre (e diz por quê)");
    out = execFileSync(process.execPath, [script, bkFile], { env: { ...process.env, BACKUP_KEY: KEY, DATABASE_URL: "" }, cwd: TMP }).toString();
    ok(/mensagens: 709/.test(out) && /Nada foi alterado/.test(out), "sem --confirmar só confere e mostra o resumo (709 mensagens)");
    out = execFileSync(process.execPath, [script, bkFile, "--confirmar"], { env: { ...process.env, BACKUP_KEY: KEY, DATABASE_URL: url(PG2) }, cwd: TMP }).toString();
    ok(/709 mensagens \(conferidas\)/.test(out), "restaurou num banco NOVO e conferiu as 709 mensagens");
    let out2 = "";
    try { execFileSync(process.execPath, [script, bkFile, "--confirmar"], { env: { ...process.env, BACKUP_KEY: KEY, DATABASE_URL: url(PG1) }, cwd: TMP, stdio: "pipe" }); } catch (x) { out2 = String(x.stdout) + String(x.stderr); }
    ok(/LIGADO/.test(out2), "recusa restaurar por cima de um banco com o servidor ligado");
    const app2 = startApp(PG2, APP2);
    ok(await waitFor(async () => (await get(APP2, "/health")).status === 200, 40000), "servidor novo liga com o banco restaurado");
    const A2 = await sock(APP2, T.ana);
    let p2 = await ask(A2.s, "history", { channelId: "c1" }), all2 = [...p2.messages];
    while (p2.more) { p2 = await ask(A2.s, "history", { channelId: "c1" , before: all2[0].id }); all2 = [...p2.messages, ...all2]; }
    ok(all2.length === 701 && all2[0].t === "mensagem 0 editada", `histórico restaurado inteiro, com a edição (${all2.length} no canal)`);
    A2.s.close(); app2.kill();

    console.log("\n9) Banco fora do ar não derruba o servidor");
    await get(PG1 + 1000, "/stop");
    await sleep(1500);
    const sent = await ask(A.s, "send", { channelId: "c1", text: "mandada com o banco fora", nonce: "nonce-3" });
    ok(!!sent.id, "chat continua funcionando com o banco fora do ar");
    await sleep(5000);
    ok(app.exitCode === null && (await get(APP, "/health")).status === 200, "servidor continua vivo (antes caía com erro de conexão)");
    await get(PG1 + 1000, "/start");
    ok(await waitFor(async () => +(await P1.query("SELECT count(*) AS n FROM nexora_msgs WHERE id = $1", [sent.id]).then(x => x.rows[0].n, () => 0)) === 1, 30000), "quando o banco volta, a mensagem pendente é gravada");

    console.log("\n10) Reiniciar o servidor não perde nada");
    A.s.close(); O.s.close();
    app.kill(); await sleep(1500);
    app = startApp(PG1, APP);
    ok(await waitFor(async () => (await get(APP, "/health")).status === 200, 40000), "servidor ligou de novo");
    ok(!/copiadas e conferidas/.test(app.out), "a migração não roda duas vezes");
    const A3 = await sock(APP, T.ana);
    const h = await ask(A3.s, "history", { channelId: "c1" });
    ok(h.messages.some(m => m.id === sent.id), "a mensagem mandada com o banco fora continua lá");
    A3.s.close();
  } catch (e) { failN++; console.log("  FALHA inesperada:", e && e.stack || e); }
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  if (failN) for (const p of procs) if (/app/.test(p.tag)) console.log(`\n--- saída ${p.tag} ---\n` + p.out.slice(-3000));
  for (const p of procs) try { p.kill(); } catch {}
  process.exit(failN ? 1 : 0);
})();
