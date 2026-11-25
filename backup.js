/**
 * Auryx Nexos — formato dos backups (usado pelo servidor e pelo script de restauração)
 *
 * Arquivo de backup = JSON compactado com gzip:
 *   { app, version: 2, at, db: { ...estado, messages: { canal: [todas as mensagens] } } }
 * Com BACKUP_KEY definido, o .json.gz é criptografado antes de sair do servidor:
 *   "AXB1" + iv (12 bytes) + tag (16 bytes) + dados (AES-256-GCM)
 * A chave vem da senha BACKUP_KEY (scrypt). Sem a senha, o backup criptografado não abre:
 * guarde-a fora do Render (gerenciador de senhas).
 */
"use strict";
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const MAGIC = Buffer.from("AXB1");
const keyOf = pass => (pass ? crypto.scryptSync(String(pass), "auryx-nexos-backup-v1", 32) : null);
const isEncrypted = buf => Buffer.isBuffer(buf) && buf.length > 32 && buf.subarray(0, 4).equals(MAGIC);
const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");

function encrypt(gz, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(gz), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), data]);
}
function decrypt(buf, key) {
  if (!isEncrypted(buf)) return buf;
  if (!key) throw new Error("Este backup está criptografado: defina BACKUP_KEY com a mesma senha usada no servidor.");
  const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  try { return Buffer.concat([d.update(buf.subarray(32)), d.final()]); }
  catch { throw new Error("Senha do backup (BACKUP_KEY) errada ou arquivo corrompido."); }
}
// Confere um backup sem carregar o JSON inteiro na memória: abre, descompacta e calcula o SHA-256 do conteúdo.
function plainHash(buf, key) {
  return new Promise((resolve, reject) => {
    let gz;
    try { gz = decrypt(buf, key); } catch (e) { return reject(e); }
    const h = crypto.createHash("sha256"), g = zlib.createGunzip();
    let n = 0;
    g.on("data", c => { h.update(c); n += c.length; });
    g.on("end", () => resolve({ sha: h.digest("hex"), bytes: n }));
    g.on("error", () => reject(new Error("O arquivo do backup está corrompido (não descompacta).")));
    g.end(gz);
  });
}
// Abre o backup inteiro (só no script de restauração)
function open(buf, key) {
  const json = zlib.gunzipSync(decrypt(buf, key)).toString("utf8");
  const j = JSON.parse(json);
  if (!j || typeof j !== "object" || !j.db || typeof j.db.users !== "object") throw new Error("Esse arquivo não é um backup da Auryx.");
  return j;
}
module.exports = { MAGIC, keyOf, isEncrypted, sha256, encrypt, decrypt, plainHash, open };
