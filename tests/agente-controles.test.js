// Teste real dos controles virtuais: agente (PowerShell) + driver ViGEmBus + leitura pelo XInput.
// Uso: node test-pads.js <nexora-agente.ps1> <xinput-ler.ps1>
"use strict";
const { spawn, execFileSync } = require("node:child_process");
const http = require("node:http");
const crypto = require("node:crypto");
const PS1 = process.argv[2] || require("node:path").join(__dirname, "..", "public", "agente", "nexora-agente.ps1"), LER = process.argv[3] || require("node:path").join(__dirname, "xinput-ler.ps1");
const PORT = 47912, ORIGIN = "http://teste.local", CODE = crypto.randomBytes(16).toString("hex");
let pass = 0, failN = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  OK    " + msg); } else { failN++; console.log("  FALHA " + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const xinput = () => JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", LER]).toString().trim());
const on = s => s.filter(x => x.on);

function wsOpen() {
  return new Promise(resolve => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/?t=" + CODE, headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"), Origin: ORIGIN } });
    req.on("upgrade", (res, sock) => {
      const msgs = []; let buf = Buffer.alloc(0);
      sock.on("error", () => {});
      sock.on("data", d => { buf = Buffer.concat([buf, d]); while (buf.length >= 2) { let len = buf[1] & 127, off = 2; if (len === 126) { len = buf.readUInt16BE(2); off = 4; } if (buf.length < off + len) break; if ((buf[0] & 15) === 1) msgs.push(buf.subarray(off, off + len).toString()); buf = buf.subarray(off + len); } });
      const send = text => { const p = Buffer.from(text), m = crypto.randomBytes(4); const head = p.length < 126 ? Buffer.from([0x81, 0x80 | p.length]) : Buffer.from([0x81, 0xfe, p.length >> 8, p.length & 255]); sock.write(Buffer.concat([head, m, Buffer.from(p.map((b, i) => b ^ m[i % 4]))])); };
      resolve({ sock, msgs, send });
    });
    req.on("response", r => { r.resume(); resolve(null); });
    req.on("error", () => resolve(null));
    req.end();
  });
}
async function waitUp() { for (let i = 0; i < 60; i++) { const r = await new Promise(res => http.get({ host: "127.0.0.1", port: PORT }, x => { x.resume(); res(x.statusCode); }).on("error", () => res(0))); if (r === 200) return true; await sleep(250); } return false; }
const waitMsg = async (ws, re, ms = 8000) => { for (let t = 0; t < ms; t += 100) { const m = ws.msgs.find(x => re.test(x)); if (m) return m; await sleep(100); } return null; };

(async () => {
  const antes = on(xinput());
  console.log(`Controles no XInput antes do teste: ${antes.length}`);
  const ag = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, "-Porta", String(PORT), "-Codigo", CODE, "-Oculto", "-Origens", ORIGIN], { stdio: "ignore" });
  ok(await waitUp(), "agente abriu");
  const ws = await wsOpen();
  ok(!!ws, "página conectou no agente");
  const hello = await waitMsg(ws, /^hello /);
  ok(hello === "hello 2 pad=ok", `agente encontrou o driver: "${hello}"`);

  console.log("1) Amigo 1: X apertado, RT pela metade, analógico esquerdo para a direita e para cima");
  ws.send("p 0 16384 0 128 20000 15000 0 0");
  const r0 = await waitMsg(ws, /^pad 0 /);
  ok(r0 && r0.startsWith("pad 0 ok"), `controle virtual 1 criado: "${r0}"`);
  await sleep(400);
  let s = on(xinput()).filter(x => !antes.some(a => a.slot === x.slot));
  ok(s.length === 1, `o Windows enxerga 1 controle novo (XInput) — slot ${s.map(x => x.slot)}`);
  const p1 = s[0] || {};
  ok(p1.btn === 16384 && p1.rt === 128 && p1.lx === 20000 && p1.ly === 15000, `valores chegaram certos: botões=${p1.btn} RT=${p1.rt} LX=${p1.lx} LY=${p1.ly}`);

  console.log("2) Amigo 2 ao mesmo tempo: LT apertado e analógico direito para baixo");
  ws.send("p 1 0 255 0 0 0 0 -32768");
  const r1 = await waitMsg(ws, /^pad 1 /);
  ok(r1 && r1.startsWith("pad 1 ok"), `controle virtual 2 criado: "${r1}"`);
  await sleep(400);
  s = on(xinput()).filter(x => !antes.some(a => a.slot === x.slot));
  ok(s.length === 2, `o Windows enxerga 2 controles DIFERENTES — slots ${s.map(x => x.slot).join(" e ")}`);
  const p2 = s.find(x => x.slot !== p1.slot) || {};
  ok(p2.lt === 255 && p2.ry === -32768 && p2.btn === 0, `controle 2 independente do 1: LT=${p2.lt} RY=${p2.ry} botões=${p2.btn}`);
  ok(r0 && +r0.split(" ")[3] === p1.slot && r1 && +r1.split(" ")[3] === p2.slot, `número do jogador informado bate com o Windows (Jogador ${p1.slot + 1} e Jogador ${p2.slot + 1})`);
  const p1b = s.find(x => x.slot === p1.slot) || {};
  ok(p1b.btn === 16384 && p1b.rt === 128, "controle 1 continua com os próprios valores");

  console.log("3) Soltar tudo e tirar o controle 1");
  ws.send("p 0 0 0 0 0 0 0 0");
  await sleep(300);
  s = on(xinput()).filter(x => x.slot === p1.slot);
  ok(s[0] && s[0].btn === 0 && s[0].rt === 0 && s[0].lx === 0, "controle 1 solto (tudo zerado)");
  ws.send("px 0");
  await sleep(1200);
  s = on(xinput()).filter(x => !antes.some(a => a.slot === x.slot));
  ok(s.length === 1 && s[0].slot === p2.slot, `controle 1 removido do Windows; sobrou só o 2 (slot ${s.map(x => x.slot)})`);

  console.log("4) Conexão termina: nenhum controle pode ficar ligado");
  ws.sock.destroy();
  await sleep(2000);
  s = on(xinput()).filter(x => !antes.some(a => a.slot === x.slot));
  ok(s.length === 0, "ao desconectar, o agente removeu todos os controles virtuais");

  console.log("5) Agente fechado à força no meio do jogo");
  const ws2 = await wsOpen();
  ws2.send("p 2 4096 0 0 0 0 0 0");
  await waitMsg(ws2, /^pad 2 /);
  await sleep(300);
  ok(on(xinput()).length === antes.length + 1, "controle criado de novo");
  ag.kill();
  await sleep(2500);
  ok(on(xinput()).length === antes.length, "agente morto = controle some sozinho do Windows (nada fica preso)");
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  process.exit(failN ? 1 : 0);
})();
