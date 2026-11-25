// Testa o Agente Auryx de verdade (PowerShell) sem mexer no mouse/teclado:
// só envia comandos inofensivos ("x" desconhecido) e confere as respostas.
// Uso: node test-agente.js <caminho do nexora-agente.ps1>
"use strict";
const { spawn } = require("node:child_process");
const http = require("node:http");
const crypto = require("node:crypto");

const PS1 = process.argv[2] || require("node:path").join(__dirname, "..", "public", "agente", "nexora-agente.ps1");
const PORT = 47911;
const ORIGIN_OK = "https://auryxnexos.com.br";
let pass = 0, failN = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  OK   " + msg); } else { failN++; console.log("  FALHA " + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// abre um WebSocket "na mão" (permite escolher o Origin, como um site faria)
function wsOpen(code, origin) {
  return new Promise(resolve => {
    const key = crypto.randomBytes(16).toString("base64");
    const headers = { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": key };
    if (origin) headers.Origin = origin;
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/?t=" + encodeURIComponent(code), headers });
    req.on("upgrade", (res, sock) => {
      const msgs = [];
      let buf = Buffer.alloc(0);
      sock.on("data", d => {
        buf = Buffer.concat([buf, d]);
        while (buf.length >= 2) {
          let len = buf[1] & 127, off = 2;
          if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
          if (buf.length < off + len) break;
          if ((buf[0] & 15) === 1) msgs.push(buf.subarray(off, off + len).toString());
          buf = buf.subarray(off + len);
        }
      });
      const send = text => {
        const payload = Buffer.from(text), mask = crypto.randomBytes(4);
        const head = Buffer.from([0x81, 0x80 | payload.length]);
        const body = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
        sock.write(Buffer.concat([head, mask, body]));
      };
      resolve({ status: 101, sock, msgs, send });
    });
    req.on("response", res => { res.resume(); resolve({ status: res.statusCode }); });
    req.on("error", e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}
function startAgent(args) {
  const p = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, "-Porta", String(PORT), "-Oculto", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  p.out = "";
  p.stdout.on("data", d => (p.out += d)); p.stderr.on("data", d => (p.out += d));
  return p;
}
async function waitUp() {
  for (let i = 0; i < 60; i++) {
    const r = await new Promise(res => http.get({ host: "127.0.0.1", port: PORT, path: "/" }, x => { x.resume(); res(x.statusCode); }).on("error", () => res(0)));
    if (r === 200) return true;
    await sleep(250);
  }
  return false;
}
const exited = p => new Promise(r => { if (p.exitCode !== null) r(p.exitCode); else p.on("exit", c => r(c)); });

(async () => {
  console.log("1) Agente com código longo e origem do site");
  const code = crypto.randomBytes(24).toString("hex");
  let ag = startAgent(["-Codigo", code]);
  ok(await waitUp(), "agente compilou e abriu a porta");

  let r = await wsOpen(code, "https://site-malicioso.example");
  ok(r.status === 403, "site de fora com o código certo é recusado (403)");
  r = await wsOpen(code, null);
  ok(r.status === 403, "conexão sem Origin é recusada (403)");
  r = await wsOpen(code, ORIGIN_OK);
  ok(r.status === 101, "página do Auryx Nexos com o código certo conecta");
  if (r.sock) {
    await sleep(1500);
    const hello = r.msgs.find(m => m.startsWith("hello "));
    ok(!!hello, `agente se apresentou: "${hello || "nada"}"`);
    ok(hello && /pad=(ok|nodriver|erro)/.test(hello), "informa se o controle virtual está disponível");
    r.send("x 1 2");                       // comando desconhecido: ignorado
    r.send("px 0");                        // tirar controle que não existe: ignorado
    await sleep(300);
    ok(ag.exitCode === null, "comandos inválidos não derrubam o agente");
    r.sock.destroy();
    await sleep(800);
  }
  console.log("2) Bloqueio depois de 5 códigos errados");
  for (let i = 1; i <= 5; i++) { r = await wsOpen("errado" + i, ORIGIN_OK); }
  const c = await Promise.race([exited(ag), sleep(8000).then(() => "vivo")]);
  ok(c === 2, `agente fechou sozinho por segurança (código de saída ${c})`);
  if (ag.exitCode === null) ag.kill();

  console.log("3) Fecha junto com o app de PC (-PaiPid)");
  const pai = spawn(process.execPath, ["-e", "setTimeout(()=>{}, 60000)"], { stdio: "ignore" });
  ag = startAgent(["-Codigo", code, "-PaiPid", String(pai.pid)]);
  ok(await waitUp(), "agente abriu com -PaiPid");
  pai.kill();
  const c2 = await Promise.race([exited(ag), sleep(6000).then(() => "vivo")]);
  ok(c2 === 0, `agente fechou quando o app pai fechou (saída ${c2})`);
  if (ag.exitCode === null) ag.kill();

  console.log("4) Agente baixado (código de 6 números)");
  ag = startAgent([]);
  ok(await waitUp(), "agente sem código gera um código de 6 números");
  ag.kill();
  console.log(`\n${pass} ok, ${failN} falha(s)`);
  if (failN) console.log("Saída do agente:\n" + ag.out.slice(-1500));
  process.exit(failN ? 1 : 0);
})();
