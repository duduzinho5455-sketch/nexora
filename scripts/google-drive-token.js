#!/usr/bin/env node
/**
 * Auryx Nexos — gera o GDRIVE_REFRESH_TOKEN para os backups irem para o seu Google Drive.
 * Roda UMA vez, no seu PC.
 *
 * 1. Google Cloud Console (console.cloud.google.com): crie um projeto, ative a "Google Drive API",
 *    configure a tela de consentimento (tipo "Externo", publique o app para o token não vencer em 7 dias)
 *    e crie uma credencial "ID do cliente OAuth" do tipo "App para computador".
 * 2. No PowerShell, dentro da pasta do projeto:
 *      $env:GDRIVE_CLIENT_ID="...";  $env:GDRIVE_CLIENT_SECRET="...";  node scripts/google-drive-token.js
 * 3. Abra o link que aparecer, entre na conta Google que vai guardar os backups e aceite.
 * 4. Copie os três valores mostrados para o Render (Environment): GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET
 *    e GDRIVE_REFRESH_TOKEN. Opcional: GDRIVE_FOLDER_ID (id da pasta) e GDRIVE_KEEP (quantas cópias manter, padrão 14).
 *
 * Permissão pedida: drive.file — o app só enxerga os arquivos que ele mesmo criou, nada mais do seu Drive.
 */
"use strict";
const http = require("node:http");
const crypto = require("node:crypto");

const ID = process.env.GDRIVE_CLIENT_ID || "", SECRET = process.env.GDRIVE_CLIENT_SECRET || "";
if (!ID || !SECRET) { console.error("\n  Defina GDRIVE_CLIENT_ID e GDRIVE_CLIENT_SECRET antes (veja as instruções no começo deste arquivo).\n"); process.exit(1); }
const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("hex");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  if (u.pathname !== "/") { res.writeHead(404); res.end(); return; }
  const code = u.searchParams.get("code");
  if (u.searchParams.get("state") !== state || !code) { res.end("Autorização cancelada ou inválida. Pode fechar esta aba."); return; }
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: ID, client_secret: SECRET, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: verifier })
  }).catch(e => ({ ok: false, json: async () => ({ error: e.message }) }));
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) {
    res.end("Não deu certo. Veja a mensagem no terminal.");
    console.error("\n  O Google não devolveu o refresh token:", j.error || r.status, j.error_description || "");
    console.error("  Dica: revogue o acesso em myaccount.google.com/permissions e rode de novo.\n");
  } else {
    res.end("Pronto! Volte para o terminal e copie os valores para o Render. Pode fechar esta aba.");
    console.log("\n  Copie para o Render (Environment):\n");
    console.log("  GDRIVE_CLIENT_ID=" + ID);
    console.log("  GDRIVE_CLIENT_SECRET=" + SECRET);
    console.log("  GDRIVE_REFRESH_TOKEN=" + j.refresh_token + "\n");
  }
  setTimeout(() => process.exit(0), 300);
});
server.listen(0, "127.0.0.1", () => {
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: ID, redirect_uri: redirect, response_type: "code", scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline", prompt: "consent", code_challenge: challenge, code_challenge_method: "S256", state
  });
  console.log("\n  Abra este link no navegador e autorize com a conta Google dos backups:\n\n  " + url + "\n\n  (esperando a autorização…)");
});
