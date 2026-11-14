/**
 * NEXORA — servidor
 * HTTP estático (com gzip + ETag em memória), API de conta, Socket.IO para
 * chat/servidores/convites e sinalização WebRTC para voz, câmera e tela.
 * Requer Node.js 18+. Única dependência: socket.io
 */
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "nexora.json");

const HISTORY_KEEP = 500;      // mensagens guardadas por canal
const PAGE_SIZE = 50;          // mensagens por página de histórico
const VOICE_LIMIT = 12;        // pessoas por sala de voz (malha P2P)
const MAX_SERVERS_PER_USER = 100;
const MAX_CHANNELS = 60;
const MAX_MEMBERS = 1000;
const SESSION_TTL = 60 * 24 * 3600e3;

const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
if (process.env.TURN_URL) {
  ICE_SERVERS.push({
    urls: process.env.TURN_URL.split(",").map(s => s.trim()).filter(Boolean),
    username: process.env.TURN_USER || "",
    credential: process.env.TURN_PASS || ""
  });
}

/* ------------------------------------------------------------------ */
/* Persistência: PostgreSQL quando DATABASE_URL existe (Render),        */
/* senão arquivo JSON local. Gravações agrupadas para economizar.      */
/* ------------------------------------------------------------------ */
const DATABASE_URL = process.env.DATABASE_URL || "";
let pg = null;
const db = { users: {}, sessions: {}, servers: {}, invites: {}, messages: {}, dms: {} };
const byName = new Map();          // nome em minúsculas -> id do usuário
const chanIndex = new Map();       // id do canal -> id do servidor

