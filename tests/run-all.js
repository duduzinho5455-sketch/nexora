#!/usr/bin/env node
/**
 * Roda todos os testes do Auryx Nexos e mostra um resumo.
 *
 *   cd tests
 *   npm install --legacy-peer-deps      (uma vez)
 *   npm test
 *
 * Os testes sobem o servidor de verdade (server.js) contra um PostgreSQL local em memória (PGlite),
 * com Google Drive, Gemini e Groq falsos — não usam nenhuma chave real nem o banco de produção.
 * No Windows também testam o Agente Auryx (PowerShell); o teste dos controles virtuais só roda
 * se o driver ViGEmBus estiver instalado.
 */
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const win = process.platform === "win32";
const vigem = win && /RUNNING/.test(spawnSync("sc", ["query", "ViGEmBus"], { encoding: "utf8" }).stdout || "");
const suites = [
  ["banco-e-backup.test.js", "Banco, mensagens, sessões, backup e restauração"],
  ["modo-arquivo.test.js", "Servidor sem PostgreSQL (arquivo local)"],
  ["aury-fixadas-pesquisa.test.js", "Aury (parar, tentar de novo, troca de provedor), fixadas e pesquisa"],
  ["denuncias-dados-saude.test.js", "Denúncias, Baixar meus dados e saúde do servidor"],
  ["controle-mapeamento.test.js", "Controle do navegador -> controle de Xbox"],
  ["controle-aba.test.js", "Co-op: controles nunca viram teclado + aba Controles (Jogador 1, 2…)"],
  ["email.test.js", "E-mail: Esqueci a senha, diagnóstico do Resend e e-mail de teste"],
  win && ["agente-seguranca.test.js", "Agente Auryx: segurança"],
  vigem && ["agente-controles.test.js", "Agente Auryx: controles virtuais (ViGEmBus)"]
].filter(Boolean);

const only = process.argv[2];
let total = 0, fails = 0;
const rows = [];
for (const [file, name] of suites) {
  if (only && !file.includes(only)) continue;
  process.stdout.write(`\n▶ ${name}\n`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { cwd: __dirname, encoding: "utf8", timeout: 10 * 60e3 });
  const out = (r.stdout || "") + (r.stderr || "");
  const m = /(\d+) ok, (\d+) falha/.exec(out);
  const ok = m ? +m[1] : 0, bad = m ? +m[2] : 1;
  total += ok; fails += bad;
  if (bad || r.status !== 0) process.stdout.write(out.split("\n").filter(l => /FALHA|Error|erro/i.test(l)).slice(0, 30).join("\n") + "\n");
  rows.push([name, ok, bad, ((Date.now() - t0) / 1000).toFixed(0) + " s"]);
  process.stdout.write(`  ${bad ? "❌" : "✅"} ${ok} ok, ${bad} falha(s)\n`);
}
console.log("\nResumo:");
for (const [n, ok, bad, t] of rows) console.log(`  ${bad ? "❌" : "✅"} ${n}: ${ok} ok, ${bad} falha(s) (${t})`);
if (!win) console.log("  (testes do Agente Auryx só rodam no Windows)");
else if (!vigem) console.log("  (teste dos controles virtuais pulado: driver ViGEmBus não instalado)");
console.log(`\nTotal: ${total} ok, ${fails} falha(s)`);
void fs;
process.exit(fails ? 1 : 0);
