// UPDATE 2: Aury (tempo limite da 1ª palavra -> troca de provedor, Parar, Tentar de novo) + fixar + pesquisar
"use strict";
const path = require("node:path"), fs = require("node:fs"), os = require("node:os"), http = require("node:http"), crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");
const APPDIR = path.join(__dirname, "..");
const { Pool } = require(path.join(APPDIR, "node_modules", "pg"));
const PG = 54411, APP = 3321, GEM = 3322, GROQ = 3323;
const url = `postgres://postgres:postgres@127.0.0.1:${PG}/postgres`;
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK    " + m); } else { failN++; console.log("  FALHA " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tk = () => crypto.randomBytes(32).toString("base64url"), tokenKey = t => crypto.createHash("sha256").update(t).digest("base64url");
const procs = [];
const run = (args, env, tag) => { const p = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); p.out = ""; p.stdout.on("data", d => (p.out += d)); p.stderr.on("data", d => (p.out += d)); p.tag = tag; procs.push(p); return p; };
const get = u => new Promise(res => http.get({ host: "127.0.0.1", port: APP, path: u }, x => { x.resume(); res(x.statusCode); }).on("error", () => res(0)));

// Gemini falso: "trava" = aceita e não manda nada; "devagar" = 1 palavra a cada 150 ms
let gemMode = "trava";
const words = ("Resposta comprida que chega aos poucos para dar tempo de apertar parar. ".repeat(20)).split(/(?<= )/);
http.createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    if (/models\?/.test(req.url)) { res.end(JSON.stringify({ models: [] })); return; }
    res.writeHead(200, { "content-type": "text/event-stream" });
    if (gemMode === "trava") return;                // nunca responde
    let i = 0;
    const t = setInterval(() => { if (i >= words.length || res.destroyed) { clearInterval(t); res.end(); return; } res.write("data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: words[i++] }] } }] }) + "\n\n"); }, 150);
    res.on("close", () => clearInterval(t));
  });
}).listen(GEM, "127.0.0.1");
// Groq falso (reserva): responde rápido
http.createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const w of ["Oi! ", "Aqui é ", "o Groq ", "de reserva."]) res.write("data: " + JSON.stringify({ choices: [{ delta: { content: w } }] }) + "\n\n");
    res.end("data: [DONE]\n\n");
  });
}).listen(GROQ, "127.0.0.1");

const now = Date.now(), T = { owner: tk(), ana: tk(), bia: tk() };
const U = { owner: "u_owner", ana: "u_ana", bia: "u_bia" };
const user = (id, n) => ({ id, username: n, email: n + "@t.local", emailVerified: true, color: "#7c5cff", avatar: "", about: "", status: "online", salt: "x", hash: "00", created: now });
const c1 = []; for (let i = 0; i < 600; i++) c1.push({ id: "m" + String(i).padStart(4, "0"), a: U.ana, t: i === 5 ? "o código secreto é abacaxi 100%" : "mensagem número " + i, ts: now - (700 - i) * 60e3 });
const dmId = "d." + [U.ana, U.owner].sort().join(".");
const state = {
  users: { [U.owner]: user(U.owner, "duduzinho5455"), [U.ana]: user(U.ana, "ana"), [U.bia]: user(U.bia, "bia") },
  sessions: Object.fromEntries(Object.entries(T).map(([k, t]) => [tokenKey(t), { userId: U[k], created: now, last: now }])),
  servers: { s1: { id: "s1", name: "T", icon: "", color: "#7c5cff", description: "", public: false, ownerId: U.owner, created: now, members: [U.owner, U.ana, U.bia], channels: [{ id: "c1", name: "geral", type: "text", topic: "" }] } },
  invites: {}, messages: { c1, [dmId]: [{ id: "dm1", a: U.ana, t: "segredo do privado", ts: now }] }, dms: { [dmId]: { id: dmId, members: [U.ana, U.owner], created: now } },
  files: {}, orders: {}, migrations: ["2026-11-auryx-nexos", "2026-11-mod-santhsz"]
};
const sock = t => new Promise(r => { const s = io(`http://127.0.0.1:${APP}`, { auth: { token: t, v: 4 }, transports: ["websocket"], reconnection: false }); s.on("ready", () => r(s)); s.on("connect_error", e => r({ error: e.message })); });
const ask = (s, ev, d) => new Promise(r => s.timeout(15000).emit(ev, d || {}, (e, x) => r(e ? { error: "timeout" } : x)));
const waitEv = (s, ev, ms = 20000) => new Promise(r => { const t = setTimeout(() => r(null), ms); s.once(ev, d => { clearTimeout(t); r(d); }); });

