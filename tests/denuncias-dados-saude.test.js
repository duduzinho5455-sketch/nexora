// UPDATE 3: denúncias, exportar meus dados (LGPD), monitoramento/alertas e cache de ícones
"use strict";
const path = require("node:path"), fs = require("node:fs"), os = require("node:os"), http = require("node:http"), crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");
const APPDIR = path.join(__dirname, "..");
const { Pool } = require(path.join(APPDIR, "node_modules", "pg"));
const PG = 54421, APP = 3331;
const url = `postgres://postgres:postgres@127.0.0.1:${PG}/postgres`;
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK    " + m); } else { failN++; console.log("  FALHA " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tk = () => crypto.randomBytes(32).toString("base64url"), tokenKey = t => crypto.createHash("sha256").update(t).digest("base64url");
const procs = [];
const run = (args, env, tag) => { const p = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); p.out = ""; p.stdout.on("data", d => (p.out += d)); p.stderr.on("data", d => (p.out += d)); p.tag = tag; procs.push(p); return p; };
const req = (port, p, headers = {}) => new Promise(res => http.get({ host: "127.0.0.1", port, path: p, headers }, x => { const c = []; x.on("data", d => c.push(d)); x.on("end", () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(c).toString() })); }).on("error", () => res({ status: 0 })));

const now = Date.now(), T = { owner: tk(), ana: tk(), bia: tk() };
const U = { owner: "u_owner", ana: "u_ana", bia: "u_bia" };
const user = (id, n) => ({ id, username: n, email: n + "@t.local", emailVerified: true, color: "#7c5cff", avatar: "", about: "oi", status: "online", salt: "SAL-SECRETO", hash: "HASH-SECRETO", created: now });
const c1 = []; for (let i = 0; i < 40; i++) c1.push({ id: "m" + i, a: i % 2 ? U.bia : U.ana, t: (i % 2 ? "bia diz " : "ana diz ") + i, ts: now - (100 - i) * 60e3 });
const dmId = "d." + [U.ana, U.bia].sort().join(".");
const state = {
  users: { [U.owner]: user(U.owner, "duduzinho5455"), [U.ana]: user(U.ana, "ana"), [U.bia]: user(U.bia, "bia") },
  sessions: Object.fromEntries(Object.entries(T).map(([k, t]) => [tokenKey(t), { userId: U[k], created: now, last: now, dev: "Windows · Chrome" }])),
  servers: { s1: { id: "s1", name: "Clube", icon: "", color: "#7c5cff", description: "", public: false, ownerId: U.owner, created: now, members: [U.owner, U.ana, U.bia], channels: [{ id: "c1", name: "geral", type: "text", topic: "" }] } },
  invites: {}, messages: { c1, [dmId]: [{ id: "dm1", a: U.bia, t: "mensagem chata no privado", ts: now }, { id: "dm2", a: U.ana, t: "minha resposta privada", ts: now + 1 }] },
  dms: { [dmId]: { id: dmId, members: [U.ana, U.bia], created: now } }, files: {}, orders: {}, migrations: ["2026-11-auryx-nexos", "2026-11-mod-santhsz"], users_friends: {}
};
state.users[U.ana].friends = { [U.bia]: "friend" };
const sock = t => new Promise(r => { const s = io(`http://127.0.0.1:${APP}`, { auth: { token: t, v: 4 }, transports: ["websocket"], reconnection: false }); s.on("ready", () => r(s)); s.on("connect_error", e => r({ error: e.message })); });
const ask = (s, ev, d) => new Promise(r => s.timeout(15000).emit(ev, d || {}, (e, x) => r(e ? { error: "timeout" } : x)));

