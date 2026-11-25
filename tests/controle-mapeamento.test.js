// Testa a conversão controle do navegador -> controle de Xbox virtual usando o código real do app.js
"use strict";
const fs = require("node:fs");
const src = fs.readFileSync(process.argv[2] || require("node:path").join(__dirname, "..", "public", "app.js"), "utf8");
const pick = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error("trecho não achado: " + from); return src.slice(a, b); };
const code = [
  "const clamp = (v, a, b) => Math.min(b, Math.max(a, v));",
  pick("const KBPAD = {", "function sendPad("),
  pick("const XB_BTN = [", "// Controle (gamepad) de quem controla")
].join("\n") + "\nmodule.exports = { padState, kbPadState, PAD_IDLE };";
const m = new module.constructor(); m._compile(code, "trecho.js");
const { padState, kbPadState, PAD_IDLE } = m.exports;
let pass = 0, fail = 0;
const ok = (c, msg, extra = "") => { if (c) { pass++; console.log("  OK    " + msg); } else { fail++; console.log("  FALHA " + msg + " " + extra); } };
const pad = (pressed = [], axes = [0, 0, 0, 0], values = {}) => ({ mapping: "standard", axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: values[i] !== undefined ? values[i] : pressed.includes(i) ? 1 : 0 })) });
const parse = s => { const [b, lt, rt, lx, ly, rx, ry] = s.split(" ").map(Number); return { b, lt, rt, lx, ly, rx, ry }; };

let s = parse(padState(pad()));
ok(padState(pad()) === PAD_IDLE, "controle parado = estado neutro (não manda nada à toa)");
s = parse(padState(pad([0])));            ok(s.b === 0x1000, "A (Xbox) / X (PlayStation) -> A");
s = parse(padState(pad([1])));            ok(s.b === 0x2000, "B / Círculo -> B");
s = parse(padState(pad([2])));            ok(s.b === 0x4000, "X / Quadrado -> X");
s = parse(padState(pad([3])));            ok(s.b === 0x8000, "Y / Triângulo -> Y");
s = parse(padState(pad([9])));            ok(s.b === 0x0010, "Start / Options -> Start (entrar no jogo como Jogador 2)");
s = parse(padState(pad([12, 15])));       ok(s.b === (0x0001 | 0x0008), "direcional cima + direita");
s = parse(padState(pad([4, 5])));         ok(s.b === (0x0100 | 0x0200), "LB + RB");
s = parse(padState(pad([6, 7], undefined, { 6: 0.5, 7: 1 }))); ok(s.lt === 128 && s.rt === 255, `gatilhos analógicos LT=${s.lt} RT=${s.rt}`);
s = parse(padState(pad([], [0, -1, 0, 0]))); ok(s.ly === 32767, `analógico para CIMA vira Y positivo (${s.ly})`);
s = parse(padState(pad([], [1, 0, 0, 1])));  ok(s.lx === 32767 && s.ry === -32767, `direita e analógico direito para baixo (LX=${s.lx} RY=${s.ry})`);
s = parse(padState(pad([], [0.05, -0.08, 0.09, 0]))); ok(s.lx === 0 && s.ly === 0 && s.rx === 0, "zona morta: drift pequeno não move o personagem");
ok(!/-0\b/.test(padState(pad([], [0, 0.0001, 0, 0.0001]))), "sem \"-0\" na linha");
s = parse(kbPadState(new Set(["KeyW", "KeyD", "Space", "KeyZ"]))); ok(s.ly === 32767 && s.lx === 32767 && s.b === 0x1000 && s.lt === 255, "teclado como controle: W+D andam na diagonal, Espaço = A, Z = LT");
s = parse(kbPadState(new Set(["KeyA", "KeyD"]))); ok(s.lx === 0, "A + D juntos se anulam");
s = parse(kbPadState(new Set(["Enter", "ArrowUp"]))); ok(s.b === (0x0010 | 0x0001), "Enter = Start, seta = direcional");
console.log(`\n${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