async function loadDb() {
  if (DATABASE_URL) {
    const { Pool } = require("pg");
    const ssl = process.env.NODE_ENV === "production" || /render\.com|sslmode=require/.test(DATABASE_URL) ? { rejectUnauthorized: false } : false;
    pg = new Pool({ connectionString: DATABASE_URL, ssl, max: 3 });
    await pg.query("CREATE TABLE IF NOT EXISTS nexora_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const r = await pg.query("SELECT data FROM nexora_state WHERE id = 1");
    if (r.rows[0]) Object.assign(db, r.rows[0].data);
    console.log("  Banco: PostgreSQL");
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    try {
      Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
    } catch (e) {
      if (e.code !== "ENOENT") {
        const backup = DB_FILE + ".corrompido-" + Date.now();
        try { fs.copyFileSync(DB_FILE, backup); } catch {}
        console.error("Banco ilegível; cópia salva em", backup);
      }
    }
    console.log("  Banco:", DB_FILE);
  }
  for (const u of Object.values(db.users)) byName.set(u.username.toLowerCase(), u.id);
  for (const s of Object.values(db.servers)) for (const c of s.channels) chanIndex.set(c.id, s.id);
  const now = Date.now();
  for (const [k, v] of Object.entries(db.sessions)) if (!db.users[v.userId] || now - v.created > SESSION_TTL) delete db.sessions[k];
}

async function writeDb() {
  const json = JSON.stringify(db);
  if (pg) {
    await pg.query("INSERT INTO nexora_state (id, data, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()", [json]);
  } else {
    const tmp = DB_FILE + ".tmp";
    await fsp.writeFile(tmp, json);
    await fsp.rename(tmp, DB_FILE);
  }
}

let saveTimer = null, saving = false, dirty = false;
function save() {
  dirty = true;
  if (!saveTimer) saveTimer = setTimeout(flush, 1000);
}
async function flush() {
  saveTimer = null;
  if (saving) { saveTimer = setTimeout(flush, 400); return; }
  if (!dirty) return;
  saving = true; dirty = false;
  try {
    await writeDb();
  } catch (e) {
    console.error("Falha ao salvar:", e.message);
    dirty = true;
    if (!saveTimer) saveTimer = setTimeout(flush, 3000);
  } finally { saving = false; }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const newId = () => crypto.randomBytes(9).toString("base64url");
const msgId = () => Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
const tokenKey = t => crypto.createHash("sha256").update(t).digest("base64url");
const COLORS = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#a78bfa", "#fb923c", "#2dd4bf"];
const pick = a => a[Math.floor(Math.random() * a.length)];
const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");
const isColor = c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
function cleanPic(v) {
  if (typeof v !== "string") return "";
  if (v.startsWith("data:")) return v.length <= 60000 && IMG_RE.test(v) ? v : "";
  return str(v, 16);
}
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(n = 8) {
  const b = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}
function parseCode(input) {
  const s = str(input, 200);
  const last = s.split(/[/?=#]/).filter(Boolean).pop() || "";
  return last.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
}
function scrypt(pw, salt) {
  return new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
}
class UserError extends Error {}
const fail = msg => { throw new UserError(msg); };

/* ------------------------------------------------------------------ */
/* Visões públicas                                                     */
/* ------------------------------------------------------------------ */
const online = new Map();   // userId -> Set<socketId>
const voice = new Map();    // socketId -> estado de voz

function presence(u) {
  if (!online.has(u.id)) return "offline";
  return u.status === "invisible" ? "offline" : (u.status || "online");
}
function gameOf(u) {
  if (u.steamGame) return u.steamGame;
  return u.game ? { name: u.game } : null;
}
function pubUser(u) {
  return { id: u.id, username: u.username, color: u.color, avatar: u.avatar || "", about: u.about || "", status: presence(u), created: u.created, steam: u.steam || "", game: presence(u) === "offline" ? null : gameOf(u) };
}
/* amigos e mensagens privadas */
const friendsOf = u => (u && u.friends) || {};
const dmIdOf = (a, b) => "d." + [a, b].sort().join(".");
function dmView(d, viewer) {
  const list = db.messages[d.id];
  const last = list && list.length ? list[list.length - 1] : null;
  return { id: d.id, userId: d.members.find(x => x !== viewer) || viewer, created: d.created, last: last ? { id: last.id, ts: last.ts, a: last.a } : null };
}
const dmsOf = uid => Object.values(db.dms || {}).filter(d => d.members.includes(uid));
function chanView(c) {
  const list = db.messages[c.id];
  const last = list && list.length ? list[list.length - 1] : null;
  return { id: c.id, name: c.name, type: c.type, topic: c.topic || "", last: last ? { id: last.id, ts: last.ts, a: last.a } : null };
}
function serverMeta(s) {
  return { id: s.id, name: s.name, icon: s.icon || "", color: s.color, description: s.description || "", public: !!s.public, ownerId: s.ownerId, created: s.created };
}
function serverView(s) {
  return { ...serverMeta(s), channels: s.channels.map(chanView), members: s.members.slice() };
}
function vView(sock, v) {
  return { sock, userId: v.uid, serverId: v.sid, channelId: v.cid, muted: v.muted, deaf: v.deaf, screen: v.screen, cam: v.cam, at: v.at };
}
const userServers = uid => Object.values(db.servers).filter(s => s.members.includes(uid));
const voiceOf = serverId => [...voice].filter(([, v]) => v.sid === serverId).map(([k, v]) => vView(k, v));
const onlineCount = s => s.members.reduce((n, id) => n + (db.users[id] && presence(db.users[id]) !== "offline" ? 1 : 0), 0);

/* ------------------------------------------------------------------ */
/* HTTP: arquivos estáticos + API                                      */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2"
};
const fileCache = new Map();

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" || !path.extname(pathname) ? "/index.html" : pathname;
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^[/\\]+/, ""));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  let st;
  try { st = await fsp.stat(file); } catch { st = null; }
  if (!st || !st.isFile()) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Não encontrado"); return; }
  let entry = fileCache.get(file);
  if (!entry || entry.mtime !== st.mtimeMs) {
    const raw = await fsp.readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const gz = /text|javascript|json|svg/.test(type) && raw.length > 1024 ? zlib.gzipSync(raw, { level: 9 }) : null;
    entry = { mtime: st.mtimeMs, raw, gz, type, etag: `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"` };
    fileCache.set(file, entry);
  }
  const headers = {
    "content-type": entry.type, "cache-control": "no-cache", etag: entry.etag,
    "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", vary: "accept-encoding"
  };
  if (req.headers["if-none-match"] === entry.etag) { res.writeHead(304, headers); res.end(); return; }
  const gzip = entry.gz && /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  if (gzip) headers["content-encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : gzip ? entry.gz : entry.raw);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > 8192) { reject(new Error("grande")); req.destroy(); } else chunks.push(c);
    });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new Error("json")); } });
    req.on("error", reject);
  });
}
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || a.reset < now) { a = { n: 0, reset: now + 60000 }; attempts.set(ip, a); }
  return ++a.n > 15;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k); }, 60000).unref();

// No Render (e outros hosts com proxy) todo mundo chega pelo mesmo IP do proxy;
// o IP real vem no cabeçalho x-forwarded-for.
const TRUST_PROXY = !!(process.env.RENDER || process.env.TRUST_PROXY);
function clientIp(req) {
  if (TRUST_PROXY) {
    const f = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress || "?";
}

async function handleAuth(req, res, kind) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: "Muitas tentativas. Aguarde um minuto." });
  let body;
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: "Requisição inválida." }); }
  const username = str(body.username, 24);
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(username)) return sendJson(res, 400, { error: "O usuário deve ter de 3 a 24 caracteres (letras, números, _ . -)." });
  if (password.length < 8 || password.length > 128) return sendJson(res, 400, { error: "A senha precisa ter pelo menos 8 caracteres." });
  const key = username.toLowerCase();
  let user;
  if (kind === "register") {
    if (byName.has(key)) return sendJson(res, 409, { error: "Esse nome de usuário já está em uso." });
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt)).toString("hex");
    if (byName.has(key)) return sendJson(res, 409, { error: "Esse nome de usuário já está em uso." });
    user = { id: newId(), username, color: pick(COLORS), avatar: "", about: "", status: "online", salt, hash, created: Date.now() };
    db.users[user.id] = user;
    byName.set(key, user.id);
  } else {
    const id = byName.get(key);
    user = id ? db.users[id] : null;
    const hash = await scrypt(password, user ? user.salt : "nexora-sal-falso");
    if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, "hex"))) {
      return sendJson(res, 401, { error: "Usuário ou senha incorretos." });
    }
  }
  const token = crypto.randomBytes(32).toString("base64url");
  db.sessions[tokenKey(token)] = { userId: user.id, created: Date.now() };
  save();
  sendJson(res, 200, { token });
}