(async () => {
  try {
    const pg = run([path.join(__dirname, "pg-ctl.mjs"), String(PG)], {}, "pg");
    for (let i = 0; i < 100 && !pg.out.includes("PGLITE_READY"); i++) await sleep(200);
    const P = new Pool({ connectionString: url, max: 1 }); P.on("error", () => {});
    await P.query("CREATE TABLE nexora_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await P.query("CREATE TABLE nexora_files (id TEXT PRIMARY KEY, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await P.query("INSERT INTO nexora_state (id, data) VALUES (1, $1::jsonb)", [JSON.stringify(state)]);
    const env = { PORT: String(APP), DATABASE_URL: url, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ax2-")), GEMINI_API_KEY: "falsa", GEMINI_BASE_URL: `http://127.0.0.1:${GEM}`, GEMINI_MODEL: "gemini-teste",
      GROQ_API_KEY: "falsa", GROQ_BASE_URL: `http://127.0.0.1:${GROQ}`, AI_FIRST_MS: "3000", ANTHROPIC_API_KEY: "", RENDER: "", RESEND_API_KEY: "", ADMIN_USERS: "", BACKUP_KEY: "" };
    const app = run([path.join(APPDIR, "server.js")], env, "app");
    for (let i = 0; i < 160 && (await get("/health")) !== 200; i++) await sleep(250);
    const O = await sock(T.owner), A = await sock(T.ana), B = await sock(T.bia);

    console.log("\n1) Aury: provedor travado é trocado em poucos segundos");
    let t0 = Date.now(), r = await ask(O, "ai:send", { text: "oi" });
    ok(!!r.replyId, "pergunta aceita");
    let done = await waitEv(O, "ai:done", 20000), secs = (Date.now() - t0) / 1000;
    ok(done && /Groq de reserva/.test(done.msg.t), `Gemini travado -> respondeu o Groq de reserva ("${done && done.msg.t}")`);
    ok(secs < 8, `em ${secs.toFixed(1)} s (antes esperava até 60 s)`);

    console.log("\n2) Aury: botão Parar");
    gemMode = "devagar";
    r = await ask(O, "ai:send", { text: "me conta uma história longa" });
    await sleep(1500);
    const st = await ask(O, "ai:stop");
    ok(st.stopped === true, "pedido de parar aceito");
    done = await waitEv(O, "ai:done", 10000);
    ok(done && done.msg.x === 1 && done.msg.t.length > 5 && done.msg.t.length < words.join("").length, `resposta parou no meio e ficou marcada como interrompida (${done ? done.msg.t.length : 0} letras)`);
    await sleep(1500);
    const before = await ask(O, "ai:state");
    ok(before.msgs[before.msgs.length - 1].x === 1, "a parte que chegou fica salva na conversa");

    console.log("\n3) Aury: Tentar de novo");
    gemMode = "trava";
    r = await ask(O, "ai:retry");
    ok(r.replyId && r.removed === done.msg.id, "tentar de novo tira a resposta interrompida");
    const d2 = await waitEv(O, "ai:done", 20000);
    const after = await ask(O, "ai:state");
    const last = after.msgs[after.msgs.length - 1], prev = after.msgs[after.msgs.length - 2];
    ok(d2 && !last.x && /Groq/.test(last.t) && prev.r === "u" && prev.t === "me conta uma história longa", "nova resposta para a mesma pergunta, sem repetir a pergunta");
    r = await ask(A, "ai:send", { text: "oi" });
    ok(/exclusiva/.test(r.error || ""), "quem não assina continua sem acesso à Aury");

    console.log("\n4) Mensagens fixadas");
    const evA = waitEv(A, "pins:update", 5000);
    r = await ask(O, "pin", { channelId: "c1", id: "m0005" });
    ok(r.pins && r.pins[0] === "m0005", "dono fixa uma mensagem ANTIGA (fora da memória)");
    const ev = await evA;
    ok(ev && ev.pins[0] === "m0005", "quem está no canal fica sabendo na hora");
    r = await ask(A, "pin", { channelId: "c1", id: "m0590" });
    ok(/permissão/.test(r.error || ""), "membro sem permissão não fixa");
    r = await ask(A, "pins:list", { channelId: "c1" });
    ok(r.pins && r.pins.length === 1 && /abacaxi/.test(r.pins[0].t) && r.canPin === false, "lista das fixadas mostra a mensagem antiga inteira");
    r = await ask(A, "pin", { channelId: dmId, id: "dm1" });
    ok(r.pins && r.pins[0] === "dm1", "na conversa privada, as duas pessoas podem fixar");
    r = await ask(B, "pins:list", { channelId: dmId });
    ok(/não encontrada/.test(r.error || ""), "quem não está na conversa privada não vê as fixadas");
    await ask(O, "delete", { channelId: "c1", id: "m0005" });
    r = await ask(O, "pins:list", { channelId: "c1" });
    ok(r.pins && r.pins.length === 0, "mensagem fixada apagada sai da lista");

    console.log("\n5) Pesquisa no histórico inteiro");
    r = await ask(A, "search", { channelId: "c1", q: "número 1" });
    ok(r.results && r.results.length === 50, `achou mensagens antigas e novas (limite de 50): ${r.results && r.results.length}`);
    r = await ask(A, "search", { channelId: "c1", q: "número 12" });
    ok(r.results && r.results.some(m => m.id === "m0012"), "acha uma mensagem que só existe na tabela (antiga)");
    r = await ask(A, "search", { channelId: "c1", q: "MENSAGEM NÚMERO 599" });
    ok(r.results && r.results[0] && r.results[0].id === "m0599", "não diferencia maiúsculas");
    r = await ask(A, "search", { channelId: "c1", q: "%" + "_" });
    ok(r.results && r.results.length === 0, "caracteres especiais (% e _) não viram curinga");
    r = await ask(B, "search", { channelId: dmId, q: "segredo" });
    ok(/não encontrada/.test(r.error || ""), "não dá para pesquisar conversa privada dos outros");
    r = await ask(A, "search", { channelId: "c1", q: "a" });
    ok(/2 letras/.test(r.error || ""), "pesquisa precisa de 2 letras");
  } catch (e) { failN++; console.log("FALHA inesperada", e && e.stack || e); }
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  if (failN) for (const p of procs) if (p.tag === "app") console.log(p.out.slice(-2500));
  for (const p of procs) try { p.kill(); } catch {}
  process.exit(failN ? 1 : 0);
})();
