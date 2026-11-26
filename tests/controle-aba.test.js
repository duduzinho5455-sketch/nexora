// Co-op com controles: usa o código REAL do app.js (lado de quem transmite e lado de quem joga junto)
// com o agente e a rede simulados. Confere que o controle nunca vira teclado, que cada controle vira
// um controle virtual separado e que a aba Controles liga/desliga, identifica e reordena os jogadores.
// Uso: node controle-aba.test.js [app.js] [saida.html]   (saida.html = foto da aba para conferir o visual)
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "public", "app.js"), "utf8");
const pick = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error("trecho não achado: " + from); return src.slice(a, b); };

const prelude = `
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ic = n => "<svg data-ic='" + n + "'></svg>";
const avatar = (u, n) => "<span class='av'>" + esc(u.username[0]) + "</span>";
const USERS = { u1: { username: "dono" }, u2: { username: "amigo" } };
const user = id => USERS[id] || { username: "?" };
const LOG = { toasts: [], sig: [], agent: [], dc: [] };
const toast = (t, type) => LOG.toasts.push(t);
const sig = (to, data) => LOG.sig.push({ to, data });
const store = { get: (k, d) => d, set() {} };
const S = { settings: {} };
const DESKTOP = null;
let PADS = [];
const navigator = { getGamepads: () => PADS };
const requestAnimationFrame = () => 0;
const setTimeout = () => 0, clearTimeout = () => {}, setInterval = () => 1, clearInterval = () => {};
const renderCtrlBar = () => {};
const modal = () => {};
const sfx = () => {}, schedule = () => {}, openChannel = () => {};
const $ = () => null, $$ = () => [];
const document = { pointerLockElement: null };
`;
const vDecl = pick("const V = {", "const srv = ()");
const coop = pick("/* Controle remoto e co-op pela tela", "function renderCtrlBar()");
const code = prelude + vDecl + coop.replace(/const agentSend = line => \{[^\n]*\};/, "const agentSend = line => { LOG.agent.push(line); };")
  + `
AG.ws = { readyState: 1, send: l => LOG.agent.push(l) }; AG.ver = 3; AG.pad = "ok";
module.exports = { V, AG, LOG, onRemoteInput, onAgentMsg, onCtrlPads, onGranted, onCtrlPad, onCtrlPadCfg, padLoop, padPanelHTML, padEntries, padApply, padMine, padKey, KB_PAD, PAD_IDLE,
  setPads: p => { PADS = p; }, dcLines: () => LOG.dc };
`;
const m = new module.constructor();
m.paths = module.paths;
m._compile(code.replace("function dcSend(line) {", "function dcSend(line) { LOG.dc.push(line); return;"), "trecho-coop.js");
const T = m.exports;

let pass = 0, fail = 0;
const ok = (c, msg, extra = "") => { if (c) { pass++; console.log("  OK    " + msg); } else { fail++; console.log("  FALHA " + msg + " " + extra); } };
const gp = (index, id, pressed = []) => ({ index, id, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });

// ---------- lado de quem joga junto (amigo) ----------
console.log("1) PC de quem transmite SEM driver: o controle não vira teclado");
const hostPeer = { sock: "sockDono", userId: "u1" };
T.V.peers.set("sockDono", hostPeer);
T.onGranted(hostPeer, "coop", 0);
T.setPads([gp(0, "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", [0, 12])]);
T.LOG.dc.length = 0;
T.V.controlling.looping = false; T.padLoop();
ok(!T.dcLines().some(l => /^k /.test(l)), "nenhuma tecla enviada pelo controle", JSON.stringify(T.dcLines()));
ok(!T.dcLines().some(l => /^p /.test(l)), "nenhum estado de controle enviado (sem driver não há para onde mandar)");
const lista = T.LOG.sig.find(s => s.data.ctrlPads);
ok(lista && lista.data.ctrlPads[0].name === "Xbox Wireless Controller", `lista de controles mandada para quem transmite: ${JSON.stringify(lista && lista.data.ctrlPads)}`);

console.log("2) Com driver: 2 controles do amigo viram 2 controles separados");
T.onGranted(hostPeer, "coop", 2);
T.LOG.dc.length = 0; T.LOG.sig.length = 0;
T.setPads([gp(0, "Xbox Wireless Controller (x)", [0]), gp(1, "DualSense Wireless Controller (y)", [9])]);
T.V.controlling.looping = false; T.padLoop();
const pl = T.dcLines().filter(l => /^p /.test(l));
ok(pl.length === 2 && pl[0].startsWith("p 0 4096 ") && pl[1].startsWith("p 1 16 "), `controle 1 = A, controle 2 = Start: ${JSON.stringify(pl)}`);
ok(!T.dcLines().some(l => /^k /.test(l)), "e nenhuma tecla");
const lista2 = (T.LOG.sig.find(s => s.data.ctrlPads) || {}).data;
ok(lista2 && lista2.ctrlPads.length === 2, "lista com os 2 controles enviada");

