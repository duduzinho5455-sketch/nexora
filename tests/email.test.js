// E-mail (Esqueci a senha): diagnóstico do motivo real da recusa do Resend + e-mail de teste do painel
"use strict";
const path = require("node:path"), fs = require("node:fs"), os = require("node:os"), http = require("node:http"), crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");
const APPDIR = path.join(__dirname, "..");
const APP = 3341, RESEND = 3342;
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK    " + m); } else { failN++; console.log("  FALHA " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tk = () => crypto.randomBytes(32).toString("base64url"), tokenKey = t => crypto.createHash("sha256").update(t).digest("base64url");

// Resend falso: "teste" = recusa como o Resend real faz com o remetente onboarding@resend.dev
let mode = "teste";
const sent = [];
http.createServer((req, res) => {
  let b = ""; req.on("data", c => (b += c)); req.on("end", () => {
    const j = JSON.parse(b || "{}");
    if (mode === "teste") { res.writeHead(403, { "content-type": "application/json" }); res.end(JSON.stringify({ statusCode: 403, name: "validation_error", message: "You can only send testing emails to your own email address (dono@t.local). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain." })); return; }
    sent.push(j); res.end(JSON.stringify({ id: "email-" + sent.length }));
  });
}).listen(RESEND, "127.0.0.1");

const now = Date.now(), T = { owner: tk() };
const user = (id, n) => ({ id, username: n, email: n + "@t.local", emailVerified: true, color: "#7c5cff", avatar: "", about: "", status: "online", salt: "x", hash: "00", created: now });
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "axmail-"));
fs.writeFileSync(path.join(DATA, "nexora.json"), JSON.stringify({ users: { u_owner: user("u_owner", "duduzinho5455"), u_ana: user("u_ana", "ana") }, sessions: { [tokenKey(T.owner)]: { userId: "u_owner", created: now, last: now } },
  servers: {}, invites: {}, messages: {}, dms: {}, files: {}, orders: {}, migrations: ["2026-11-auryx-nexos", "2026-11-mod-santhsz"] }));
const post = (p, body) => new Promise(r => { const q = http.request({ host: "127.0.0.1", port: APP, path: p, method: "POST", headers: { "content-type": "application/json" } }, x => { let d = ""; x.on("data", c => (d += c)); x.on("end", () => r({ status: x.statusCode, body: JSON.parse(d || "{}") })); }); q.end(JSON.stringify(body)); });
const sock = t => new Promise(r => { const s = io(`http://127.0.0.1:${APP}`, { auth: { token: t, v: 4 }, transports: ["websocket"], reconnection: false }); s.on("ready", () => r(s)); s.on("connect_error", e => r({ error: e.message })); });
const ask = (s, ev, d) => new Promise(r => s.timeout(15000).emit(ev, d || {}, (e, x) => r(e ? { error: "timeout" } : x)));

(async () => {
  const app = spawn(process.execPath, [path.join(APPDIR, "server.js")], { env: { ...process.env, PORT: String(APP), DATA_DIR: DATA, DATABASE_URL: "", RESEND_API_KEY: "re_falsa", RESEND_API_URL: `http://127.0.0.1:${RESEND}/emails`, MAIL_FROM: "", RENDER: "", GEMINI_API_KEY: "", GROQ_API_KEY: "", ANTHROPIC_API_KEY: "", ADMIN_USERS: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; app.stdout.on("data", d => (out += d)); app.stderr.on("data", d => (out += d));
  try {
    for (let i = 0; i < 80; i++) { const h = await new Promise(r => http.get(`http://127.0.0.1:${APP}/health`, x => { x.resume(); r(x.statusCode); }).on("error", () => r(0))); if (h === 200) break; await sleep(250); }
    console.log("\n1) Remetente de teste do Resend (o problema de produção)");
    let r = await post("/api/account/forgot", { email: "ana@t.local" });
    ok(r.status === 502 && /Não foi possível enviar/.test(r.body.error || ""), "Esqueci a senha avisa a pessoa que o e-mail não saiu (não finge que mandou)");
    const O = await sock(T.owner);
    let st = await ask(O, "admin:stats");
    const d = st.mailDiag;
    ok(d && d.testSender && /onboarding@resend\.dev/.test(d.from), "painel mostra que o remetente é o de TESTE (onboarding@resend.dev)");
    ok(d && d.lastErr && d.lastErr.status === 403 && /own email address/.test(d.lastErr.text), "painel mostra a resposta exata do Resend (403)");
    ok(d && /Verifique o domínio auryxnexos\.com\.br/.test(d.lastErr.hint) && /MAIL_FROM/.test(d.lastErr.hint), "e explica o que fazer: verificar o domínio e definir MAIL_FROM");
    r = await ask(O, "admin:mail:test");
    ok(r.ok === false && r.error && /TESTE/.test(r.error.hint), "botão de e-mail de teste mostra o motivo da recusa");
    console.log("\n2) Depois de configurar o domínio");
    mode = "ok";
    r = await ask(O, "admin:mail:test");
    ok(r.ok === true && sent.length === 1 && sent[0].to[0] === "duduzinho5455@t.local", "e-mail de teste chega no e-mail do ADM");
    await sleep(46000);    // o servidor só manda outro código de recuperação depois de 45 s
    r = await post("/api/account/forgot", { email: "ana@t.local" });
    const code = sent[1] && /(\d{6})/.exec(sent[1].subject);
    ok(r.status === 200 && sent[1] && sent[1].to[0] === "ana@t.local" && code, "código de Esqueci a senha chega para a pessoa");
    r = await post("/api/account/reset", { email: "ana@t.local", code: code && code[1], password: "novaSenha123" });
    ok(r.status === 200 && r.body.token, "com o código, a senha é trocada e a pessoa entra");
    st = await ask(O, "admin:stats");
    ok(st.mailDiag.lastOk && st.mailDiag.lastOk.to, "painel mostra o último envio que deu certo");
    O.close();
  } catch (e) { failN++; console.log("FALHA inesperada", e); }
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  if (failN) console.log(out.slice(-2000));
  app.kill(); process.exit(failN ? 1 : 0);
})();