const server = http.createServer(async (req, res) => {
  let u;
  try { u = new URL(req.url, "http://localhost"); } catch { res.writeHead(400); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(u.pathname); } catch { res.writeHead(400); res.end(); return; }
  try {
    if (pathname === "/health") return sendJson(res, 200, { ok: true, users: Object.keys(db.users).length, online: online.size, voice: voice.size });
    if (req.method === "POST" && pathname === "/api/register") return await handleAuth(req, res, "register");
    if (req.method === "POST" && pathname === "/api/login") return await handleAuth(req, res, "login");
    if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Rota inexistente." });
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
    await serveStatic(req, res, pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: "Erro interno." }); else res.end();
  }
});

/* ------------------------------------------------------------------ */
/* Socket.IO                                                           */
/* ------------------------------------------------------------------ */
const io = new Server(server, {
  maxHttpBufferSize: 256 * 1024,
  perMessageDeflate: false,
  pingInterval: 25000,
  pingTimeout: 20000
});

io.use((socket, next) => {
  const t = socket.handshake.auth && socket.handshake.auth.token;
  const sess = typeof t === "string" && t.length < 100 ? db.sessions[tokenKey(t)] : null;
  const user = sess && db.users[sess.userId];
  if (!user) return next(new Error("auth"));
  socket.data.uid = user.id;
  socket.data.tk = tokenKey(t);
  next();
});

function emitToPeers(uid, ev, data) {
  const rooms = new Set(userServers(uid).map(s => "s:" + s.id));
  rooms.add("u:" + uid);
  for (const id of Object.keys(friendsOf(db.users[uid]))) rooms.add("u:" + id);
  for (const d of dmsOf(uid)) for (const id of d.members) rooms.add("u:" + id);
  io.to([...rooms]).emit(ev, data);
}
function setFriend(a, b, state) {
  const ua = db.users[a];
  if (!ua) return;
  ua.friends = ua.friends || {};
  if (state) ua.friends[b] = state; else delete ua.friends[b];
  io.to("u:" + a).emit("friend:update", { userId: b, state: state || null, user: db.users[b] ? pubUser(db.users[b]) : null });
}