(async () => {
  try {
    const pg = run([path.join(__dirname, "pg-ctl.mjs"), String(PG)], {}, "pg");
    for (let i = 0; i < 100 && !pg.out.includes("PGLITE_READY"); i++) await sleep(200);
    const P = new Pool({ connectionString: url, max: 1 }); P.on("error", () => {});
    await P.query("CREATE TABLE nexora_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await P.query("CREATE TABLE nexora_files (id TEXT PRIMARY KEY, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await P.query("INSERT INTO nexora_state (id, data) VALUES (1, $1::jsonb)", [JSON.stringify(state)]);
    const env = { PORT: String(APP), DATABASE_URL: url, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "ax3-")), HEALTH_FIRST_MS: "1000", HEALTH_EVERY_MS: "1500",
      GEMINI_API_KEY: "", GROQ_API_KEY: "", ANTHROPIC_API_KEY: "", RENDER: "", RESEND_API_KEY: "", ADMIN_USERS: "", BACKUP_KEY: "" };
    run([path.join(APPDIR, "server.js")], env, "app");
    for (let i = 0; i < 160 && (await req(APP, "/health")).status !== 200; i++) await sleep(250);
    const O = await sock(T.owner), A = await sock(T.ana), B = await sock(T.bia);

    console.log("\n1) Denúncias");
    const alerts = []; O.on("report:new", () => alerts.push("rep"));
    let r = await ask(A, "report", { channelId: "c1", id: "m0", kind: "spam" });
    ok(/própria/.test(r.error || ""), "não dá para denunciar a própria mensagem");
    r = await ask(A, "report", { channelId: "c1", id: "m1", kind: "xyz" });
    ok(/motivo/.test(r.error || ""), "motivo inválido é recusado");
    r = await ask(A, "report", { channelId: "c1", id: "m1", kind: "abuse", note: "me ofendeu" });
    ok(r.ok, "membro denuncia mensagem de outra pessoa");
    r = await ask(A, "report", { channelId: "c1", id: "m1", kind: "abuse" });
    ok(/já denunciou/.test(r.error || ""), "a mesma pessoa não denuncia a mesma mensagem duas vezes");
    r = await ask(A, "report", { channelId: dmId, id: "dm1", kind: "scam" });
    ok(r.ok, "denúncia de mensagem na conversa privada");
    await sleep(400);
    ok(alerts.length === 2, "ADMs recebem o aviso de denúncia nova na hora");
    r = await ask(B, "admin:reports");
    ok(/ADM/.test(r.error || ""), "pessoa comum não vê as denúncias");
    r = await ask(O, "admin:reports", { status: "open" });
    const rep = r.reports && r.reports.find(x => x.msg.id === "m1"), repDm = r.reports && r.reports.find(x => x.msg.id === "dm1");
    ok(r.open === 2 && rep && rep.author.username === "bia" && rep.reporter.username === "ana" && rep.where === "Clube › #geral" && rep.against === 2, "painel mostra autor, quem denunciou, onde e quantas denúncias a pessoa tem");
    ok(repDm && repDm.msg.t === "mensagem chata no privado", "a cópia da mensagem fica guardada na denúncia");
    let gotDel = null; A.on("msg:delete", d => (gotDel = d));
    r = await ask(O, "admin:report:decide", { id: rep.id, action: "delete", note: "ofensa" });
    ok(r.report && r.report.status === "removed", "ADM apaga a mensagem denunciada");
    await sleep(1600);
    ok(gotDel && gotDel.id === "m1", "a mensagem some na hora para quem está na conversa");
    ok(+(await P.query("SELECT count(*) AS n FROM nexora_msgs WHERE id = 'm1'")).rows[0].n === 0, "e sai do banco");
    r = await ask(O, "admin:report:decide", { id: rep.id, action: "delete" });
    ok(/já foi resolvida/.test(r.error || ""), "denúncia resolvida não é decidida duas vezes");
    r = await ask(O, "admin:report:decide", { id: repDm.id, action: "dismiss" });
    ok(r.report && r.report.status === "dismissed", "ADM arquiva denúncia sem problema");
    r = await ask(O, "admin:audit", {});
    ok(r.entries && r.entries.some(e => e.action === "report:remove") && r.entries.some(e => e.action === "report:dismiss"), "as duas decisões ficam no histórico do painel");

    console.log("\n2) Baixar meus dados (LGPD)");
    let x = await req(APP, "/api/account/export", {});
    ok(x.status === 401, "sem login não baixa nada");
    x = await req(APP, "/api/account/export", { authorization: "Bearer " + T.ana });
    let j = null; try { j = JSON.parse(x.body); } catch {}
    ok(x.status === 200 && /attachment; filename="auryx-meus-dados-ana-/.test(x.headers["content-disposition"] || ""), "baixa um arquivo JSON com o nome certo");
    ok(j && j.conta.usuario === "ana" && j.conta.email === "ana@t.local", "tem os dados da conta");
    ok(j && j.mensagens.length === 21 && j.mensagens.every(m => !/bia diz/.test(m.texto)), `só as mensagens que a ana escreveu (${j && j.mensagens.length}), nenhuma de outra pessoa`);
    ok(j && j.mensagens.some(m => m.onde === "Clube › #geral") && j.mensagens.some(m => m.onde === "Conversa com bia"), "mostra onde cada mensagem foi escrita");
    ok(j && j.amigos[0].usuario === "bia" && j.aparelhosConectados.length === 1 && j.servidores[0].nome === "Clube", "amigos, aparelhos e servidores");
    ok(!/SAL-SECRETO|HASH-SECRETO|"salt"|"hash"/.test(x.body), "a senha (nem criptografada) NÃO vai no arquivo");
    await req(APP, "/api/account/export", { authorization: "Bearer " + T.ana });
    await req(APP, "/api/account/export", { authorization: "Bearer " + T.ana });
    x = await req(APP, "/api/account/export", { authorization: "Bearer " + T.ana });
    ok(x.status === 429, "no máximo 3 por hora (evita abuso)");

    console.log("\n3) Monitoramento e alertas");
    await sleep(2500);
    let st = await ask(O, "admin:stats");
    const h = st.health;
    ok(h && h.db.ok && h.db.ms >= 0 && h.db.msgTable, `banco respondendo (${h && h.db.ms} ms) com a tabela de mensagens`);
    ok(h && h.save.last > 0 && h.save.fails === 0, "última gravação registrada, sem falhas");
    ok(h && h.http.n > 0 && h.mem.rss > 0 && typeof h.loop.p99 === "number", `tempo de resposta (${h && h.http.p95} ms), memória e lentidão medidos`);
    ok(h && h.alerts.length === 0, "nenhum alerta com tudo normal");
    ok(st.reportsOpen === 0, "contador de denúncias abertas zerado depois de resolver");
    const got = []; O.on("admin:alert", d => got.push(d));
    await req(PG + 1000, "/stop");
    await A.timeout(5000).emitWithAck("send", { channelId: "c1", text: "com o banco fora", nonce: "z1" }).catch(() => {});
    await sleep(7000);
    st = await ask(O, "admin:stats");
    ok(st.health && !st.health.db.ok, "painel mostra o banco fora do ar");
    ok(st.health && st.health.alerts.some(a => a.key === "db"), "alerta de banco ativo no painel");
    ok(got.some(a => a.key === "db"), "ADMs recebem o alerta na hora (e o dono por notificação)");
    ok(st.health && st.health.errorsHour > 0 && st.health.errors.length > 0, `erros recentes aparecem no painel (${st.health && st.health.errorsHour})`);
    await req(PG + 1000, "/start");
    await sleep(6000);
    st = await ask(O, "admin:stats");
    ok(st.health && st.health.db.ok && !st.health.alerts.some(a => a.key === "db"), "quando o banco volta, o alerta some sozinho");

    console.log("\n4) Cache dos ícones");
    x = await req(APP, "/icons/icon-192.png");
    ok(/max-age=86400/.test(x.headers["cache-control"] || ""), "ícones ficam guardados no navegador por 1 dia");
    x = await req(APP, "/app.js");
    ok(/no-cache/.test(x.headers["cache-control"] || ""), "app.js continua sempre conferindo a versão (atualização automática)");
  } catch (e) { failN++; console.log("FALHA inesperada", e && e.stack || e); }
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  if (failN) for (const p of procs) if (p.tag === "app") console.log(p.out.slice(-2500));
  for (const p of procs) try { p.kill(); } catch {}
  process.exit(failN ? 1 : 0);
})();
