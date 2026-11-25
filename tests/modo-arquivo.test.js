// Modo sem PostgreSQL (arquivo data/nexora.json): tudo continua funcionando como antes + backup novo
"use strict";
const path = require("node:path"), fs = require("node:fs"), os = require("node:os"), http = require("node:http"), crypto = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const { io } = require("socket.io-client");
const APPDIR = path.join(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "auryx-arq-")), DATA = path.join(TMP, "data"), PORT = 3311;
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK    " + m); } else { failN++; console.log("  FALHA " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tk = () => crypto.randomBytes(32).toString("base64url"), tokenKey = t => crypto.createHash("sha256").update(t).digest("base64url");
const get = (u, h = {}) => new Promise(res => http.get({ host: "127.0.0.1", port: PORT, path: u, headers: h }, x => { const c = []; x.on("data", d => c.push(d)); x.on("end", () => res({ status: x.statusCode, body: Buffer.concat(c) })); }).on("error", () => res({ status: 0 })));
const now = Date.now(), T = { owner: tk(), ana: tk() };
const user = (id, n) => ({ id, username: n, email: n + "@t.local", emailVerified: true, color: "#7c5cff", avatar: "", about: "", status: "online", salt: "x", hash: "00", created: now });
fs.mkdirSync(DATA, { recursive: true });
const msgs = []; for (let i = 0; i < 60; i++) msgs.push({ id: "m" + i, a: "u_ana", t: "msg " + i, ts: now - (100 - i) * 1000 });
fs.writeFileSync(path.join(DATA, "nexora.json"), JSON.stringify({
  users: { u_owner: user("u_owner", "duduzinho5455"), u_ana: user("u_ana", "ana") },
  sessions: { [tokenKey(T.owner)]: { userId: "u_owner", created: now, last: now }, [tokenKey(T.ana)]: { userId: "u_ana", created: now, last: now } },
  servers: { s1: { id: "s1", name: "T", icon: "", color: "#7c5cff", description: "", public: false, ownerId: "u_owner", created: now, members: ["u_owner", "u_ana"], channels: [{ id: "c1", name: "geral", type: "text", topic: "" }] } },
  invites: {}, messages: { c1: msgs }, dms: {}, files: {}, orders: {}, migrations: ["2026-11-auryx-nexos", "2026-11-mod-santhsz"]
}));
const env = { ...process.env, PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: "", BACKUP_KEY: "chave-arquivo", RENDER: "", RESEND_API_KEY: "", GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "", GROQ_API_KEY: "", ADMIN_USERS: "" };
const app = spawn(process.execPath, [path.join(APPDIR, "server.js")], { env, stdio: ["ignore", "pipe", "pipe"] });
let out = ""; app.stdout.on("data", d => (out += d)); app.stderr.on("data", d => (out += d));
const sock = t => new Promise(r => { const s = io(`http://127.0.0.1:${PORT}`, { auth: { token: t, v: 4 }, transports: ["websocket"], reconnection: false }); s.on("ready", () => r(s)); s.on("connect_error", e => r({ error: e.message })); });
const ask = (s, ev, d) => new Promise(r => s.timeout(10000).emit(ev, d || {}, (e, x) => r(e ? { error: "timeout" } : x)));
(async () => {
  try {
    for (let i = 0; i < 80 && (await get("/health")).status !== 200; i++) await sleep(250);
    ok((await get("/health")).status === 200, "servidor ligou no modo arquivo");
    ok(!/Mensagens:/.test(out), "sem PostgreSQL não tenta criar tabela de mensagens");
    const A = await sock(T.ana), O = await sock(T.owner);
    const h = await ask(A, "history", { channelId: "c1" });
    ok(h.messages.length === 50 && h.more === true, "histórico pagina como antes (50 + mais)");
    const h2 = await ask(A, "history", { channelId: "c1", before: h.messages[0].id });
    ok(h2.messages.length === 10 && h2.more === false, "segunda página com as 10 restantes");
    const s1 = await ask(A, "send", { channelId: "c1", text: "oi", nonce: "n1" }), s2 = await ask(A, "send", { channelId: "c1", text: "oi", nonce: "n1" });
    ok(s1.id && s2.id === s1.id && s2.dup, "envio repetido não duplica também no modo arquivo");
    const del = await ask(A, "delete", { channelId: "c1", id: "m5" });
    ok(!del.error, "apagar mensagem funciona");
    const b = await ask(O, "admin:backup:now");
    ok(b.backup && b.backup.ok && b.backup.enc, "backup no modo arquivo: criptografado e conferido");
    const files = fs.readdirSync(path.join(DATA, "backups"));
    ok(files.some(f => f.endsWith(".axb")) && files.some(f => f.endsWith(".ok")), `arquivos do backup na pasta (${files.join(", ")})`);
    const lst = await ask(O, "admin:backups");
    ok(lst.list && lst.list[0] && lst.list[0].ok && lst.list[0].enc, "painel lista o backup como conferido e criptografado");
    A.close(); O.close(); app.kill(); await sleep(800);
    const bk = path.join(DATA, "backups", files.find(f => f.endsWith(".axb")));
    const DATA2 = path.join(TMP, "restaurado");
    const o = execFileSync(process.execPath, [path.join(APPDIR, "scripts", "restaurar-backup.js"), bk, "--confirmar"], { env: { ...process.env, DATABASE_URL: "", DATA_DIR: DATA2, BACKUP_KEY: "chave-arquivo" }, cwd: TMP }).toString();
    const j = JSON.parse(fs.readFileSync(path.join(DATA2, "nexora.json"), "utf8"));
    ok(/Restaurado em/.test(o) && j.messages.c1.length === 60 && !j.messages.c1.some(m => m.id === "m5"), `restauração no modo arquivo (60 mensagens, a apagada continua apagada)`);
  } catch (e) { failN++; console.log("FALHA inesperada", e); }
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  if (failN) console.log(out.slice(-2000));
  try { app.kill(); } catch {}
  process.exit(failN ? 1 : 0);
})();