/* ------------------------------------------------------------------ */
/* Steam: mostra "Jogando X" sozinho (precisa de STEAM_API_KEY)        */
/* ------------------------------------------------------------------ */
const STEAM_KEY = process.env.STEAM_API_KEY || "";
async function resolveSteam(input) {
  const s = str(input, 200);
  if (!s) return "";
  let m = s.match(/(\d{17})/);
  if (m) return m[1];
  m = s.match(/steamcommunity\.com\/id\/([^/?#\s]+)/i);
  const vanity = m ? m[1] : /^[A-Za-z0-9_-]{2,32}$/.test(s) ? s : "";
  if (!vanity) fail("Link da Steam inválido. Cole o link do seu perfil Steam.");
  if (!STEAM_KEY) fail("Cole o link com números (steamcommunity.com/profiles/765…). Links com nome precisam da chave STEAM_API_KEY no servidor.");
  const r = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${encodeURIComponent(vanity)}`).then(x => x.json()).catch(() => null);
  if (!r || !r.response || r.response.success !== 1) fail("Perfil Steam não encontrado.");
  return r.response.steamid;
}
async function pollSteam() {
  if (!STEAM_KEY) return;
  const users = [...online.keys()].map(id => db.users[id]).filter(u => u && u.steam);
  for (let i = 0; i < users.length; i += 100) {
    const batch = users.slice(i, i + 100);
    try {
      const r = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${batch.map(u => u.steam).join(",")}`).then(x => x.json());
      const byId = new Map(((r.response && r.response.players) || []).map(p => [p.steamid, p]));
      for (const u of batch) {
        const p = byId.get(u.steam);
        const g = p && p.gameextrainfo ? { name: String(p.gameextrainfo).slice(0, 80), appid: String(p.gameid || "").replace(/\D/g, "").slice(0, 12), steam: true } : null;
        if (JSON.stringify(g) !== JSON.stringify(u.steamGame || null)) {
          u.steamGame = g;
          emitToPeers(u.id, "user:update", { user: pubUser(u) });
        }
      }
    } catch (e) { console.error("Steam:", e.message); }
  }
}
setInterval(pollSteam, 60000).unref();
function leaveVoice(sock) {
  const v = voice.get(sock);
  if (!v) return;
  voice.delete(sock);
  io.to("s:" + v.sid).emit("voice:leave", { sock, userId: v.uid, channelId: v.cid, serverId: v.sid });
}
function systemMsg(s, userId, kind) {
  const ch = s.channels.find(c => c.type === "text");
  if (!ch) return;
  const list = db.messages[ch.id] || (db.messages[ch.id] = []);
  const m = { id: msgId(), a: userId, t: "", ts: Date.now(), sys: kind };
  list.push(m);
  if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
  io.to("s:" + s.id).emit("msg", { channelId: ch.id, serverId: s.id, m });
}
function addMember(s, userId) {
  if (s.members.includes(userId)) return false;
  if (s.members.length >= MAX_MEMBERS) fail("Este servidor está lotado.");
  if (userServers(userId).length >= MAX_SERVERS_PER_USER) fail("Você atingiu o limite de servidores.");
  s.members.push(userId);
  io.to("s:" + s.id).emit("member:add", { serverId: s.id, user: pubUser(db.users[userId]) });
  io.in("u:" + userId).socketsJoin("s:" + s.id);
  io.to("u:" + userId).emit("server:add", {
    server: serverView(s),
    users: s.members.map(id => db.users[id]).filter(Boolean).map(pubUser),
    voice: voiceOf(s.id)
  });
  systemMsg(s, userId, "join");
  save();
  return true;
}
function removeMember(s, userId, reason) {
  for (const [k, v] of voice) if (v.uid === userId && v.sid === s.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
  s.members = s.members.filter(id => id !== userId);
  for (const [code, inv] of Object.entries(db.invites)) if (inv.serverId === s.id && inv.by === userId) delete db.invites[code];
  io.to("s:" + s.id).emit("member:remove", { serverId: s.id, userId });
  io.in("u:" + userId).socketsLeave("s:" + s.id);
  io.to("u:" + userId).emit("server:remove", { serverId: s.id, reason });
  save();
}
const TEMPLATES = {
  friends: [["boas-vindas", "text", "Diga oi para todo mundo! 👋"], ["geral", "text"], ["memes", "text"], ["fotos-e-clipes", "text"], ["Lounge", "voice"], ["Cinema", "voice"]],
  gaming: [["boas-vindas", "text", "Regras e avisos do clã"], ["geral", "text"], ["clipes", "text", "Mande suas melhores jogadas 🎮"], ["procurando-grupo", "text", "Ache gente para jogar"], ["Lobby", "voice"], ["Squad 1", "voice"], ["Squad 2", "voice"]],
  study: [["boas-vindas", "text"], ["geral", "text"], ["duvidas", "text", "Pergunte sem medo"], ["materiais", "text", "Links, resumos e arquivos"], ["Sala de estudos", "voice"], ["Foco total", "voice"]],
  community: [["avisos", "text", "Novidades da comunidade"], ["boas-vindas", "text"], ["geral", "text"], ["sugestoes", "text"], ["Palco", "voice"], ["Bate-papo", "voice"]]
};
function cleanChannelName(name, type) {
  if (type === "voice") return str(name, 32).replace(/\s+/g, " ");
  return str(name, 32).toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").replace(/-{2,}/g, "-");
}

io.on("connection", socket => {
  const uid = socket.data.uid;
  const me = () => db.users[uid];
  if (!me()) { socket.disconnect(true); return; }

  let sockets = online.get(uid);
  const firstSocket = !sockets;
  if (!sockets) online.set(uid, (sockets = new Set()));
  sockets.add(socket.id);
  socket.join("u:" + uid);
  const mine = userServers(uid);
  for (const s of mine) socket.join("s:" + s.id);
  if (firstSocket) emitToPeers(uid, "presence", { userId: uid, status: presence(me()) });

  {
    const users = new Map([[uid, pubUser(me())]]);
    const addU = id => { if (!users.has(id) && db.users[id]) users.set(id, pubUser(db.users[id])); };
    for (const s of mine) for (const id of s.members) addU(id);
    const friends = friendsOf(me());
    for (const id of Object.keys(friends)) addU(id);
    const dms = dmsOf(uid);
    for (const d of dms) for (const id of d.members) addU(id);
    const ids = new Set(mine.map(s => s.id));
    socket.emit("ready", {
      me: { ...pubUser(me()), statusPref: me().status || "online" },
      servers: mine.map(serverView),
      users: [...users.values()],
      friends: Object.fromEntries(Object.entries(friends).filter(([id]) => db.users[id])),
      dms: dms.map(d => dmView(d, uid)),
      steamAuto: !!STEAM_KEY,
      voice: [...voice].filter(([, v]) => ids.has(v.sid)).map(([k, v]) => vView(k, v)),
      iceServers: ICE_SERVERS,
      limits: { voice: VOICE_LIMIT }
    });
  }

  // Limitadores simples por conexão
  const mk = (n, ms) => { const b = { t: 0, n: 0 }; return (cost = 1) => { const now = Date.now(); if (now - b.t > ms) { b.t = now; b.n = 0; } b.n += cost; return b.n <= n; }; };
  const general = mk(60, 5000), chat = mk(6, 4000), signals = mk(400, 5000), typing = mk(3, 6000);

  const on = (ev, fn) => socket.on(ev, async (data, ack) => {
    if (typeof ack !== "function") ack = () => {};
    if (!general()) return ack({ error: "Calma! Você está indo rápido demais." });
    try {
      const r = await fn(data && typeof data === "object" && !Array.isArray(data) ? data : {});
      ack(r || { ok: true });
    } catch (e) {
      if (e instanceof UserError) ack({ error: e.message });
      else { console.error(`[${ev}]`, e); ack({ error: "Erro interno do servidor." }); }
    }
  });
  const getServer = (id, owner) => {
    const s = typeof id === "string" ? db.servers[id] : null;
    if (!s || !s.members.includes(uid)) fail("Servidor não encontrado.");
    if (owner && s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
    return s;
  };
  const getChannel = (channelId, type) => {
    const s = getServer(chanIndex.get(channelId));
    const c = s.channels.find(x => x.id === channelId);
    if (!c || (type && c.type !== type)) fail("Canal não encontrado.");
    return { s, c };
  };
  // Canal de texto de servidor ou conversa privada ("d.…")
  const getTarget = channelId => {
    if (typeof channelId === "string" && channelId.startsWith("d.")) {
      const d = db.dms && db.dms[channelId];
      if (!d || !d.members.includes(uid)) fail("Conversa não encontrada.");
      return { s: null, c: { id: d.id }, rooms: d.members.map(x => "u:" + x), dm: d };
    }
    const { s, c } = getChannel(channelId, "text");
    return { s, c, rooms: "s:" + s.id, dm: null };
  };
  const findMsg = (channelId, id) => {
    const t = getTarget(channelId);
    const m = (db.messages[t.c.id] || []).find(x => x.id === id);
    if (!m || m.sys) fail("Mensagem não encontrada.");
    return { ...t, m };
  };
  const canDm = other => {
    if (!other || other.id === uid) return false;
    if (friendsOf(me())[other.id] === "friend") return true;
    return userServers(uid).some(s => s.members.includes(other.id));
  };

  /* ---------- Mensagens ---------- */
  on("history", ({ channelId, before }) => {
    const { c } = getTarget(channelId);
    const list = db.messages[c.id] || [];
    let end = list.length;
    if (typeof before === "string") { const i = list.findIndex(m => m.id === before); if (i >= 0) end = i; }
    const start = Math.max(0, end - PAGE_SIZE);
    return { messages: list.slice(start, end), more: start > 0 };
  });

  on("send", ({ channelId, text, replyTo, nonce }) => {
    const { s, c, rooms, dm } = getTarget(channelId);
    text = typeof text === "string" ? text.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, 2000) : "";
    if (!text) fail("A mensagem está vazia.");
    if (!chat()) fail("Devagar! Espere um instante antes de enviar de novo.");
    const list = db.messages[c.id] || (db.messages[c.id] = []);
    const m = { id: msgId(), a: uid, t: text, ts: Date.now() };
    if (typeof replyTo === "string") {
      const r = list.find(x => x.id === replyTo && !x.sys);
      if (r) m.re = { id: r.id, a: r.a, t: r.t.slice(0, 140) };
    }
    if (dm && !list.length) {
      // primeira mensagem: a conversa aparece para a outra pessoa
      for (const id of dm.members) {
        const other = db.users[dm.members.find(x => x !== id) || id];
        io.to("u:" + id).emit("dm:add", { dm: dmView(dm, id), user: other ? pubUser(other) : null });
      }
    }
    list.push(m);
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    save();
    io.to(rooms).emit("msg", { channelId: c.id, serverId: s ? s.id : null, m, nonce: str(nonce, 40) });
    return { id: m.id };
  });

  on("edit", ({ channelId, id, text }) => {
    const { c, m, rooms } = findMsg(channelId, id);
    if (m.a !== uid) fail("Você só pode editar suas mensagens.");
    text = typeof text === "string" ? text.replace(/\r\n?/g, "\n").trim().slice(0, 2000) : "";
    if (!text) fail("A mensagem está vazia.");
    if (text === m.t) return { ok: true };
    m.t = text; m.e = Date.now();
    save();
    io.to(rooms).emit("msg:update", { channelId: c.id, m });
  });

  on("delete", ({ channelId, id }) => {
    const { s, c, m, rooms } = findMsg(channelId, id);
    if (m.a !== uid && !(s && s.ownerId === uid)) fail("Sem permissão para apagar esta mensagem.");
    const list = db.messages[c.id];
    list.splice(list.indexOf(m), 1);
    save();
    io.to(rooms).emit("msg:delete", { channelId: c.id, id: m.id });
  });

  on("react", ({ channelId, id, emoji }) => {
    const { c, m, rooms } = findMsg(channelId, id);
    emoji = str(emoji, 32);
    if (!emoji || /[\s<>&"'`]/.test(emoji) || /^[\x20-\x7e]+$/.test(emoji)) fail("Reação inválida.");
    m.r = m.r || {};
    const ids = m.r[emoji] || [];
    if (ids.includes(uid)) {
      const left = ids.filter(x => x !== uid);
      if (left.length) m.r[emoji] = left; else delete m.r[emoji];
    } else {
      if (!m.r[emoji] && Object.keys(m.r).length >= 20) fail("Limite de reações atingido.");
      m.r[emoji] = [...ids, uid];
    }
    if (!Object.keys(m.r).length) delete m.r;
    save();
    io.to(rooms).emit("msg:update", { channelId: c.id, m });
  });

  socket.on("typing", data => {
    if (!data || typeof data.channelId !== "string" || !typing()) return;
    if (data.channelId.startsWith("d.")) {
      const d = db.dms && db.dms[data.channelId];
      if (d && d.members.includes(uid)) for (const id of d.members) if (id !== uid) io.to("u:" + id).emit("typing", { channelId: d.id, userId: uid });
      return;
    }
    const sid = chanIndex.get(data.channelId);
    const s = sid && db.servers[sid];
    if (!s || !s.members.includes(uid)) return;
    socket.to("s:" + s.id).emit("typing", { channelId: data.channelId, userId: uid });
  });

  /* ---------- Servidores ---------- */
  on("server:create", ({ name, icon, color, isPublic, description, template }) => {
    name = str(name, 40);
    if (name.length < 2) fail("Dê ao servidor um nome com pelo menos 2 caracteres.");
    if (userServers(uid).length >= MAX_SERVERS_PER_USER) fail("Você atingiu o limite de servidores.");
    const tpl = TEMPLATES[template] || TEMPLATES.friends;
    const s = {
      id: newId(), name, icon: cleanPic(icon), color: isColor(color) ? color : pick(COLORS),
      description: str(description, 200), public: !!isPublic, ownerId: uid, created: Date.now(), members: [uid],
      channels: tpl.map(([n, type, topic]) => (type === "text" ? { id: newId(), name: n, type, topic: topic || "" } : { id: newId(), name: n, type }))
    };
    db.servers[s.id] = s;
    for (const c of s.channels) chanIndex.set(c.id, s.id);
    save();
    io.in("u:" + uid).socketsJoin("s:" + s.id);
    io.to("u:" + uid).emit("server:add", { server: serverView(s), users: [pubUser(me())], voice: [] });
    return { id: s.id };
  });

  on("server:update", ({ serverId, name, icon, color, description, isPublic }) => {
    const s = getServer(serverId, true);
    if (name !== undefined) { const n = str(name, 40); if (n.length < 2) fail("Nome muito curto."); s.name = n; }
    if (icon !== undefined) s.icon = cleanPic(icon);
    if (color !== undefined && isColor(color)) s.color = color;
    if (description !== undefined) s.description = str(description, 200);
    if (isPublic !== undefined) s.public = !!isPublic;
    save();
    io.to("s:" + s.id).emit("server:update", { server: serverMeta(s) });
  });

  on("server:delete", ({ serverId }) => {
    const s = getServer(serverId, true);
    for (const [k, v] of voice) if (v.sid === s.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
    io.to("s:" + s.id).emit("server:remove", { serverId: s.id, reason: `O servidor "${s.name}" foi excluído.` });
    io.in("s:" + s.id).socketsLeave("s:" + s.id);
    for (const c of s.channels) { delete db.messages[c.id]; chanIndex.delete(c.id); }
    for (const [code, inv] of Object.entries(db.invites)) if (inv.serverId === s.id) delete db.invites[code];
    delete db.servers[s.id];
    save();
  });

  on("server:leave", ({ serverId }) => {
    const s = getServer(serverId);
    if (s.ownerId === uid) fail("Você é o dono. Transfira ou exclua o servidor.");
    removeMember(s, uid, null);
  });

  on("server:kick", ({ serverId, userId }) => {
    const s = getServer(serverId, true);
    if (userId === uid || !s.members.includes(userId)) fail("Membro inválido.");
    removeMember(s, userId, `Você foi removido de "${s.name}".`);
  });

  on("server:transfer", ({ serverId, userId }) => {
    const s = getServer(serverId, true);
    if (userId === uid || !s.members.includes(userId)) fail("Membro inválido.");
    s.ownerId = userId;
    save();
    io.to("s:" + s.id).emit("server:update", { server: serverMeta(s) });
  });

  /* ---------- Convites e descoberta ---------- */
  on("invite:create", ({ serverId }) => {
    const s = getServer(serverId);
    let code = Object.keys(db.invites).find(k => db.invites[k].serverId === s.id && db.invites[k].by === uid);
    if (!code) {
      do code = randomCode(8); while (db.invites[code]);
      db.invites[code] = { serverId: s.id, by: uid, created: Date.now(), uses: 0 };
      save();
    }
    return { code };
  });

  on("invite:info", ({ code }) => {
    const inv = db.invites[parseCode(code)];
    const s = inv && db.servers[inv.serverId];
    if (!s) fail("Convite inválido ou expirado.");
    const inviter = db.users[inv.by];
    return {
      server: { ...serverMeta(s), members: s.members.length, online: onlineCount(s) },
      inviter: inviter ? inviter.username : null,
      joined: s.members.includes(uid)
    };
  });

  on("invite:join", ({ code }) => {
    const key = parseCode(code);
    const inv = db.invites[key];
    const s = inv && db.servers[inv.serverId];
    if (!s) fail("Convite inválido ou expirado.");
    if (addMember(s, uid)) { inv.uses++; save(); }
    return { serverId: s.id };
  });

  on("discover", ({ q }) => {
    const query = str(q, 40).toLowerCase();
    return {
      servers: Object.values(db.servers)
        .filter(s => s.public && (!query || s.name.toLowerCase().includes(query) || (s.description || "").toLowerCase().includes(query)))
        .map(s => ({ ...serverMeta(s), members: s.members.length, online: onlineCount(s), joined: s.members.includes(uid) }))
        .sort((a, b) => b.online - a.online || b.members - a.members)
        .slice(0, 60)
    };
  });

  on("discover:join", ({ serverId }) => {
    const s = typeof serverId === "string" ? db.servers[serverId] : null;
    if (!s || !s.public) fail("Servidor não encontrado.");
    addMember(s, uid);
    return { serverId: s.id };
  });

  /* ---------- Canais ---------- */
  on("channel:create", ({ serverId, name, type, topic }) => {
    const s = getServer(serverId, true);
    type = type === "voice" ? "voice" : "text";
    name = cleanChannelName(name, type);
    if (!name) fail("Dê um nome ao canal.");
    if (s.channels.length >= MAX_CHANNELS) fail("Limite de canais atingido.");
    const c = { id: newId(), name, type, topic: type === "text" ? str(topic, 160) : "" };
    s.channels.push(c);
    chanIndex.set(c.id, s.id);
    save();
    io.to("s:" + s.id).emit("channel:add", { serverId: s.id, channel: chanView(c) });
    return { id: c.id };
  });

  on("channel:update", ({ channelId, name, topic }) => {
    const { s, c } = getChannel(channelId);
    if (s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
    if (name !== undefined) { const n = cleanChannelName(name, c.type); if (!n) fail("Nome inválido."); c.name = n; }
    if (topic !== undefined && c.type === "text") c.topic = str(topic, 160);
    save();
    io.to("s:" + s.id).emit("channel:update", { serverId: s.id, channel: chanView(c) });
  });

  on("channel:delete", ({ channelId }) => {
    const { s, c } = getChannel(channelId);
    if (s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
    if (c.type === "text" && s.channels.filter(x => x.type === "text").length <= 1) fail("O servidor precisa de pelo menos um canal de texto.");
    for (const [k, v] of voice) if (v.cid === c.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
    s.channels = s.channels.filter(x => x.id !== c.id);
    chanIndex.delete(c.id);
    delete db.messages[c.id];
    save();
    io.to("s:" + s.id).emit("channel:remove", { serverId: s.id, channelId: c.id });
  });

  on("channel:move", ({ channelId, dir }) => {
    const { s, c } = getChannel(channelId);
    if (s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
    const same = s.channels.filter(x => x.type === c.type);
    const i = same.indexOf(c), j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= same.length) return { ok: true };
    const a = s.channels.indexOf(c), b = s.channels.indexOf(same[j]);
    [s.channels[a], s.channels[b]] = [s.channels[b], s.channels[a]];
    save();
    io.to("s:" + s.id).emit("channels:order", { serverId: s.id, order: s.channels.map(x => x.id) });
  });

  /* ---------- Perfil ---------- */
  on("profile:update", async ({ color, avatar, about, status, steam, game }) => {
    const u = me();
    if (steam !== undefined) {
      const sid = await resolveSteam(steam);
      if (sid !== (u.steam || "")) { u.steam = sid; u.steamGame = null; }
    }
    if (color !== undefined && isColor(color)) u.color = color;
    if (avatar !== undefined) u.avatar = cleanPic(avatar);
    if (about !== undefined) u.about = str(about, 190);
    if (game !== undefined) u.game = str(game, 64);
    if (status !== undefined && ["online", "idle", "dnd", "invisible"].includes(status)) u.status = status;
    save();
    emitToPeers(uid, "user:update", { user: pubUser(u) });
    io.to("u:" + uid).emit("user:update", { user: pubUser(u), statusPref: u.status });
    if (steam) pollSteam();
  });

  /* ---------- Amigos ---------- */
  on("friend:request", ({ username }) => {
    const id = byName.get(str(username, 40).replace(/^@/, "").toLowerCase());
    const other = id && db.users[id];
    if (!other) fail("Ninguém com esse nome de usuário. Confira se está escrito certinho.");
    if (other.id === uid) fail("Esse é você! 😄");
    const mineF = friendsOf(me());
    if (mineF[other.id] === "friend") fail(`Você e ${other.username} já são amigos.`);
    if (mineF[other.id] === "out") fail("Pedido já enviado. Aguarde a resposta.");
    if (Object.keys(mineF).length >= 500) fail("Limite de amigos atingido.");
    if (mineF[other.id] === "in") { setFriend(uid, other.id, "friend"); setFriend(other.id, uid, "friend"); }
    else { setFriend(uid, other.id, "out"); setFriend(other.id, uid, "in"); }
    save();
    return { state: friendsOf(me())[other.id] };
  });

  on("friend:accept", ({ userId }) => {
    if (friendsOf(me())[userId] !== "in") fail("Pedido não encontrado.");
    setFriend(uid, userId, "friend");
    setFriend(userId, uid, "friend");
    save();
  });

  on("friend:remove", ({ userId }) => {
    if (!friendsOf(me())[userId]) return { ok: true };
    setFriend(uid, userId, null);
    setFriend(userId, uid, null);
    save();
  });

  on("dm:open", ({ userId }) => {
    const other = typeof userId === "string" ? db.users[userId] : null;
    if (!canDm(other)) fail("Adicione essa pessoa como amiga para conversar no privado.");
    db.dms = db.dms || {};
    const id = dmIdOf(uid, other.id);
    if (!db.dms[id]) { db.dms[id] = { id, members: [uid, other.id], created: Date.now() }; save(); }
    return { dm: dmView(db.dms[id], uid), user: pubUser(other) };
  });

  on("logout", () => {
    delete db.sessions[socket.data.tk];
    save();
    setTimeout(() => socket.disconnect(true), 50);
  });

  /* ---------- Voz / vídeo / tela (sinalização WebRTC) ---------- */
  on("voice:join", ({ channelId, muted, deaf }) => {
    const { s, c } = getChannel(channelId, "voice");
    for (const [k, v] of voice) {
      if (v.uid === uid && k !== socket.id) { leaveVoice(k); io.to(k).emit("voice:kicked", { reason: "Você entrou em uma sala por outro dispositivo." }); }
    }
    leaveVoice(socket.id);
    const peers = [...voice].filter(([, v]) => v.cid === c.id);
    if (peers.length >= VOICE_LIMIT) fail(`A sala está cheia (máximo de ${VOICE_LIMIT}).`);
    const st = { uid, sid: s.id, cid: c.id, muted: !!muted, deaf: !!deaf, screen: null, cam: null, at: Date.now() };
    voice.set(socket.id, st);
    io.to("s:" + s.id).emit("voice:state", vView(socket.id, st));
    return { peers: peers.map(([k, v]) => vView(k, v)), iceServers: ICE_SERVERS };
  });

  on("voice:update", ({ muted, deaf, screen, cam }) => {
    const st = voice.get(socket.id);
    if (!st) return { ok: false };
    if (muted !== undefined) st.muted = !!muted;
    if (deaf !== undefined) st.deaf = !!deaf;
    if (screen !== undefined) st.screen = screen ? str(screen, 64) : null;
    if (cam !== undefined) st.cam = cam ? str(cam, 64) : null;
    io.to("s:" + st.sid).emit("voice:state", vView(socket.id, st));
  });

  on("voice:leave", () => { leaveVoice(socket.id); });

  socket.on("voice:signal", msg => {
    if (!msg || typeof msg.to !== "string" || !msg.data || typeof msg.data !== "object" || !signals()) return;
    const a = voice.get(socket.id), b = voice.get(msg.to);
    if (!a || !b || a.cid !== b.cid) return;
    io.to(msg.to).emit("voice:signal", { from: socket.id, userId: uid, data: msg.data });
  });

  socket.on("disconnect", () => {
    leaveVoice(socket.id);
    const set = online.get(uid);
    if (set) {
      set.delete(socket.id);
      if (!set.size) {
        online.delete(uid);
        if (db.users[uid]) emitToPeers(uid, "presence", { userId: uid, status: "offline" });
      }
    }
  });
});

server.keepAliveTimeout = 65000;   // maior que o do balanceador do Render, evita erros 502
server.headersTimeout = 66000;
loadDb().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`\n  NEXORA rodando em http://localhost:${PORT}`);
    if (process.env.RENDER_EXTERNAL_URL) console.log(`  Endereço público: ${process.env.RENDER_EXTERNAL_URL}\n`);
    else console.log(`  Na rede local, use o IP deste computador na porta ${PORT}.\n`);
  });
}).catch(e => {
  console.error("Não foi possível abrir o banco de dados:", e.message);
  process.exit(1);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  setTimeout(() => process.exit(0), 5000).unref();
  if (saveTimer) clearTimeout(saveTimer);
  dirty = true;
  while (saving) await new Promise(r => setTimeout(r, 50));
  await flush();
  io.close();
  if (pg) await pg.end().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