// ---------- lado de quem transmite (dono) ----------
console.log("3) Quem transmite recebe: cada controle vira um controle virtual (vaga própria)");
const friendPeer = { sock: "sockAmigo", userId: "u2" };
T.V.granted.set("sockAmigo", { uid: "u2", mode: "coop", pad: true, pads: new Map(), info: [], off: new Set(), act: new Map(), last: 0 });
const g = T.V.granted.get("sockAmigo");
T.onCtrlPads(friendPeer, lista2.ctrlPads);
ok(g.info.length === 2 && g.info[1].name === "DualSense Wireless Controller", "dono sabe os nomes dos 2 controles");
T.LOG.agent.length = 0;
T.onRemoteInput(friendPeer, pl.join("\n"));
ok(T.LOG.agent.length === 1 && /^p 0 4096 /m.test(T.LOG.agent[0]) && /^p 1 16 /m.test(T.LOG.agent[0]), `agente recebeu os 2 controles em vagas separadas: ${JSON.stringify(T.LOG.agent)}`);
T.onAgentMsg("pad 0 ok 1"); T.onAgentMsg("pad 1 ok 2");
ok(T.V.padPlayer.get(0) === 2 && T.V.padPlayer.get(1) === 3, "Windows: controle 1 = Jogador 2, controle 2 = Jogador 3 (o dono é o Jogador 1)");
ok(T.LOG.sig.some(s => s.data.ctrlPad && s.data.ctrlPad.i === 1 && s.data.ctrlPad.player === 3), "amigo é avisado do número de jogador de cada controle");
T.LOG.agent.length = 0;
T.onRemoteInput(friendPeer, "k 1 65 0");
ok(T.LOG.agent.join() === "k 1 65 0", "teclado de verdade do amigo continua funcionando (digitar no co-op)");

console.log("4) Aba Controles: lista, liga/desliga e reordena");
T.onAgentMsg("pads f0 v0 v1 -");
let html = T.padPanelHTML();
ok(/Jogador 1<\/b><span><span><b>Seu controle/.test(html), "mostra o controle do dono como Jogador 1");
ok(html.indexOf("Jogador 2") < html.indexOf("Jogador 3") && /amigo · controle 1/.test(html) && /DualSense/.test(html), "mostra os 2 controles do amigo com nome e jogador");
ok(!/teclado/i.test(html.replace(/nunca como teclado|teclado"|· teclado/g, "")), "nenhuma opção de virar teclado na aba");
// reordena: controle 2 (DualSense) passa a ser o Jogador 2
const ents = T.padEntries();
T.V.padOrder = [T.padKey(ents[1]), T.padKey(ents[0])]; T.V.padOrderTouched = true;
T.LOG.agent.length = 0;
T.padApply();
ok(T.LOG.agent[0] === "po 1 0", `manda o agente religar na nova ordem: "${T.LOG.agent[0]}"`);
T.onRemoteInput(friendPeer, "p 0 4096 0 0 0 0 0 0");
ok(!T.LOG.agent.some(l => /^p /.test(l)), "enquanto troca, estado de controle não é misturado");
T.LOG.sig.length = 0; T.LOG.toasts.length = 0;
T.onAgentMsg("pad 1 ok 1"); T.onAgentMsg("pad 0 ok 2");
ok(T.V.padPlayer.get(1) === 2 && T.V.padPlayer.get(0) === 3 && T.V.padBusy === null, "ordem nova: DualSense = Jogador 2, Xbox = Jogador 3");
ok(T.LOG.sig.every(s => !s.data.ctrlPad || s.data.ctrlPad.quiet), "amigo recebe o número novo sem avisos repetidos");
ok(T.LOG.toasts.some(t => /Ordem aplicada — Jogador 2: amigo · Jogador 3: amigo/.test(t)), `dono vê o resumo: ${T.LOG.toasts.join(" | ")}`);
html = T.padPanelHTML();
ok(html.indexOf("DualSense") < html.indexOf("Xbox Wireless"), "a lista mostra a ordem nova");
// desliga o controle 1 do amigo
T.LOG.sig.length = 0; T.LOG.agent.length = 0;
g.off.add(0); const s0 = g.pads.get(0); g.pads.delete(0); T.V.padUsed.delete(s0);
T.onRemoteInput(friendPeer, "p 0 4096 0 0 0 0 0 0\np 1 0 0 0 0 0 0 0");
ok(!T.LOG.agent.join("\n").includes("p 0 "), "controle desligado na aba não chega no PC");

console.log("5) Amigo recebe 'desligado' e para de mandar aquele controle");
T.onCtrlPadCfg(hostPeer, { off: [0] });
T.LOG.dc.length = 0;
T.setPads([gp(0, "Xbox (x)", [1]), gp(1, "DualSense (y)", [1])]);
T.V.controlling.looping = false; T.padLoop();
ok(!T.dcLines().some(l => l.startsWith("p 0 ")) && T.dcLines().some(l => l.startsWith("p 1 ")), `só o controle ligado é enviado: ${JSON.stringify(T.dcLines())}`);
T.padMine(1, false);
ok(T.dcLines().includes("px 1"), "o próprio amigo também pode desligar um controle (ex.: DS4Windows duplicado)");

if (process.argv[3]) {
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");
  T.onAgentMsg("pads f4096 v1 v0 -");
  g.act.set(1, Date.now());
  fs.writeFileSync(process.argv[3], `<!doctype html><meta charset="utf-8"><style>${css}</style><body data-theme="dark" style="padding:30px;background:#111"><div class="modal padp" style="position:static;margin:auto"><header class="modal-head"><h2>Controles do co-op</h2><p>Veja cada controle, identifique qual é qual e escolha quem é o Jogador 1, 2, 3…</p></header><div class="modal-body">${T.padPanelHTML()}</div></div></body>`);
}
console.log(`\n${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
