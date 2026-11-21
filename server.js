/**
 * Auryx Nexos — servidor
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

const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
// TURN: retransmite a voz quando as duas pessoas não conseguem se ligar direto (4G, Wi-Fi de empresa/escola)
// Configure no Render: TURN_URLS (separados por vírgula), TURN_USERNAME e TURN_CREDENTIAL
if (process.env.TURN_URLS) ICE_SERVERS.push({ urls: process.env.TURN_URLS.split(",").map(x => x.trim()).filter(Boolean), username: process.env.TURN_USERNAME || "", credential: process.env.TURN_CREDENTIAL || "" });
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
    await pg.query("CREATE TABLE IF NOT EXISTS nexora_files (id TEXT PRIMARY KEY, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
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
  db.files = db.files || {};
  db.dms = db.dms || {};
  db.orders = db.orders || {};
  setupPush();
  // catálogo de jogos: começa com o Bunker 9 (os ADMs adicionam outros pelo painel)
  if (!Array.isArray(db.games)) {
    db.games = [{
      id: "bunker9", name: "Bunker 9", url: "https://bunker9-multiplayer.onrender.com", category: "Sobrevivência", status: "on", embed: true, img: "",
      desc: "Sobreviva às hordas de zumbis no bunker com seus amigos. Multiplayer, armas, perks e muita tensão.", order: 1, created: Date.now()
    }];
    save();
  }
  db.audit = db.audit || [];
  db.admins = Array.isArray(db.admins) ? db.admins : [];
  db.migrations = Array.isArray(db.migrations) ? db.migrations : [];
  db.settings = Object.assign({ regOpen: true, maintenance: "", pixKey: "", links: {}, minApp: null, announce: null }, db.settings || {});
  db.metrics = Array.isArray(db.metrics) ? db.metrics : [];
  // conversas antigas com a Aury guardavam até 200 mensagens por pessoa; agora ficam as últimas 80
  for (const st of Object.values(db.ai || {})) if (st && Array.isArray(st.msgs) && st.msgs.length > 80) st.msgs.splice(0, st.msgs.length - 80);
  refreshAdmins();
  for (const u of Object.values(db.users)) { byName.set(u.username.toLowerCase(), u.id); if (u.email) byEmail.set(u.email, u.id); }
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

/* Arquivos enviados: conteúdo no PostgreSQL (ou pasta data/files), dados em db.files */
const MAX_FILE = 8 * 1024 * 1024;
const FILES_DIR = path.join(DATA_DIR, "files");
const fileCacheMem = new Map();   // cache pequeno dos arquivos mais vistos (economiza o banco)
let fileCacheBytes = 0;
async function putFileData(id, buf) {
  if (pg) await pg.query("INSERT INTO nexora_files (id, data) VALUES ($1, $2)", [id, buf]);
  else { await fsp.mkdir(FILES_DIR, { recursive: true }); await fsp.writeFile(path.join(FILES_DIR, id), buf); }
}
async function getFileData(id) {
  if (fileCacheMem.has(id)) return fileCacheMem.get(id);
  let buf = null;
  if (pg) { const r = await pg.query("SELECT data FROM nexora_files WHERE id = $1", [id]); buf = r.rows[0] ? r.rows[0].data : null; }
  else { try { buf = await fsp.readFile(path.join(FILES_DIR, id)); } catch { buf = null; } }
  if (buf && buf.length < 2 * 1024 * 1024) {
    fileCacheMem.set(id, buf); fileCacheBytes += buf.length;
    while (fileCacheBytes > 40 * 1024 * 1024) { const [k, v] = fileCacheMem.entries().next().value; fileCacheMem.delete(k); fileCacheBytes -= v.length; }
  }
  return buf;
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
const FILE_URL_RE = /^\/f\/([A-Za-z0-9_-]{12,40})\/[^/?#]{1,120}$/;
function cleanPic(v) {
  if (typeof v !== "string") return "";
  if (v.startsWith("data:")) return v.length <= 60000 && IMG_RE.test(v) ? v : "";
  const m = v.match(FILE_URL_RE);
  if (m) { const f = db.files[m[1]]; return f && /^image\//.test(f.t) ? v : ""; }
  return str(v, 16);
}
const fileUrl = (id, name) => `/f/${id}/${encodeURIComponent(name).replace(/%20/g, "+")}`;
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
/* ------------------------------------------------------------------ */
/* Planos Premium (pagos por Pix, liberados só por um ADM)             */
/* ------------------------------------------------------------------ */
// price = mensal (30 dias) · price3 = trimestral (90 dias, com desconto)
const PLANS = {
  plus: { tier: "plus", name: "VIP", price: 599, price3: 1499, rank: 1, link: "https://nubank.com.br/cobrar/577jqn/6af86b8d-a317-400e-85ce-bfb41001dfa5",
    benefits: ["Insígnia VIP 💠 e nome colorido nos chats", "Destaque na lista de membros", "Cores do perfil em degradê", "Status personalizado com emoji", "Mensagens de até 5.000 caracteres", "Aury, a IA: 60 mensagens por dia", "Arquivos de até 15 MB"] },
  pro: { tier: "pro", name: "Pro", price: 1499, price3: 3799, rank: 2, link: "https://nubank.com.br/cobrar/577jqn/6af86c01-b569-4fcc-8170-bc699f49f89f",
    benefits: ["Tudo do VIP", "Insígnia Pro 💎", "Aurys: a cor do app inteiro do seu jeito", "Avatar e banner animados (GIF)", "Moldura animada no avatar", "Efeito no nome (degradê, brilho, arco-íris)", "Mensagens de até 7.000 caracteres", "Aury, a IA: 200 mensagens por dia", "Arquivos de até 25 MB"] },
  max: { tier: "max", name: "Max", price: 3499, price3: 8799, rank: 3, link: "https://nubank.com.br/cobrar/577jqn/6af86c1d-40ed-4da3-82cc-221f2402949a",
    benefits: ["Tudo do Pro", "Insígnia Max 👑 exclusiva", "Efeitos e partículas no perfil (aurora, neon, fogo, galáxia, sakura…)", "Molduras exclusivas (ouro, aurora)", "Mensagens de até 10.000 caracteres", "Aury, a IA: 500 mensagens por dia", "Arquivos de até 50 MB", "Prioridade no atendimento"] }
};
const PLAN_DAYS = 30;
// ciclos de cobrança: m = mensal, q = trimestral (3 meses pagos de uma vez, mais barato)
const CYCLES = { m: { days: 30, months: 1, name: "Mensal" }, q: { days: 90, months: 3, name: "Trimestral" } };
const cycleOf = c => (CYCLES[c] ? c : "m");
const priceOf = (p, c) => (cycleOf(c) === "q" ? p.price3 : p.price);
const planOf = u => { const p = u && u.plan; return p && PLANS[p.tier] && p.until > Date.now() ? p.tier : ""; };
const rankOf = u => (PLANS[planOf(u)] || { rank: 0 }).rank;
const maxFileOf = u => [8, 15, 25, 50][rankOf(u)] * 1024 * 1024;
// "VIP+" = planos acima do VIP (Pro e Max)
const NEED = { theme: 1, cs: 1, avatarFile: 2, banner: 2, fx: 2, accent: 2, ring: 2, pfx: 3, ringMax: 3 };   // nível mínimo de cada benefício
const RANK_NAME = ["", "VIP", "Pro", "Max"];
// limites de mensagem por plano (sem plano, VIP, Pro, Max): tamanho e quantas em 4 segundos
const MSG_MAX = [3000, 5000, 7000, 10000];
const MSG_RATE = [8, 12, 14, 16];
const RINGS = { spin: 2, pulse: 2, rainbow: 2, gold: 3, aurora: 3 };   // molduras do avatar e o plano mínimo de cada
const PFXS = ["aurora", "stars", "fire", "neon", "galaxy", "sakura", "snow", "hearts"];
const BANNER_GIF_MAX = 6 * 1024 * 1024;
const payLink = (p, c) => { const k = p.tier + "_" + cycleOf(c), l = db.settings && db.settings.links && db.settings.links[k]; return l !== undefined && l !== null ? l : cycleOf(c) === "m" ? p.link : ""; };

function pubUser(u) {
  const off = presence(u) === "offline";
  const r = rankOf(u);
  const av = u.avatar || "";
  return {
    id: u.id, username: u.username, color: u.color, avatar: av.startsWith("/f/") && r < NEED.avatarFile ? "" : av,
    about: u.about || "", status: presence(u), created: u.created,
    steam: u.steam || "", game: off ? null : gameOf(u), plan: planOf(u),
    // Perfil Turbo — só aparece o que o plano atual libera (se o plano vencer, some sem apagar nada)
    banner: r >= NEED.banner ? u.banner || "" : "", bannerStill: r >= NEED.banner && u.banner ? u.bannerStill || "" : "",
    bp: r >= NEED.banner && u.banner && u.bp ? u.bp : null,   // enquadramento do banner: posição, zoom e altura
    ap: av.startsWith("/f/") && r >= NEED.avatarFile && u.ap ? u.ap : null,   // enquadramento do avatar: posição e zoom
    theme: r >= NEED.theme ? u.theme || null : null, pron: u.pron || "",
    cs: off || r < NEED.cs ? null : u.cs || null, fx: r >= NEED.fx ? u.fx || "" : "", pfx: r >= NEED.pfx ? u.pfx || "" : "",
    ring: u.ring && r >= (RINGS[u.ring] || 9) ? u.ring : "",
    aura: r >= NEED.accent && u.accent ? u.accent[0] : "",
    staff: isOwnerUser(u) ? "owner" : isAdmin(u) ? "adm" : ""
  };
}
/* amigos e mensagens privadas */
const friendsOf = u => (u && u.friends) || {};
const dmIdOf = (a, b) => "d." + [a, b].sort().join(".");
function dmView(d, viewer) {
  const list = db.messages[d.id];
  const last = list && list.length ? list[list.length - 1] : null;
  const v = { id: d.id, userId: d.members.find(x => x !== viewer) || viewer, created: d.created, last: last ? { id: last.id, ts: last.ts, a: last.a } : null };
  if (d.group) Object.assign(v, { group: true, name: d.name || "", members: d.members.slice(), ownerId: d.owner, icon: d.icon || "" });
  return v;
}
const dmsOf = uid => Object.values(db.dms || {}).filter(d => d.members.includes(uid));
function chanView(c) {
  const list = db.messages[c.id];
  const last = list && list.length ? list[list.length - 1] : null;
  return { id: c.id, name: c.name, type: c.type, topic: c.topic || "", emoji: c.emoji || "", cat: c.cat || "", last: last ? { id: last.id, ts: last.ts, a: last.a } : null };
}
function serverMeta(s) {
  return { id: s.id, name: s.name, icon: s.icon || "", color: s.color, description: s.description || "", public: !!s.public, ownerId: s.ownerId, created: s.created, banner: s.banner || "", accent: s.accent || "" };
}
function serverView(s) {
  return { ...serverMeta(s), channels: s.channels.map(chanView), members: s.members.slice(), roles: rolesSorted(s), memberRoles: s.memberRoles || {} };
}
/* ---------- cargos e permissões dos servidores ---------- */
// admin = tudo · server = editar o servidor · channels = canais · roles = cargos · kick = expulsar · ban = banir · messages = apagar mensagens dos outros
const PERMS = ["admin", "server", "channels", "roles", "kick", "ban", "messages"];
const MAX_ROLES = 30;
const rolesSorted = s => (s.roles || []).map((r, i) => ({ id: r.id, name: r.name, color: r.color, icon: r.icon || "", perms: r.perms, hoist: !!r.hoist, pos: i })).reverse();
function rolesOf(s, userId) { const ids = (s.memberRoles && s.memberRoles[userId]) || []; return (s.roles || []).filter(r => ids.includes(r.id)); }
function hasPerm(s, userId, p) { if (s.ownerId === userId) return true; return rolesOf(s, userId).some(r => r.perms.includes("admin") || r.perms.includes(p)); }
function topPos(s, userId) { if (s.ownerId === userId) return Infinity; let t = -1; (s.roles || []).forEach((r, i) => { if (rolesOf(s, userId).includes(r)) t = i; }); return t; }
const canManagePerms = s => uid => PERMS.some(p => hasPerm(s, uid, p));
function emitRoles(s) { io.to("s:" + s.id).emit("server:roles", { serverId: s.id, roles: rolesSorted(s), memberRoles: s.memberRoles || {} }); }
function vView(sock, v) {
  return { sock, userId: v.uid, serverId: v.sid, channelId: v.cid, muted: v.muted, deaf: v.deaf, screen: v.screen, cam: v.cam, at: v.at };
}
// servidores bloqueados pela equipe somem para os membros (ficam guardados na pasta "Bloqueados" do Painel ADM)
const userServers = uid => Object.values(db.servers).filter(s => !s.blocked && s.members.includes(uid));
// para quem avisar das mudanças na call: membros do servidor, ou as pessoas da conversa privada
const vTo = sid => { const d = db.dms && db.dms[sid]; return io.to(d ? d.members.map(m => "u:" + m) : "s:" + sid); };
const voiceOf = serverId => [...voice].filter(([, v]) => v.sid === serverId).map(([k, v]) => vView(k, v));
const onlineCount = s => s.members.reduce((n, id) => n + (db.users[id] && presence(db.users[id]) !== "offline" ? 1 : 0), 0);

/* ------------------------------------------------------------------ */
/* HTTP: arquivos estáticos + API                                      */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8"
};
const fileCache = new Map();

async function serveStatic(req, res, pathname) {
  const SITE = { "/site": 1, "/baixar": 1, "/download": 1, "/sobre": 1 };   // site de apresentação
  const rel = SITE[pathname.replace(/\/+$/, "")] ?"/site.html" : pathname === "/" || !path.extname(pathname) ? "/index.html" : pathname;
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^[/\\]+/, ""));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  let st;
  try { st = await fsp.stat(file); } catch { st = null; }
  if (!st || !st.isFile()) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Não encontrado"); return; }
  let entry = fileCache.get(file);
  if (!entry || entry.mtime !== st.mtimeMs) {
    let raw = await fsp.readFile(file);
    // o app.js leva a própria versão: assim ele percebe sozinho quando está desatualizado (cópia guardada antiga)
    if (rel === "/app.js") raw = Buffer.from(raw.toString("utf8").replace("__AURYX_BUILD__", APP_VER));
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const zip = /text|javascript|json|svg/.test(type) && raw.length > 1024;
    // gzip fora da thread principal (antes era gzipSync: travava o servidor no 1º acesso de cada arquivo)
    const gz = zip ? await new Promise(ok => zlib.gzip(raw, { level: 9 }, (e, b) => ok(e ? null : b))) : null;
    entry = { mtime: st.mtimeMs, raw, gz, br: null, type, etag: `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"` };
    fileCache.set(file, entry);
    // Brotli: ~20% menor que o gzip no app.js (134 KB → 107 KB), mas leva ~0,8 s de CPU;
    // comprime em segundo plano e passa a usar assim que ficar pronto (até lá vai gzip)
    if (zip) zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }, (e, b) => { if (!e && b.length < (gz ? gz.length : raw.length)) entry.br = b; });
  }
  const headers = {
    "content-type": entry.type, "cache-control": "no-cache", etag: entry.etag,
    "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", vary: "accept-encoding",
    // ninguém pode embutir a Auryx num site falso (proteção contra clickjacking)
    "x-frame-options": "SAMEORIGIN", "content-security-policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
    "cross-origin-opener-policy": "same-origin-allow-popups",
    ...(process.env.RENDER || process.env.NODE_ENV === "production" ? { "strict-transport-security": "max-age=15552000" } : {})
  };
  if (req.headers["if-none-match"] === entry.etag) { res.writeHead(304, headers); res.end(); return; }
  const ae = req.headers["accept-encoding"] || "";
  const body = entry.br && /\bbr\b/.test(ae) ? (headers["content-encoding"] = "br", entry.br)
    : entry.gz && /\bgzip\b/.test(ae) ? (headers["content-encoding"] = "gzip", entry.gz) : entry.raw;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
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
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT) || 15;   // tentativas por minuto por IP
function limited(ip) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || a.reset < now) { a = { n: 0, reset: now + 60000 }; attempts.set(ip, a); }
  return ++a.n > AUTH_LIMIT;
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

/* ------------------------------------------------------------------ */
/* Contas: e-mail, verificação por código, recuperação de senha, ADM   */
/* ------------------------------------------------------------------ */
const APP_NAME = "Auryx Nexos";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`;
const MAIL_ON = !!RESEND_KEY;
// ADMs: nomes de usuário na variável ADMIN_USERS (ex.: "laura,pedro"). Só vale para contas que já existem.
// o dono do app é sempre ADM (nomes de usuário não podem ser trocados, então ninguém assume esse nome)
const OWNER = "duduzinho5455";
// ADM Supremo: a conta do dono tem acesso total (ADMs, sistema, desconexão geral, backups). Os outros ADMs moderam.
const ENV_ADMINS = (process.env.ADMIN_USERS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const ADMIN_SET = new Set([OWNER, ...ENV_ADMINS]);
// ADMs nomeados pelo ADM Supremo no painel (ficam guardados no banco)
function refreshAdmins() {
  ADMIN_SET.clear();
  for (const n of [OWNER, ...ENV_ADMINS, ...((db.admins || []).map(id => db.users[id] && db.users[id].username.toLowerCase()).filter(Boolean))]) ADMIN_SET.add(n);
}
const isOwnerUser = u => !!(u && String(u.username).toLowerCase() === OWNER);
const isAdmin = u => !!(u && ADMIN_SET.has(String(u.username).toLowerCase()));
const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const byEmail = new Map();
const maskEmail = e => { const [a, d] = String(e || "").split("@"); return a && d ? `${a.slice(0, 2)}${"•".repeat(Math.max(1, a.length - 2))}@${d}` : ""; };
const hashCode = (code, salt) => crypto.createHash("sha256").update(salt + ":" + code).digest("hex");
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
class HttpError extends Error { constructor(code, msg) { super(msg); this.status = code; } }

async function sendMail(to, subject, title, line, code) {
  if (!MAIL_ON) throw new HttpError(503, "O envio de e-mails ainda não foi configurado no servidor (falta RESEND_API_KEY).");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;background:#0b0c14;padding:32px;color:#e8eaf4"><div style="max-width:440px;margin:auto;background:#131624;border-radius:16px;padding:28px;border:1px solid #232842"><h1 style="margin:0 0 4px;font-size:22px;color:#a78bfa">${APP_NAME}</h1><h2 style="margin:0 0 16px;font-size:18px;color:#fff">${title}</h2><p style="color:#b4b9d0">${line}</p><div style="font-size:34px;letter-spacing:10px;font-weight:800;text-align:center;background:#0b0c14;border-radius:12px;padding:16px;margin:18px 0;color:#fff">${code}</div><p style="color:#858ba8;font-size:13px">O código vale por 15 minutos. Se não foi você, ignore este e-mail.</p></div></div>`;
  const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text: `${title}\n\n${line}\n\nCódigo: ${code}\n\nVale por 15 minutos.` })
  }).catch(() => null);
  if (!r || !r.ok) {
    const t = r ? await r.text().catch(() => "") : "sem resposta";
    console.error("Resend:", r && r.status, String(t).slice(0, 300));
    throw new HttpError(502, "Não foi possível enviar o e-mail agora. Confira o endereço ou tente de novo em alguns minutos.");
  }
}
async function sendCode(user, kind, email) {
  const code = newCode();
  user[kind] = { h: hashCode(code, user.id), exp: Date.now() + 15 * 60e3, tries: 0, email: email || user.email, sent: Date.now() };
  save();
  if (kind === "vc") await sendMail(email || user.email, `Seu código: ${code}`, "Confirme seu e-mail", "Use este código para confirmar seu e-mail:", code);
  else await sendMail(user.email, `Recuperar senha: ${code}`, "Recuperar sua senha", "Use este código para criar uma nova senha:", code);
}
function checkCode(user, kind, code) {
  const c = user[kind];
  if (!c || c.exp < Date.now()) throw new HttpError(400, "Código expirado. Peça um novo.");
  if (c.tries >= 5) throw new HttpError(429, "Muitas tentativas erradas. Peça um novo código.");
  c.tries++;
  const ok = crypto.timingSafeEqual(Buffer.from(hashCode(String(code || "").replace(/\D/g, ""), user.id)), Buffer.from(c.h));
  save();
  if (!ok) throw new HttpError(400, `Código incorreto. Restam ${5 - c.tries} tentativa(s).`);
  return c;
}
const needsVerify = u => MAIL_ON && !!u.needVerify && !u.emailVerified;
const secureReq = req => req.headers["x-forwarded-proto"] === "https" || !!process.env.RENDER;
// "Windows · App da Auryx", "Android · Chrome"... (só para a pessoa reconhecer o aparelho)
function deviceOf(ua) {
  ua = String(ua || "");
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iPhone/iPad" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Aparelho";
  const app = /Electron\//.test(ua) ? "App de PC" : /; wv\)|AuryxAndroid/i.test(ua) ? "App Android" : /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return os + " · " + app;
}
const sessId = key => key.slice(0, 12);
function endSessions(userId, keep, only) {
  let n = 0;
  for (const [k, v] of Object.entries(db.sessions)) {
    if (v.userId !== userId || k === keep || (only && sessId(k) !== only)) continue;
    delete db.sessions[k]; n++;
    for (const sk of io.sockets.sockets.values()) if (sk.data.tk === k) { sk.emit("session:ended", {}); setTimeout(() => sk.disconnect(true), 150); }
  }
  if (n) save();
  return n;
}
// Desconexão geral: apaga TODAS as sessões (todas as contas, todos os aparelhos) e derruba as conexões.
// keep = sessão que continua valendo (quem apertou o botão no painel); na atualização nada fica.
function logoutEveryone(keep) {
  let n = 0;
  for (const k of Object.keys(db.sessions)) { if (k === keep) continue; delete db.sessions[k]; n++; }
  if (typeof io !== "undefined") for (const sk of io.sockets.sockets.values()) {
    if (sk.data.tk === keep) continue;
    sk.emit("session:ended", { all: true });
    setTimeout(() => sk.disconnect(true), 200);
  }
  save();
  return n;
}
function newSession(req, res, user) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.sessions[tokenKey(token)] = { userId: user.id, created: Date.now(), last: Date.now(), dev: deviceOf(req.headers["user-agent"]) };
  setSessionCookie(req, res, token);
  save();
  return token;
}
// Cookie só para abrir arquivos privados (comprovantes) — HttpOnly, o JavaScript não lê.
function setSessionCookie(req, res, token) {
  res.setHeader("set-cookie", `ax_s=${token}; Path=/f/; HttpOnly; SameSite=Lax; Max-Age=${60 * 24 * 3600}${secureReq(req) ? "; Secure" : ""}`);
}
function userFromBearer(req) {
  const t = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const sess = t && t.length < 100 ? db.sessions[tokenKey(t)] : null;
  return sess ? { user: db.users[sess.userId], token: t } : null;
}
function userFromCookie(req) {
  const m = /(?:^|;\s*)ax_s=([A-Za-z0-9_-]{20,100})/.exec(String(req.headers.cookie || ""));
  const sess = m ? db.sessions[tokenKey(m[1])] : null;
  return sess ? db.users[sess.userId] : null;
}
const meView = u => ({ ...pubUser(u), statusPref: u.status || "online", email: maskEmail(u.email), emailVerified: !!u.emailVerified, admin: isAdmin(u), supreme: isOwnerUser(u),
  planInfo: u.plan && planOf(u) ? { tier: u.plan.tier, until: u.plan.until } : null,
  accent: rankOf(u) >= NEED.accent && u.accent ? u.accent : null, accentSaved: u.accent || null, ringPref: u.ring || "",
  msgMax: MSG_MAX[rankOf(u)] });
const failKey = new Map();   // tentativas erradas por conta: bloqueio de 15 min após 8 erros

async function handleAuth(req, res, kind) {
  if (limited(clientIp(req))) return sendJson(res, 429, { error: "Muitas tentativas. Aguarde um minuto." });
  let body;
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: "Requisição inválida." }); }
  try {
    const password = typeof body.password === "string" ? body.password : "";
    if (kind === "register") {
      const username = str(body.username, 24);
      const email = str(body.email, 200).toLowerCase();
      if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(username)) throw new HttpError(400, "O usuário deve ter de 3 a 24 caracteres (letras, números, _ . -).");
      if (!EMAIL_RE.test(email)) throw new HttpError(400, "Digite um e-mail válido.");
      if (password.length < 8 || password.length > 128) throw new HttpError(400, "A senha precisa ter pelo menos 8 caracteres.");
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new HttpError(400, "Use letras e números na senha.");
      if (db.settings.regOpen === false) throw new HttpError(403, "Os cadastros estão fechados no momento. Tente mais tarde.");
      const key = username.toLowerCase();
      if (byName.has(key) || ADMIN_SET.has(key) || /^aury([ _.-]?(ia|ai|bot))?$/.test(key)) throw new HttpError(409, "Esse nome de usuário já está em uso.");
      if (byEmail.has(email)) throw new HttpError(409, "Já existe uma conta com esse e-mail. Use “Esqueci a senha” se precisar.");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = (await scrypt(password, salt)).toString("hex");
      if (byName.has(key) || byEmail.has(email)) throw new HttpError(409, "Esse usuário ou e-mail já está em uso.");
      const user = { id: newId(), username, email, emailVerified: false, needVerify: true, color: pick(COLORS), avatar: "", about: "", status: "online", salt, hash, created: Date.now() };
      db.users[user.id] = user;
      byName.set(key, user.id);
      byEmail.set(email, user.id);
      let mailError = "";
      if (MAIL_ON) { try { await sendCode(user, "vc", email); } catch (e) { mailError = e.message; } }
      const token = newSession(req, res, user);
      return sendJson(res, 200, { token, verify: needsVerify(user), email: maskEmail(email), mailError });
    }
    // login: aceita nome de usuário ou e-mail
    const login = str(body.username, 200).toLowerCase();
    const id = login.includes("@") ? byEmail.get(login) : byName.get(login);
    const user = id ? db.users[id] : null;
    const f = user && failKey.get(user.id);
    if (f && f.until > Date.now()) throw new HttpError(429, `Conta bloqueada por segurança após muitas tentativas. Tente em ${Math.ceil((f.until - Date.now()) / 60000)} min ou recupere a senha.`);
    const hash = await scrypt(password, user ? user.salt : "auryx-sal-falso");
    if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, "hex"))) {
      if (user) { const g = failKey.get(user.id) || { n: 0, until: 0 }; g.n++; if (g.n >= 8) { g.until = Date.now() + 15 * 60e3; g.n = 0; } failKey.set(user.id, g); }
      throw new HttpError(401, "Usuário ou senha incorretos.");
    }
    failKey.delete(user.id);
    if (user.banned) throw new HttpError(403, `Sua conta foi suspensa pela equipe da Auryx.${user.banned.reason ? " Motivo: " + user.banned.reason : ""}`);
    const token = newSession(req, res, user);
    sendJson(res, 200, { token, verify: needsVerify(user), email: maskEmail(user.email) });
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
    throw e;
  }
}

async function handleAccountApi(req, res, route) {
  let body = {};
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: "Requisição inválida." }); }
  try {
    if (route === "verify" || route === "resend" || route === "cookie") {
      const a = userFromBearer(req);
      if (!a || !a.user) throw new HttpError(401, "Entre novamente.");
      const user = a.user;
      if (route === "cookie") { setSessionCookie(req, res, a.token); return sendJson(res, 200, { ok: true }); }
      if (route === "resend") {
        if (limited("resend:" + user.id)) throw new HttpError(429, "Aguarde um pouco antes de pedir outro código.");
        if (user.vc && Date.now() - user.vc.sent < 45e3) throw new HttpError(429, "Espere alguns segundos para pedir de novo.");
        const email = (user.vc && user.vc.email) || user.email;
        if (!email) throw new HttpError(400, "Sua conta não tem e-mail.");
        await sendCode(user, "vc", email);
        return sendJson(res, 200, { ok: true, email: maskEmail(email) });
      }
      const c = checkCode(user, "vc", body.code);
      const email = c.email || user.email;
      const other = byEmail.get(email);
      if (other && other !== user.id) throw new HttpError(409, "Esse e-mail já está em uso em outra conta.");
      if (user.email && user.email !== email) byEmail.delete(user.email);
      user.email = email; user.emailVerified = true; delete user.vc;
      byEmail.set(email, user.id);
      save();
      io.to("u:" + user.id).emit("me:update", { me: meView(user) });
      return sendJson(res, 200, { ok: true });
    }
    if (limited(clientIp(req))) throw new HttpError(429, "Muitas tentativas. Aguarde um minuto.");
    const email = str(body.email, 200).toLowerCase();
    if (route === "forgot") {
      if (!EMAIL_RE.test(email)) throw new HttpError(400, "Digite um e-mail válido.");
      if (!MAIL_ON) throw new HttpError(503, "A recuperação por e-mail ainda não foi configurada no servidor (falta RESEND_API_KEY).");
      const user = db.users[byEmail.get(email)];
      // resposta igual existindo ou não a conta (não revela quem tem cadastro)
      if (user && (!user.rc || Date.now() - user.rc.sent > 45e3)) await sendCode(user, "rc");
      return sendJson(res, 200, { ok: true });
    }
    if (route === "reset") {
      const user = db.users[byEmail.get(email)];
      if (!user) throw new HttpError(400, "Código incorreto ou expirado.");
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new HttpError(400, "A nova senha precisa ter 8+ caracteres, com letras e números.");
      checkCode(user, "rc", body.code);
      delete user.rc;
      user.salt = crypto.randomBytes(16).toString("hex");
      user.hash = (await scrypt(password, user.salt)).toString("hex");
      user.emailVerified = true;          // recebeu o código no e-mail: o e-mail é dele
      failKey.delete(user.id);
      for (const [k, v] of Object.entries(db.sessions)) if (v.userId === user.id) delete db.sessions[k];   // sai de todos os aparelhos
      io.in("u:" + user.id).disconnectSockets(true);
      const token = newSession(req, res, user);
      return sendJson(res, 200, { token });
    }
    throw new HttpError(404, "Rota inexistente.");
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Backup automático: uma cópia completa (compactada) por dia, guardando */
/* as 7 últimas. Fica numa tabela própria do banco (ou na pasta         */
/* data/backups) e também é enviada por e-mail ao dono, quando possível. */
/* Os ADMs baixam qualquer cópia pelo Painel ADM.                       */
/* ------------------------------------------------------------------ */
const BACKUP_KEEP = 7, BACKUP_EVERY = 24 * 3600e3;
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const backupState = { last: 0, running: false, lastMail: null };
async function backupInit() {
  if (pg) await pg.query("CREATE TABLE IF NOT EXISTS nexora_backups (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), size INT NOT NULL, reason TEXT NOT NULL DEFAULT '', data BYTEA NOT NULL)");
  else fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const list = await backupList();
  backupState.last = list.length ? list[0].at : 0;
}
async function backupList() {
  if (pg) {
    const r = await pg.query("SELECT id, created_at, size, reason FROM nexora_backups ORDER BY created_at DESC");
    return r.rows.map(x => ({ id: x.id, at: new Date(x.created_at).getTime(), size: x.size, reason: x.reason }));
  }
  let names = [];
  try { names = fs.readdirSync(BACKUP_DIR).filter(n => /^nexora-[\w.-]+\.json\.gz$/.test(n)); } catch {}
  return names.map(n => { const st = fs.statSync(path.join(BACKUP_DIR, n)); const m = n.match(/^nexora-(\d+)-(\w+)/); return { id: n.replace(/\.json\.gz$/, ""), at: m ? +m[1] : st.mtimeMs, size: st.size, reason: m ? m[2] : "" }; })
    .sort((a, b) => b.at - a.at);
}
async function backupGet(id) {
  if (typeof id !== "string" || !/^nexora-\d+-\w+$/.test(id)) return null;
  if (pg) { const r = await pg.query("SELECT data FROM nexora_backups WHERE id = $1", [id]); return r.rows[0] ? r.rows[0].data : null; }
  try { return fs.readFileSync(path.join(BACKUP_DIR, id + ".json.gz")); } catch { return null; }
}
async function backupNow(reason) {
  if (backupState.running) throw new Error("Já tem um backup sendo feito. Espere terminar.");
  backupState.running = true;
  try {
    const at = Date.now(), id = `nexora-${at}-${reason === "manual" ? "manual" : "auto"}`;
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ app: "auryx-nexavoria", version: 1, at, db })), { level: 9 });
    if (pg) {
      await pg.query("INSERT INTO nexora_backups (id, size, reason, data) VALUES ($1, $2, $3, $4)", [id, gz.length, reason, gz]);
      await pg.query("DELETE FROM nexora_backups WHERE id NOT IN (SELECT id FROM nexora_backups ORDER BY created_at DESC LIMIT $1)", [BACKUP_KEEP]);
    } else {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.writeFileSync(path.join(BACKUP_DIR, id + ".json.gz"), gz);
      const old = (await backupList()).slice(BACKUP_KEEP);
      for (const b of old) try { fs.unlinkSync(path.join(BACKUP_DIR, b.id + ".json.gz")); } catch {}
    }
    backupState.last = at;
    console.log(`  Backup ${id}: ${(gz.length / 1024).toFixed(0)} KB`);
    backupMail(id, gz).catch(e => { backupState.lastMail = { at: Date.now(), ok: false, error: String(e.message || e).slice(0, 200) }; });
    return { id, at, size: gz.length, reason };
  } finally { backupState.running = false; }
}
// cópia fora do Render: vai por e-mail para o dono (se o e-mail estiver confirmado e o envio configurado)
async function backupMail(id, gz) {
  if (!MAIL_ON) { backupState.lastMail = { at: Date.now(), ok: false, error: "E-mail não configurado no servidor." }; return; }
  const owner = db.users[byName.get(OWNER)];
  if (!owner || !owner.email || !owner.emailVerified) { backupState.lastMail = { at: Date.now(), ok: false, error: "A conta do dono não tem e-mail confirmado." }; return; }
  if (gz.length > 20 * 1024 * 1024) { backupState.lastMail = { at: Date.now(), ok: false, error: "Backup grande demais para e-mail (baixe pelo painel)." }; return; }
  const day = new Date().toLocaleDateString("pt-BR");
  const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM, to: [owner.email], subject: `Backup da ${APP_NAME} — ${day}`,
      text: `Backup automático da ${APP_NAME} (${day}). Guarde este arquivo: ele tem contas, servidores e mensagens. Os arquivos enviados (imagens, vídeos) ficam fora do backup.`,
      attachments: [{ filename: id + ".json.gz", content: gz.toString("base64") }]
    })
  });
  backupState.lastMail = r.ok ? { at: Date.now(), ok: true } : { at: Date.now(), ok: false, error: `Envio recusado (${r.status}).` };
}
function backupSchedule() {
  const tick = () => {
    if (Date.now() - backupState.last >= BACKUP_EVERY && !backupState.running) backupNow("auto").catch(e => console.error("Backup falhou:", e.message));
  };
  setTimeout(tick, 2 * 60e3);                // logo depois de ligar (se o último tiver mais de 1 dia)
  setInterval(tick, 30 * 60e3).unref();
}
async function serveBackup(req, res, id) {
  const a = userFromBearer(req);
  // o backup tem e-mails e senhas (criptografadas) de todo mundo: só o ADM Supremo baixa
  if (!a || !a.user || !isOwnerUser(a.user)) return sendJson(res, 403, { error: "Só o ADM Supremo pode baixar backups." });
  const buf = await backupGet(id);
  if (!buf) return sendJson(res, 404, { error: "Backup não encontrado." });
  res.writeHead(200, { "content-type": "application/gzip", "content-length": buf.length, "content-disposition": `attachment; filename="${id}.json.gz"`, "cache-control": "no-store" });
  res.end(buf);
}

/* ---------- envio e download de arquivos ---------- */
const uploadQuota = new Map(); // userId -> { bytes, n, reset }
const INLINE_TYPES = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm|ogg)|audio\/(mpeg|ogg|wav|webm|mp4|aac|x-m4a))$/;
async function handleUpload(req, res) {
  const a = userFromBearer(req);
  const user = a && a.user;
  if (!user) return sendJson(res, 401, { error: "Entre novamente para enviar arquivos." });
  const priv = req.headers["x-private"] === "receipt";       // comprovante: só o dono e os ADMs veem
  const limit = priv ? 8 * 1024 * 1024 : maxFileOf(user);
  const size = Number(req.headers["content-length"] || 0);
  if (!size) return sendJson(res, 400, { error: "Arquivo vazio." });
  if (size > limit) return sendJson(res, 413, { error: `Arquivo muito grande (máximo ${limit / 1048576} MB${priv ? "" : rankOf(user) < 3 ? " — os planos Premium aumentam o limite" : ""}).` });
  const now = Date.now();
  let q = uploadQuota.get(user.id);
  if (!q || q.reset < now) { q = { bytes: 0, n: 0, reset: now + 3600e3 }; uploadQuota.set(user.id, q); }
  if (q.n >= 80 || q.bytes + size > 250 * 1024 * 1024) return sendJson(res, 429, { error: "Limite de envios por hora atingido. Tente mais tarde." });
  let name = "arquivo";
  try { name = decodeURIComponent(String(req.headers["x-file-name"] || "arquivo")); } catch {}
  name = name.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "_").trim().slice(0, 100) || "arquivo";
  let type = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!/^[a-z]+\/[a-z0-9.+-]+$/.test(type)) type = "application/octet-stream";
  const chunks = [];
  let got = 0;
  try {
    await new Promise((resolve, reject) => {
      req.on("data", c => { got += c.length; if (got > limit) { reject(new Error("grande")); req.destroy(); } else chunks.push(c); });
      req.on("end", resolve);
      req.on("error", reject);
    });
  } catch { return sendJson(res, 413, { error: `Arquivo muito grande (máximo ${limit / 1048576} MB).` }); }
  const buf = Buffer.concat(chunks);
  if (!buf.length) return sendJson(res, 400, { error: "Arquivo vazio." });
  if (priv) {
    // comprovante: confere o tipo pelo conteúdo real do arquivo, não só pelo nome
    const sig = buf.subarray(0, 12);
    const real = sig[0] === 0x89 && sig.toString("latin1", 1, 4) === "PNG" ? "image/png"
      : sig[0] === 0xff && sig[1] === 0xd8 ? "image/jpeg"
      : sig.toString("latin1", 0, 4) === "RIFF" && sig.toString("latin1", 8, 12) === "WEBP" ? "image/webp"
      : sig.toString("latin1", 0, 5) === "%PDF-" ? "application/pdf" : "";
    if (!real) return sendJson(res, 415, { error: "Envie o comprovante como imagem (PNG, JPG, WEBP) ou PDF." });
    type = real;
  }
  const id = crypto.randomBytes(15).toString("base64url");
  await putFileData(id, buf);
  q.n++; q.bytes += buf.length;
  db.files[id] = { o: user.id, n: name, t: type, s: buf.length, c: now };
  if (priv) { db.files[id].p = 1; db.files[id].h = crypto.createHash("sha256").update(buf).digest("hex"); }
  save();
  sendJson(res, 200, { id, name, type, size: buf.length, url: fileUrl(id, name) });
}
async function serveFile(req, res, rawPath) {
  const m = rawPath.match(/^\/f\/([A-Za-z0-9_-]{12,40})(\/|$)/);
  const meta = m && db.files[m[1]];
  if (!meta) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Arquivo não encontrado"); return; }
  if (meta.p) {
    // arquivo privado (comprovante): só o dono ou um ADM, conferido pela sessão
    const viewer = userFromCookie(req);
    if (!viewer || (viewer.id !== meta.o && !isAdmin(viewer))) { res.writeHead(403, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }); res.end("Sem permissão para ver este arquivo."); return; }
  }
  const etag = `"${m[1]}"`;
  const headers = {
    "cache-control": meta.p ? "private, no-store" : "public, max-age=31536000, immutable", etag,
    "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
    "cross-origin-resource-policy": "same-origin"
  };
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); res.end(); return; }
  const buf = await getFileData(m[1]);
  if (!buf) { res.writeHead(404); res.end(); return; }
  const inline = INLINE_TYPES.test(meta.t);
  headers["content-type"] = inline ? meta.t : "application/octet-stream";
  headers["content-disposition"] = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.n)}`;
  // suporte a "Range" para vídeos e áudios poderem avançar
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (range && inline) {
    let start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : buf.length - 1;
    if (!range[1] && range[2]) { start = Math.max(0, buf.length - +range[2]); end = buf.length - 1; }
    if (start >= buf.length || end < start) { res.writeHead(416, { "content-range": `bytes */${buf.length}` }); res.end(); return; }
    end = Math.min(end, buf.length - 1);
    res.writeHead(206, { ...headers, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": end - start + 1 });
    res.end(req.method === "HEAD" ? undefined : buf.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { ...headers, "accept-ranges": "bytes", "content-length": buf.length });
  res.end(req.method === "HEAD" ? undefined : buf);
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
    if (req.method === "POST" && pathname === "/api/upload") return await handleUpload(req, res);
    const acct = /^\/api\/account\/(verify|resend|cookie|forgot|reset)$/.exec(pathname);
    if (req.method === "POST" && acct) return await handleAccountApi(req, res, acct[1]);
    if (pathname.startsWith("/f/") && (req.method === "GET" || req.method === "HEAD")) return await serveFile(req, res, u.pathname);
    const bk = req.method === "GET" && pathname.match(/^\/api\/admin\/backup\/(nexora-\d+-\w+)$/);
    if (bk) return await serveBackup(req, res, bk[1]);
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
  if (user.banned) { const e = new Error("banned"); e.data = { reason: user.banned.reason || "" }; return next(e); }
  // app de PC antigo (NEXORA) foi desativado: só conecta o app novo ou o navegador
  const ua = String(socket.handshake.headers["user-agent"] || "");
  if (/\bNEXORA\/\d/.test(ua) && /Electron\//.test(ua)) return next(new Error("update"));
  // modo manutenção: só a equipe entra
  if (db.settings.maintenance && !isAdmin(user)) { const e = new Error("maintenance"); e.data = { text: db.settings.maintenance }; return next(e); }
  // versão mínima do app (Android / PC): depois do prazo, o app antigo não entra mais
  const upd = updateNeeded(appInfo(ua));
  if (upd && upd.hard) { const e = new Error("update"); e.data = upd; return next(e); }
  socket.data.outdated = upd || null;
  if (needsVerify(user)) return next(new Error("verify"));
  socket.data.uid = user.id;
  socket.data.tk = tokenKey(t);
  if (sess) { sess.last = Date.now(); if (!sess.dev) sess.dev = deviceOf(socket.handshake.headers["user-agent"]); }
  next();
});

/* ---------- versão dos apps (Android e PC) ---------- */
const DOWNLOADS = {
  android: "https://github.com/duduzinho5455-sketch/nexora/releases/download/android/Auryx-Nexos.apk",
  desktop: "https://github.com/duduzinho5455-sketch/nexora/releases/latest/download/Auryx-Nexos-Setup.exe"
};
function appInfo(ua) {
  ua = String(ua || "");
  let m = /AuryxAndroid\/([\d.]+)/.exec(ua);
  if (m) return { kind: "android", ver: m[1] };
  m = /AuryxDesktop\/([\d.]+)/.exec(ua);
  if (m) return { kind: "desktop", ver: m[1] };
  if (/Electron\//.test(ua)) return { kind: "desktop", ver: "0" };   // app de PC antigo (não diz a versão)
  return { kind: "web", ver: "" };
}
function verLt(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; }
  return false;
}
function updateNeeded(info) {
  const m = db.settings.minApp;
  if (!m || info.kind === "web" || !m[info.kind] || !verLt(info.ver, m[info.kind])) return null;
  return { hard: Date.now() >= (m.since || 0), kind: info.kind, min: m[info.kind], ver: info.ver, url: DOWNLOADS[info.kind], since: m.since || 0 };
}

function emitToPeers(uid, ev, data) {
  const rooms = new Set(userServers(uid).map(s => "s:" + s.id));
  rooms.add("u:" + uid);
  for (const id of Object.keys(friendsOf(db.users[uid]))) rooms.add("u:" + id);
  for (const d of dmsOf(uid)) for (const id of d.members) rooms.add("u:" + id);
  io.to([...rooms]).emit(ev, data);
}
/* ------------------------------------------------------------------ */
/* Notificações push (Web Push): chegam mesmo com o app/site fechado   */
/* ------------------------------------------------------------------ */
let webpush = null;
try { webpush = require("web-push"); } catch { console.warn("  Aviso: pacote web-push não instalado — notificações push desligadas."); }
function setupPush() {
  if (!webpush) return;
  if (!db.vapid || !db.vapid.publicKey) { db.vapid = webpush.generateVAPIDKeys(); save(); }
  webpush.setVapidDetails(process.env.RENDER_EXTERNAL_URL || "https://nexora-ujw6.onrender.com", db.vapid.publicKey, db.vapid.privateKey);
}
const visibleSockets = new Map();   // userId -> sockets com a tela aberta (sem push para quem está olhando)
const isActive = uid => { const s = visibleSockets.get(uid); return !!(s && s.size); };
function pushTo(uid, payload) {
  const u = db.users[uid];
  if (!webpush || !db.vapid || !u || !Array.isArray(u.push) || !u.push.length || isActive(uid) || u.status === "dnd") return;
  const body = JSON.stringify({ icon: "/icons/icon-192.png", ...payload });
  for (const sub of u.push.slice()) {
    webpush.sendNotification(sub, body, { TTL: 6 * 3600, urgency: "high" }).catch(e => {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { u.push = u.push.filter(x => x.endpoint !== sub.endpoint); save(); }
    });
  }
}
// notificação para TODAS as contas com push ligado (aviso geral da equipe); devolve quantos aparelhos
function pushAll(payload) {
  if (!webpush || !db.vapid) return 0;
  const body = JSON.stringify({ icon: "/icons/icon-192.png", ...payload });
  let n = 0;
  for (const u of Object.values(db.users)) {
    if (!Array.isArray(u.push) || !u.push.length || u.banned) continue;
    for (const sub of u.push.slice()) {
      n++;
      webpush.sendNotification(sub, body, { TTL: 24 * 3600, urgency: "normal" }).catch(e => {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { u.push = u.push.filter(x => x.endpoint !== sub.endpoint); save(); }
      });
    }
  }
  return n;
}
/* Métricas do painel: mensagens por minuto (memória) e um retrato a cada 5 min das últimas 24 h (banco) */
const msgClock = [];
function countMsg() { const now = Date.now(); msgClock.push(now); while (msgClock.length && msgClock[0] < now - 3600e3) msgClock.shift(); }
function sampleMetrics() {
  const now = Date.now();
  db.metrics.push({ at: now, on: online.size, vc: voice.size, m: msgClock.filter(t => t > now - 300e3).length });
  if (db.metrics.length > 288) db.metrics.splice(0, db.metrics.length - 288);
  save();
}
function mentionedIn(text, memberIds) {
  const t = String(text || "").toLowerCase();
  const all = /(^|\s)@(everyone|todos|here)\b/.test(t);
  return memberIds.filter(id => { const u = db.users[id]; return u && (all || new RegExp(`(^|[^\\p{L}\\p{N}_.-])@${u.username.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "u").test(t)); });
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
// Quando a conexão cai (tela bloqueada, troca de rede), a pessoa fica 60 s "segurando o lugar"
// na sala; se voltar nesse tempo, retoma a MESMA chamada sem desligar.
const VOICE_GRACE = 60000;
/* Versão do app: muda a cada atualização do site. O app compara e se atualiza sozinho. */
const APP_VER = (() => { try { return crypto.createHash("sha1").update(fs.readFileSync(path.join(__dirname, "public", "app.js"))).update(fs.readFileSync(path.join(__dirname, "public", "style.css"))).digest("hex").slice(0, 10); } catch { return String(Date.now()); } })();
const NEWS_OLD = `🚀 A Auryx Nexos foi atualizada!

Novidades: cargos e permissões nos servidores, bot de música que toca a música inteira, voz mais confiável, transmissão de tela melhor (principalmente no celular), configurações reorganizadas e VIP renovado.

👉 Feche e abra o app (ou recarregue a página com F5) para usar a versão nova.`;
const newsSent = new Set();
/* ---------- pedidos do VIP: visão e avisos ---------- */
function orderView(o, full) {
  const u = db.users[o.uid], f = db.files[o.receipt];
  const v = { id: o.id, uid: o.uid, tier: o.tier, plan: PLANS[o.tier].name + (cycleOf(o.cycle) === "q" ? " Trimestral" : ""), cycle: cycleOf(o.cycle), amount: o.amount, status: o.status, created: o.created, updated: o.updated, reason: o.reason || "", note: o.note || "", decidedBy: o.by ? (db.users[o.by] || {}).username || "?" : "", decidedAt: o.decided || 0 };
  v.user = u ? pubUser(u) : null;
  v.receipt = f ? { id: o.receipt, n: f.n, t: f.t, s: f.s } : null;
  if (full && u) v.userEmail = u.email || "";
  const list = db.messages["t." + o.id];
  v.last = list && list.length ? { id: list[list.length - 1].id, ts: list[list.length - 1].ts, a: list[list.length - 1].a } : null;
  return v;
}
function pushOrder(o) {
  io.to("u:" + o.uid).emit("order:update", { order: orderView(o, false) });
  io.to("admins").emit("order:update", { order: orderView(o, true) });
}

const PENDING_DAYS = 7;                      // pedido sem resposta vira "expirado" (o ADM ainda pode aprovar)
const ordersOpen = o => o.status === "pending" || o.status === "review";
function orderSysMsg(o, kind, text) {
  const cid = "t." + o.id, list = db.messages[cid] || (db.messages[cid] = []);
  const m = { id: msgId(), a: o.uid, t: text || "", ts: Date.now(), sys: kind };
  list.push(m);
  io.to(["u:" + o.uid, "admins"]).emit("msg", { channelId: cid, serverId: null, m });
}
/* Rotina de hora em hora: pedidos esquecidos expiram e quem está perto de vencer recebe aviso */
function vipSweep() {
  const now = Date.now();
  let changed = false;
  for (const o of Object.values(db.orders)) {
    if (ordersOpen(o) && now - o.created > PENDING_DAYS * 86400e3) {
      o.status = "expired"; o.updated = now; changed = true;
      orderSysMsg(o, "oexpire", "");
      pushOrder(o);
    }
  }
  for (const u of Object.values(db.users)) {
    const p = u.plan;
    if (!p || !p.until || !PLANS[p.tier]) continue;
    const left = p.until - now, name = PLANS[p.tier].name;
    if (left > 0 && left < 3 * 86400e3 && p.warned !== p.until) {
      p.warned = p.until; changed = true;
      const d = Math.max(1, Math.ceil(left / 86400e3));
      pushTo(u.id, { title: `Seu ${name} vence em ${d} ${d === 1 ? "dia" : "dias"}`, body: "Renove em Premium para não perder os benefícios.", url: "/?abrir=premium", tag: "plan-warn" });
      io.to("u:" + u.id).emit("plan:notice", { kind: "soon", tier: p.tier, until: p.until });
    }
    if (left <= 0 && p.ended !== p.until) {
      p.ended = p.until; changed = true;
      pushTo(u.id, { title: `Seu ${name} venceu`, body: "Os benefícios foram pausados — nada foi apagado. Renove quando quiser.", url: "/?abrir=premium", tag: "plan-end" });
      io.to("u:" + u.id).emit("plan:notice", { kind: "ended", tier: p.tier, until: p.until });
      io.to("u:" + u.id).emit("me:update", { me: meView(u) });
      emitToPeers(u.id, "user:update", { user: pubUser(u) });
    }
  }
  if (changed) save();
}
/* Bot de música: busca pelo nome (YouTube Data API oficial) e converte link do Spotify na mesma música */
const YT_KEY = process.env.YOUTUBE_API_KEY || "";
const musicCache = new Map();          // busca -> resultados (economiza a cota diária do YouTube)
const ytTitleCache = new Map();        // id do vídeo -> título
const htmlDecode = s => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function ytSearch(q) {
  const key = q.toLowerCase();
  const hit = musicCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.items;
  const url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&regionCode=BR&relevanceLanguage=pt&q=" + encodeURIComponent(q) + "&key=" + encodeURIComponent(YT_KEY);
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(r.status === 403 ? "A cota diária de buscas do YouTube acabou. Cole o link do vídeo ou tente amanhã." : "A busca do YouTube falhou agora. Tente de novo.");
  const j = await r.json();
  const items = (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({ id: x.id.videoId, title: htmlDecode(x.snippet.title), channel: htmlDecode(x.snippet.channelTitle), thumb: (x.snippet.thumbnails && (x.snippet.thumbnails.medium || x.snippet.thumbnails.default) || {}).url || "" }));
  for (const it of items) ytTitleCache.set(it.id, it.title);
  musicCache.set(key, { at: Date.now(), items });
  if (musicCache.size > 500) musicCache.delete(musicCache.keys().next().value);
  return items;
}
async function spotifyTitle(link) {
  const m = String(link).match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{10,40})/);
  if (!m) return "";
  const r = await fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(`https://open.spotify.com/${m[1]}/${m[2]}`), { signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!r || !r.ok) return "";
  const j = await r.json().catch(() => ({}));
  return htmlDecode(j.title || "");
}
async function ytTitle(id) {
  if (ytTitleCache.has(id)) return ytTitleCache.get(id);
  const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id), { signal: AbortSignal.timeout(6000) }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  const t = j ? htmlDecode(j.title) : "";
  ytTitleCache.set(id, t);
  if (ytTitleCache.size > 2000) ytTitleCache.delete(ytTitleCache.keys().next().value);
  return t;
}
const sockAlias = new Map();   // socket antigo -> socket novo (para os sinais de quem ainda usa o id antigo)
function holdVoice(sock) {
  const v = voice.get(sock);
  if (!v) return;
  v.away = Date.now();
  clearTimeout(v.awayTimer);
  v.awayTimer = setTimeout(() => { if (voice.get(sock) === v && v.away) leaveVoice(sock); }, VOICE_GRACE);
}
function leaveVoice(sock) {
  const v = voice.get(sock);
  if (!v) return;
  clearTimeout(v.awayTimer);
  voice.delete(sock);
  for (const [k, val] of sockAlias) if (val === sock || k === sock) sockAlias.delete(k);
  io.in(sock).socketsLeave("v:" + v.cid);
  vTo(v.sid).emit("voice:leave", { sock, userId: v.uid, channelId: v.cid, serverId: v.sid });
  if (db.dms && db.dms[v.sid] && ![...voice.values()].some(x => x.cid === v.cid)) vTo(v.sid).emit("call:end", { channelId: v.cid });
  if (![...voice.values()].some(x => x.cid === v.cid) && acts.has(v.cid)) {
    acts.delete(v.cid);
    vTo(v.sid).emit("act:sum", { channelId: v.cid, type: null });
  }
}
/* Atividades da call: um estado por sala de voz, guardado só na memória */
const acts = new Map(); // channelId -> { type, state, by, strokes }
const ACT_TYPES = ["yt", "sp", "board", "ttt"];
const actView = (cid, a) => (a ? { channelId: cid, type: a.type, state: a.state, by: a.by, strokes: a.type === "board" ? a.strokes : undefined } : { channelId: cid, type: null });
function systemMsg(s, userId, kind) {
  const ch = s.channels.find(c => c.type === "text");
  if (!ch) return;
  const list = db.messages[ch.id] || (db.messages[ch.id] = []);
  const m = { id: msgId(), a: userId, t: "", ts: Date.now(), sys: kind };
  list.push(m);
  if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
  io.to("s:" + s.id).emit("msg", { channelId: ch.id, serverId: s.id, m });
}
const inviteOk = inv => !!inv && !(inv.exp && inv.exp < Date.now()) && !(inv.max && (inv.uses || 0) >= inv.max);
function addMember(s, userId) {
  if (s.members.includes(userId)) return false;
  if (s.bans && s.bans[userId]) fail("Você foi banido deste servidor.");
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
function deleteServer(s, reason) {
  for (const [k, v] of voice) if (v.sid === s.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
  io.to("s:" + s.id).emit("server:remove", { serverId: s.id, reason });
  io.in("s:" + s.id).socketsLeave("s:" + s.id);
  for (const c of s.channels) { delete db.messages[c.id]; chanIndex.delete(c.id); }
  for (const [code, inv] of Object.entries(db.invites)) if (inv.serverId === s.id) delete db.invites[code];
  delete db.servers[s.id];
  save();
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
const cleanEmoji = e => { e = str(e, 16); return !e || /[<>&"'`\s]/.test(e) || /^[\x20-\x7e]+$/.test(e) ? "" : e; };
function cleanChannelName(name, type) {
  if (type === "voice") return str(name, 32).replace(/\s+/g, " ");
  return str(name, 32).toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").replace(/-{2,}/g, "-");
}

/* ------------------------------------------------------------------ */
/* Aury, a IA (Claude): atendimento de quem compra o VIP e bate-papo   */
/* exclusivo dos assinantes. A chave fica no servidor (Render).        */
/* ------------------------------------------------------------------ */
const AI = require("./ai");
const AI_ID = "aury";
const AI_LIMIT = { plus: 60, pro: 200, max: 500 };          // mensagens por dia no bate-papo VIP
const AI_TICKET_DAY = 25;                                   // respostas por dia em cada atendimento
const AI_KEEP = 80;                                         // mensagens guardadas por pessoa no bate-papo
const aiBusy = new Set();
const brl = c => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const dayKey = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // dia no horário de Brasília
const ORDER_STATUS = {
  pending: "AGUARDANDO — a equipe ainda não abriu o pedido",
  review: "EM ANÁLISE — um ADM está conferindo se o Pix caiu na conta",
  approved: "APROVADO — o pagamento foi confirmado e o plano já está liberado",
  rejected: "RECUSADO pela equipe",
  expired: "EXPIRADO — ficou 7 dias sem resposta; se o Pix caiu, um ADM ainda pode aprovar"
};
const AI_BASE = `Você é a Aury, assistente com IA da Auryx Nexos, uma plataforma brasileira de comunidade: servidores com canais de texto, salas de voz com transmissão de tela e câmera, chat dentro da call, atividades na call (ouvir juntos, lousa, jogo da velha), jogos dentro do app (como o Bunker 9), mensagens e chamadas privadas, sobreposição de jogo no app de PC e planos VIP (Plus, Pro e Max). Funciona no app para Windows, no app para Android e no navegador (https://nexora-ujw6.onrender.com — o site com os downloads fica em /site).
Fale sempre em português do Brasil, num tom leve, simpático e direto, com frases curtas. No máximo um emoji por mensagem. Pode usar **negrito** e listas simples.
Nunca peça senha, código de verificação, dados de cartão, CPF ou dados bancários; se alguém oferecer, diga para não enviar.
Não invente funções que o app não tem. Se não souber algo, diga que não sabe.`;
function aiPlansText() {
  return Object.values(PLANS).map(p => `- ${p.name}: ${brl(p.price)} por ${PLAN_DAYS} dias (mensal) ou ${brl(p.price3)} por 90 dias (trimestral, sai mais barato). Benefícios: ${p.benefits.join("; ")}.`).join("\n");
}
const AI_TICKET_RULES = `Agora você está no ATENDIMENTO DE PAGAMENTO do VIP, falando com quem está comprando um plano.
Planos:
${aiPlansText()}
Como funciona a compra: na aba Premium a pessoa escolhe o plano, paga pelo link de cobrança Pix do Nubank, envia o comprovante e o pedido abre este atendimento. Um ADM confere se o valor caiu na conta e aprova; aí o plano é liberado na hora, por ${PLAN_DAYS} dias (mensal) ou 90 dias (trimestral). A pessoa recebe uma notificação quando o pedido é decidido.
Regras:
- Você NÃO aprova, não recusa e não libera pagamento nem plano, e não promete prazo exato: só um ADM faz isso. Se perguntarem, explique que a equipe confere e responde aqui mesmo.
- Só diga que o pagamento foi confirmado se o status do pedido for APROVADO.
- Reembolso, valor errado, comprovante errado, cobrança em dobro ou qualquer decisão: diga que um ADM vai responder aqui.
- Responda em no máximo 4 frases curtas.`;
const aiTier = u => (isAdmin(u) ? "max" : planOf(u));
function aiStore(uid) {
  db.ai = db.ai || {};
  const st = db.ai[uid] || (db.ai[uid] = { msgs: [], day: "", n: 0 });
  if (st.day !== dayKey()) { st.day = dayKey(); st.n = 0; }
  return st;
}
const aiMsgView = m => ({ id: m.id, r: m.r, t: m.t, ts: m.ts });

/* --- atendimento de pagamento --- */
function aiTicketPost(o, m, update) {
  const cid = "t." + o.id;
  io.to(["u:" + o.uid, "admins"]).emit(update ? "msg:update" : "msg", update ? { channelId: cid, m } : { channelId: cid, serverId: null, m });
}
function aiTicket(o) {
  if (!AI.configured() || !o) return;
  const cid = "t." + o.id;
  if (aiBusy.has(cid)) { o.aiAgain = true; return; }
  const list = db.messages[cid] || [];
  // um ADM respondeu há pouco: quem está atendendo é a equipe
  const lastAdm = [...list].reverse().find(m => !m.sys && m.a !== o.uid && m.a !== AI_ID);
  if (lastAdm && Date.now() - lastAdm.ts < 15 * 60e3) return;
  if (o.aiDay !== dayKey()) { o.aiDay = dayKey(); o.aiN = 0; }
  if ((o.aiN || 0) >= AI_TICKET_DAY) return;
  aiBusy.add(cid);
  setTimeout(() => {
    aiTicketRun(o).catch(e => console.warn("[ia] atendimento:", e && e.message)).finally(() => {
      aiBusy.delete(cid);
      if (o.aiAgain) { o.aiAgain = false; const l = db.messages[cid] || [], last = l[l.length - 1]; if (last && last.a === o.uid) aiTicket(o); }
    });
  }, 700);   // junta mensagens mandadas em sequência, sem deixar o cliente esperando à toa
}
async function aiTicketRun(o) {
  const cid = "t." + o.id, list = db.messages[cid] || [];
  const buyer = db.users[o.uid];
  const SYSN = { ocreate: "pedido criado", oreview: "a equipe começou a analisar o pedido", oapprove: "pagamento aprovado e plano liberado", oreject: "pedido recusado", oexpire: "pedido expirou sem resposta" };
  const history = AI.tidy(list.slice(-24).map(m => {
    if (m.sys) return { role: "user", content: `[Sistema: ${SYSN[m.sys] || m.sys}${m.t ? " — " + m.t : ""}]` };
    if (m.a === AI_ID) return { role: "assistant", content: m.t };
    const files = m.f && m.f.length ? ` [anexou: ${m.f.map(f => f.n).join(", ")}]` : "";
    if (m.a === o.uid) return { role: "user", content: (m.t || "") + files };
    const adm = db.users[m.a];
    return { role: "user", content: `[Mensagem do ADM ${adm ? adm.username : "da equipe"}]: ${m.t || ""}${files}` };
  }));
  if (!history.length) return;
  const status = `Pedido atual: plano ${PLANS[o.tier].name} ${CYCLES[cycleOf(o.cycle)].name.toLowerCase()} (${brl(o.amount)}), feito por ${buyer ? buyer.username : "cliente"}. Status: ${ORDER_STATUS[o.status] || o.status}${o.status === "rejected" && o.reason ? ` (motivo: ${o.reason})` : ""}.`;
  const typing = setInterval(() => io.to(["u:" + o.uid, "admins"]).emit("typing", { channelId: cid, userId: AI_ID }), 3500);
  io.to(["u:" + o.uid, "admins"]).emit("typing", { channelId: cid, userId: AI_ID });
  let m = null, lastSent = 0;
  try {
    const r = await AI.reply({
      system: [{ type: "text", text: AI_BASE + "\n\n" + AI_TICKET_RULES }, { type: "text", text: status }],
      messages: history, maxTokens: 700,
      onText: full => {
        if (!full.trim()) return;
        if (!m) {
          clearInterval(typing);
          m = { id: msgId(), a: AI_ID, t: full, ts: Date.now() };
          list.push(m); db.messages[cid] = list;
          aiTicketPost(o, m, false); lastSent = Date.now(); return;
        }
        m.t = full;
        if (Date.now() - lastSent > 350) { lastSent = Date.now(); aiTicketPost(o, m, true); }
      }
    });
    const text = r.refused || !r.text ? "Essa eu não consigo responder por aqui — um ADM da equipe vai te ajudar neste atendimento. 🙏" : r.text;
    if (!m) { m = { id: msgId(), a: AI_ID, t: text, ts: Date.now() }; list.push(m); db.messages[cid] = list; aiTicketPost(o, m, false); }
    else { m.t = text; aiTicketPost(o, m, true); }
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    o.aiN = (o.aiN || 0) + 1;
    save();
  } finally { clearInterval(typing); }
}

/* --- bate-papo exclusivo dos assinantes --- */
async function aiChatRun(uid, replyId) {
  const u = db.users[uid], st = aiStore(uid), tier = aiTier(u);
  let chars = 0;
  const recent = [];
  for (let i = st.msgs.length - 1; i >= 0 && recent.length < 20; i--) {   // histórico curto = resposta mais rápida
    chars += st.msgs[i].t.length;
    if (chars > 16000 && recent.length) break;
    recent.unshift(st.msgs[i]);
  }
  const history = AI.tidy(recent.map(m => ({ role: m.r === "a" ? "assistant" : "user", content: m.t })));
  const sys = AI_BASE + `\n\nAgora você está no bate-papo exclusivo para assinantes VIP. A pessoa se chama ${u.username} e tem o plano ${(PLANS[tier] || PLANS.max).name}. Converse sobre qualquer assunto: dúvidas, jogos, estudos, ideias, textos e ajuda com o app. Ajuste o tamanho: curto para papo, mais completo quando pedirem explicação.`;
  // Streaming: o app novo (v4+) recebe só o pedaço novo ("ai:chunk", n = onde o pedaço começa);
  // o app antigo continua recebendo o texto inteiro ("ai:delta"). Antes, cada atualização reenviava
  // a resposta toda: numa resposta longa isso virava centenas de KB pela rede e travava o celular.
  let last = 0, sent = 0;
  const flush = full => {
    const ids = online.get(uid);
    if (ids) for (const sid of ids) {
      const s = io.sockets.sockets.get(sid);
      if (!s) continue;
      if (Number(s.handshake.auth && s.handshake.auth.v) >= 4) s.emit("ai:chunk", { id: replyId, n: Math.min(sent, full.length), d: full.slice(Math.min(sent, full.length)) });
      else if (full) s.emit("ai:delta", { id: replyId, t: full });
    }
    sent = full.length; last = Date.now();
  };
  const r = await AI.reply({
    system: sys, messages: history, maxTokens: 2500,
    // a IA trocou de provedor no meio (texto recomeçou): avisa na hora; senão, no máximo a cada 50 ms
    onText: full => { if (full.length < sent || Date.now() - last > 50) flush(full); }
  });
  const text = r.refused || !r.text ? "Desculpa, sobre isso eu não consigo ajudar. Quer falar de outra coisa? 🙂" : r.text;
  const m = { id: replyId, r: "a", t: text, ts: Date.now() };
  st.msgs.push(m);
  // o app mostra só as últimas 80 e a IA lê só as últimas 20: guardar mais só inchava o banco
  // (que é regravado inteiro a cada segundo com mudanças)
  if (st.msgs.length > AI_KEEP) st.msgs.splice(0, st.msgs.length - AI_KEEP);
  st.n++;
  save();
  io.to("u:" + uid).emit("ai:done", { msg: aiMsgView(m), used: st.n });
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
  if (isAdmin(me())) socket.join("admins");
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
    const ids = new Set([...mine.map(s => s.id), ...dms.map(d => d.id)]);
    socket.emit("ready", {
      me: meView(me()),
      servers: mine.map(serverView),
      users: [...users.values()],
      friends: Object.fromEntries(Object.entries(friends).filter(([id]) => db.users[id])),
      dms: dms.map(d => dmView(d, uid)),
      steamAuto: !!STEAM_KEY,
      acts: [...acts].filter(([cid]) => ids.has(chanIndex.get(cid))).map(([cid, a]) => ({ channelId: cid, type: a.type })),
      now: Date.now(),
      voice: [...voice].filter(([, v]) => ids.has(v.sid)).map(([k, v]) => vView(k, v)),
      iceServers: ICE_SERVERS,
      limits: { voice: VOICE_LIMIT, msg: MSG_MAX[rankOf(me())] },
      ver: APP_VER,
      announce: db.settings.announce || null,
      outdated: socket.data.outdated || null
    });
    // app aberto numa versão antiga (não sabe se atualizar sozinho): avisa uma vez para recarregar
    if (!(socket.handshake.auth && socket.handshake.auth.v) && !newsSent.has(uid)) {
      newsSent.add(uid);
      setTimeout(() => socket.emit("announce", { text: NEWS_OLD, by: "Equipe Auryx" }), 1500);
    }
  }

  // Limitadores simples por conexão
  const mk = (n, ms) => { const b = { t: 0, n: 0 }; return (cost = 1) => { const now = Date.now(); if (now - b.t > ms) { b.t = now; b.n = 0; } b.n += cost; return b.n <= n; }; };
  const general = mk(60, 5000), signals = mk(400, 5000), typing = mk(3, 6000), passLimit = mk(5, 60000);
  // envio de mensagens: quem assina pode mandar mais seguidas (o limite acompanha o plano atual)
  const chatB = { t: 0, n: 0 };
  const chat = () => { const now = Date.now(); if (now - chatB.t > 4000) { chatB.t = now; chatB.n = 0; } chatB.n++; return chatB.n <= MSG_RATE[rankOf(me())]; };

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
  const needPerm = (s, p) => { if (!hasPerm(s, uid, p)) fail("Você não tem permissão para isso neste servidor."); };
  // só age em quem está abaixo de você na lista de cargos (o dono está acima de todos)
  const above = (s, target) => { if (target === s.ownerId || topPos(s, uid) <= topPos(s, target)) fail("Essa pessoa tem um cargo igual ou acima do seu."); };
  const getServer = (id, owner) => {
    const s = typeof id === "string" ? db.servers[id] : null;
    if (!s || !s.members.includes(uid)) fail("Servidor não encontrado.");
    if (s.blocked) fail("Este servidor foi bloqueado pela equipe da Auryx.");
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
    if (typeof channelId === "string" && channelId.startsWith("t.")) {
      // atendimento de pagamento: só o dono do pedido e os ADMs
      const o = db.orders[channelId.slice(2)];
      if (!o || (o.uid !== uid && !isAdmin(me()))) fail("Atendimento não encontrado.");
      return { s: null, c: { id: channelId }, rooms: ["u:" + o.uid, "admins"], dm: null, order: o };
    }
    if (typeof channelId === "string" && (channelId.startsWith("d.") || channelId.startsWith("g."))) {
      const d = db.dms && db.dms[channelId];
      if (!d || !d.members.includes(uid)) fail("Conversa não encontrada.");
      return { s: null, c: { id: d.id }, rooms: d.members.map(x => "u:" + x), dm: d };
    }
    const { s, c } = getChannel(channelId);
    if (c.type !== "text" && c.type !== "voice") fail("Canal não encontrado.");   // sala de voz também tem chat (chat da call)
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

  on("send", ({ channelId, text, replyTo, nonce, files }) => {
    const { s, c, rooms, dm } = getTarget(channelId);
    text = typeof text === "string" ? text.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, MSG_MAX[rankOf(me())]) : "";
    const att = [];
    if (Array.isArray(files)) for (const fid of files.slice(0, 10)) {
      const f = typeof fid === "string" ? db.files[fid] : null;
      if (f && f.o === uid && !f.u) { f.u = 1; att.push({ id: fid, n: f.n, t: f.t, s: f.s, w: undefined }); }
    }
    if (!text && !att.length) fail("A mensagem está vazia.");
    if (!chat()) fail("Devagar! Espere um instante antes de enviar de novo.");
    const list = db.messages[c.id] || (db.messages[c.id] = []);
    const m = { id: msgId(), a: uid, t: text, ts: Date.now() };
    if (att.length) m.f = att.map(({ id, n, t, s: size }) => ({ id, n, t, s: size }));
    if (typeof replyTo === "string") {
      const r = list.find(x => x.id === replyTo && !x.sys);
      if (r) m.re = { id: r.id, a: r.a, t: r.t.slice(0, 140) };
    }
    if (dm && !dm.group && !list.length) {
      // primeira mensagem: a conversa aparece para a outra pessoa
      for (const id of dm.members) {
        const other = db.users[dm.members.find(x => x !== id) || id];
        io.to("u:" + id).emit("dm:add", { dm: dmView(dm, id), user: other ? pubUser(other) : null });
      }
    }
    list.push(m);
    countMsg();
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    save();
    io.to(rooms).emit("msg", { channelId: c.id, serverId: s ? s.id : null, m, nonce: str(nonce, 40) });
    // push para quem está com o app fechado: privado, grupo, atendimento e menções
    const author = me().username, preview = (text || "📎 Anexo").slice(0, 140), url = "/?c=" + encodeURIComponent(c.id);
    if (dm) for (const id of dm.members) { if (id !== uid) pushTo(id, { title: dm.group ? `${author} em ${dm.name || "grupo"}` : author, body: preview, url, tag: c.id }); }
    else {
      const tgt = getTarget(c.id);
      if (tgt.order) {
        const to = tgt.order.uid === uid ? Object.values(db.users).filter(isAdmin).map(u => u.id) : [tgt.order.uid];
        for (const id of to) if (id !== uid) pushTo(id, { title: `Atendimento · ${PLANS[tgt.order.tier].name}`, body: `${author}: ${preview}`, url, tag: c.id });
        if (tgt.order.uid === uid && !isAdmin(me())) aiTicket(tgt.order);
      } else if (s) {
        const ids = new Set(mentionedIn(text, s.members));
        if (m.re && m.re.a) ids.add(m.re.a);
        for (const id of ids) if (id !== uid) pushTo(id, { title: `${author} em #${c.name || "canal"} (${s.name})`, body: preview, url, tag: c.id });
      }
    }
    return { id: m.id };
  });

  on("edit", ({ channelId, id, text }) => {
    const { c, m, rooms } = findMsg(channelId, id);
    if (m.a !== uid) fail("Você só pode editar suas mensagens.");
    text = typeof text === "string" ? text.replace(/\r\n?/g, "\n").trim().slice(0, MSG_MAX[rankOf(me())]) : "";
    if (!text) fail("A mensagem está vazia.");
    if (text === m.t) return { ok: true };
    m.t = text; m.e = Date.now();
    save();
    io.to(rooms).emit("msg:update", { channelId: c.id, m });
  });

  on("delete", ({ channelId, id }) => {
    const { s, c, m, rooms } = findMsg(channelId, id);
    if (m.a !== uid && !(s && hasPerm(s, uid, "messages"))) fail("Sem permissão para apagar esta mensagem.");
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
    if (data.channelId.startsWith("t.")) {
      const o = db.orders[data.channelId.slice(2)];
      if (o && (o.uid === uid || isAdmin(me()))) socket.to(["u:" + o.uid, "admins"]).emit("typing", { channelId: data.channelId, userId: uid });
      return;
    }
    if (data.channelId.startsWith("d.") || data.channelId.startsWith("g.")) {
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

  on("server:update", ({ serverId, name, icon, color, description, isPublic, banner, accent }) => {
    const s = getServer(serverId);
    needPerm(s, "server");
    if (name !== undefined) { const n = str(name, 40); if (n.length < 2) fail("Nome muito curto."); s.name = n; }
    if (icon !== undefined) s.icon = cleanPic(icon);
    if (color !== undefined && isColor(color)) s.color = color;
    if (description !== undefined) s.description = str(description, 200);
    if (isPublic !== undefined) s.public = !!isPublic;
    // personalização: banner do servidor (imagem enviada) e cor temática aplicada no app de quem está dentro
    if (banner !== undefined) { const b = cleanPic(banner); s.banner = b.startsWith("/f/") ? b : ""; }
    if (accent !== undefined) s.accent = isColor(accent) ? accent : "";
    save();
    io.to("s:" + s.id).emit("server:update", { server: serverMeta(s) });
  });

  on("server:delete", ({ serverId }) => {
    const s = getServer(serverId, true);
    for (const [k, v] of voice) if (v.sid === s.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
    deleteServer(s, `O servidor "${s.name}" foi excluído.`);
  });

  on("server:leave", ({ serverId }) => {
    const s = getServer(serverId);
    if (s.ownerId === uid) fail("Você é o dono. Transfira ou exclua o servidor.");
    removeMember(s, uid, null);
  });

  on("server:kick", ({ serverId, userId }) => {
    const s = getServer(serverId);
    needPerm(s, "kick");
    if (userId === uid || !s.members.includes(userId)) fail("Membro inválido.");
    above(s, userId);
    if (s.memberRoles) delete s.memberRoles[userId];
    serverLog(s, "kick", userId);
    removeMember(s, userId, `Você foi removido de "${s.name}".`);
  });

  const serverLog = (s, action, target, extra) => {
    s.log = s.log || [];
    s.log.push({ at: Date.now(), by: uid, action, target: target || "", ...(extra || {}) });
    if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
  };
  const cleanPerms = (s, perms) => {
    const list = Array.isArray(perms) ? PERMS.filter(p => perms.includes(p)) : [];
    for (const p of list) if (!hasPerm(s, uid, p)) fail("Você não pode dar uma permissão que você não tem.");
    return list;
  };
  on("role:save", ({ serverId, roleId, name, color, perms, hoist, icon }) => {
    const s = getServer(serverId);
    needPerm(s, "roles");
    s.roles = s.roles || [];
    name = str(name, 32).replace(/\s+/g, " ");
    if (!name) fail("Dê um nome ao cargo.");
    color = isColor(color) ? color : "#99aab5";
    icon = str(icon, 16);
    if (/[<>&"'`]/.test(icon) || /^[ -~]+$/.test(icon)) icon = "";   // só emoji
    if (roleId) {
      const i = s.roles.findIndex(r => r.id === roleId);
      if (i < 0) fail("Cargo não encontrado.");
      if (i >= topPos(s, uid)) fail("Você só pode editar cargos abaixo do seu.");
      Object.assign(s.roles[i], { name, color, icon, perms: cleanPerms(s, perms), hoist: !!hoist });
      serverLog(s, "role:edit", "", { role: name });
    } else {
      if (s.roles.length >= MAX_ROLES) fail(`Máximo de ${MAX_ROLES} cargos por servidor.`);
      s.roles.unshift({ id: newId(), name, color, icon, perms: cleanPerms(s, perms), hoist: !!hoist });   // nasce no fim da lista
      serverLog(s, "role:create", "", { role: name });
    }
    save(); emitRoles(s);
    return { ok: true };
  });
  on("role:delete", ({ serverId, roleId }) => {
    const s = getServer(serverId);
    needPerm(s, "roles");
    const i = (s.roles || []).findIndex(r => r.id === roleId);
    if (i < 0) fail("Cargo não encontrado.");
    if (i >= topPos(s, uid)) fail("Você só pode apagar cargos abaixo do seu.");
    const [r] = s.roles.splice(i, 1);
    for (const k of Object.keys(s.memberRoles || {})) s.memberRoles[k] = s.memberRoles[k].filter(x => x !== roleId);
    serverLog(s, "role:delete", "", { role: r.name });
    save(); emitRoles(s);
    return { ok: true };
  });
  on("role:move", ({ serverId, roleId, dir }) => {
    const s = getServer(serverId);
    needPerm(s, "roles");
    const i = (s.roles || []).findIndex(r => r.id === roleId), j = i + (dir > 0 ? 1 : -1);   // +1 = sobe
    if (i < 0 || j < 0 || j >= s.roles.length) return { ok: true };
    if (Math.max(i, j) >= topPos(s, uid)) fail("Você só pode organizar cargos abaixo do seu.");
    [s.roles[i], s.roles[j]] = [s.roles[j], s.roles[i]];
    save(); emitRoles(s);
    return { ok: true };
  });
  on("member:roles", ({ serverId, userId, roleIds }) => {
    const s = getServer(serverId);
    needPerm(s, "roles");
    if (!s.members.includes(userId)) fail("Membro inválido.");
    if (userId !== uid) above(s, userId);
    const want = new Set(Array.isArray(roleIds) ? roleIds : []);
    const had = new Set((s.memberRoles && s.memberRoles[userId]) || []);
    const top = topPos(s, uid);
    (s.roles || []).forEach((r, i) => { if (want.has(r.id) !== had.has(r.id) && i >= top) fail(`Você não pode mexer no cargo "${r.name}" (está acima ou igual ao seu).`); });
    s.memberRoles = s.memberRoles || {};
    s.memberRoles[userId] = (s.roles || []).filter(r => want.has(r.id)).map(r => r.id);
    serverLog(s, "member:roles", userId);
    save(); emitRoles(s);
    return { ok: true };
  });
  on("server:ban", ({ serverId, userId, reason }) => {
    const s = getServer(serverId);
    needPerm(s, "ban");
    if (userId === uid || !db.users[userId]) fail("Membro inválido.");
    if (s.members.includes(userId)) above(s, userId);
    s.bans = s.bans || {};
    s.bans[userId] = { at: Date.now(), by: uid, reason: str(reason, 200) };
    if (s.memberRoles) delete s.memberRoles[userId];
    serverLog(s, "ban", userId, { reason: str(reason, 200) });
    if (s.members.includes(userId)) removeMember(s, userId, `Você foi banido de "${s.name}".${reason ? " Motivo: " + str(reason, 200) : ""}`);
    else save();
    return { ok: true };
  });
  on("server:unban", ({ serverId, userId }) => {
    const s = getServer(serverId);
    needPerm(s, "ban");
    if (!s.bans || !s.bans[userId]) fail("Essa pessoa não está banida.");
    delete s.bans[userId];
    serverLog(s, "unban", userId);
    save();
    return { ok: true };
  });
  on("server:bans", ({ serverId }) => {
    const s = getServer(serverId);
    needPerm(s, "ban");
    return { bans: Object.entries(s.bans || {}).map(([id, b]) => ({ user: db.users[id] ? pubUser(db.users[id]) : { id, username: "Conta apagada" }, at: b.at, reason: b.reason, by: (db.users[b.by] || {}).username || "?" })) };
  });
  on("server:log", ({ serverId }) => {
    const s = getServer(serverId);
    if (!canManagePerms(s)(uid)) fail("Você não tem permissão para isso neste servidor.");
    const nm = id => (db.users[id] || {}).username || "?";
    return { log: (s.log || []).slice(-150).reverse().map(x => ({ ...x, byName: nm(x.by), targetName: x.target ? nm(x.target) : "" })) };
  });
  on("server:transfer", ({ serverId, userId }) => {
    const s = getServer(serverId, true);
    if (userId === uid || !s.members.includes(userId)) fail("Membro inválido.");
    s.ownerId = userId;
    save();
    io.to("s:" + s.id).emit("server:update", { server: serverMeta(s) });
  });

  /* ---------- Convites e descoberta ---------- */
  // Convite: sem opções = o link permanente de sempre; com validade/limite = um link novo só para isso
  const INV_HOURS = [0, 1, 6, 24, 168], INV_USES = [0, 1, 5, 10, 25, 100];
  on("invite:create", ({ serverId, hours, maxUses }) => {
    const s = getServer(serverId);
    hours = INV_HOURS.includes(+hours) ? +hours : 0;
    maxUses = INV_USES.includes(+maxUses) ? +maxUses : 0;
    let code = !hours && !maxUses ? Object.keys(db.invites).find(k => { const v = db.invites[k]; return v.serverId === s.id && v.by === uid && !v.exp && !v.max; }) : null;
    if (!code) {
      const mine = Object.entries(db.invites).filter(([, v]) => v.by === uid && v.serverId === s.id);
      if (mine.length >= 25) {   // limpa os vencidos/esgotados antes de criar mais
        for (const [k, v] of mine) if (!inviteOk(v)) delete db.invites[k];
        if (Object.values(db.invites).filter(v => v.by === uid && v.serverId === s.id).length >= 25) fail("Você já tem convites demais neste servidor.");
      }
      do code = randomCode(8); while (db.invites[code]);
      db.invites[code] = { serverId: s.id, by: uid, created: Date.now(), uses: 0, ...(hours ? { exp: Date.now() + hours * 3600e3 } : {}), ...(maxUses ? { max: maxUses } : {}) };
      save();
    }
    const v = db.invites[code];
    return { code, exp: v.exp || 0, max: v.max || 0, uses: v.uses || 0 };
  });

  on("invite:info", ({ code }) => {
    const inv = db.invites[parseCode(code)];
    const s = inv && db.servers[inv.serverId];
    if (!s || s.blocked) fail("Convite inválido ou expirado.");
    if (!inviteOk(inv) && !s.members.includes(uid)) fail(inv.max && inv.uses >= inv.max ? "Esse convite já atingiu o limite de usos." : "Esse convite expirou.");
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
    if (!s || s.blocked) fail("Convite inválido ou expirado.");
    if (!s.members.includes(uid) && !inviteOk(inv)) fail(inv.max && inv.uses >= inv.max ? "Esse convite já atingiu o limite de usos." : "Esse convite expirou.");
    if (addMember(s, uid)) { inv.uses++; save(); }
    return { serverId: s.id };
  });

  on("discover", ({ q }) => {
    const query = str(q, 40).toLowerCase();
    return {
      servers: Object.values(db.servers)
        .filter(s => s.public && !s.blocked && (!query || s.name.toLowerCase().includes(query) || (s.description || "").toLowerCase().includes(query)))
        .map(s => ({ ...serverMeta(s), members: s.members.length, online: onlineCount(s), joined: s.members.includes(uid) }))
        .sort((a, b) => b.online - a.online || b.members - a.members)
        .slice(0, 60)
    };
  });

  on("discover:join", ({ serverId }) => {
    const s = typeof serverId === "string" ? db.servers[serverId] : null;
    if (!s || !s.public || s.blocked) fail("Servidor não encontrado.");
    addMember(s, uid);
    return { serverId: s.id };
  });

  /* ---------- Canais ---------- */
  on("channel:create", ({ serverId, name, type, topic, emoji, cat }) => {
    const s = getServer(serverId);
    needPerm(s, "channels");
    type = type === "voice" ? "voice" : "text";
    name = cleanChannelName(name, type);
    if (!name) fail("Dê um nome ao canal.");
    if (s.channels.length >= MAX_CHANNELS) fail("Limite de canais atingido.");
    const c = { id: newId(), name, type, topic: type === "text" ? str(topic, 160) : "", emoji: cleanEmoji(emoji), cat: str(cat, 30) };
    s.channels.push(c);
    chanIndex.set(c.id, s.id);
    save();
    io.to("s:" + s.id).emit("channel:add", { serverId: s.id, channel: chanView(c) });
    return { id: c.id };
  });

  on("channel:update", ({ channelId, name, topic, emoji, cat }) => {
    const { s, c } = getChannel(channelId);
    needPerm(s, "channels");
    if (name !== undefined) { const n = cleanChannelName(name, c.type); if (!n) fail("Nome inválido."); c.name = n; }
    if (topic !== undefined && c.type === "text") c.topic = str(topic, 160);
    if (emoji !== undefined) c.emoji = cleanEmoji(emoji);
    if (cat !== undefined) c.cat = str(cat, 30).replace(/\s+/g, " ");
    save();
    io.to("s:" + s.id).emit("channel:update", { serverId: s.id, channel: chanView(c) });
  });

  on("channel:delete", ({ channelId }) => {
    const { s, c } = getChannel(channelId);
    needPerm(s, "channels");
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
    needPerm(s, "channels");
    const same = s.channels.filter(x => x.type === c.type);
    const i = same.indexOf(c), j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= same.length) return { ok: true };
    const a = s.channels.indexOf(c), b = s.channels.indexOf(same[j]);
    [s.channels[a], s.channels[b]] = [s.channels[b], s.channels[a]];
    save();
    io.to("s:" + s.id).emit("channels:order", { serverId: s.id, order: s.channels.map(x => x.id) });
  });

  /* ---------- Perfil ---------- */
  on("profile:update", async ({ color, avatar, about, status, steam, game, banner, bannerStill, bp, ap, theme, pron, cs, fx, pfx, ring, accent }) => {
    const u = me();
    // benefícios Premium: o servidor confere o plano (limpar é sempre permitido)
    const r = rankOf(u);
    const need = (k, val) => { if (val && r < NEED[k]) fail(`Esse recurso faz parte do plano ${RANK_NAME[NEED[k]]}. Veja em Configurações › Planos.`); };
    // imagem enviada por esta conta: confere o tipo e o peso guardados no envio
    const ownImg = (url, max) => {
      const m = FILE_URL_RE.exec(url || ""), f = m && db.files[m[1]];
      if (!f || f.o !== uid || !/^image\//.test(f.t)) fail("Envie uma imagem (PNG, JPG, WEBP ou GIF).");
      if (f.s > max) fail(`Imagem pesada demais (máximo ${Math.round(max / 1048576)} MB).`);
      return f;
    };
    if (banner !== undefined) {
      const b = isColor(banner) ? banner : cleanPic(banner).startsWith("/f/") ? cleanPic(banner) : "";
      need("banner", b);
      let gif = false;
      if (b.startsWith("/f/") && b !== u.banner) gif = ownImg(b, BANNER_GIF_MAX).t === "image/gif";
      else if (b.startsWith("/f/")) gif = !!u.bannerStill;
      u.banner = b;
      // banner animado: guarda também o 1º quadro (aparece com "reduzir animações" ou se o GIF não carregar)
      if (!gif) u.bannerStill = "";
      else if (bannerStill !== undefined) { const st = cleanPic(bannerStill); u.bannerStill = st.startsWith("/f/") && ownImg(st, 2 * 1048576) ? st : ""; }
    }
    // enquadramento do banner (imagem/GIF): x/y = ponto que fica no centro (0–100%), z = zoom (100–300%), h = altura
    if (bp !== undefined) {
      const n = (v, lo, hi, def) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };
      const v = bp && typeof bp === "object" ? { x: n(bp.x, 0, 100, 50), y: n(bp.y, 0, 100, 50), z: n(bp.z, 100, 300, 100), h: ["s", "m", "l"].includes(bp.h) ? bp.h : "m" } : null;
      const isDefault = !v || (v.x === 50 && v.y === 50 && v.z === 100 && v.h === "m");
      if (!isDefault) need("banner", true);
      u.bp = isDefault ? null : v;
    }
    // enquadramento do avatar (imagem/GIF): x/y = ponto no centro do círculo (0–100%), z = zoom (100–300%)
    if (ap !== undefined) {
      const n = (v, lo, hi, def) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };
      const v = ap && typeof ap === "object" ? { x: n(ap.x, 0, 100, 50), y: n(ap.y, 0, 100, 50), z: n(ap.z, 100, 300, 100) } : null;
      const isDefault = !v || (v.x === 50 && v.y === 50 && v.z === 100);
      if (!isDefault) need("avatarFile", true);
      u.ap = isDefault ? null : v;
    }
    if (ring !== undefined) { const v = RINGS[ring] ? ring : ""; if (v && r < RINGS[v]) fail(`Essa moldura faz parte do plano ${RANK_NAME[RINGS[v]]}.`); u.ring = v; }
    if (accent !== undefined) { const a = Array.isArray(accent) && accent.length === 2 && accent.every(isColor) ? accent : null; need("accent", a); u.accent = a; }
    if (theme !== undefined) { const t = Array.isArray(theme) && theme.length === 2 && theme.every(isColor) ? theme : null; need("theme", t); u.theme = t; }
    if (pron !== undefined) u.pron = str(pron, 24);
    if (cs !== undefined) { const t = str(cs && cs.t, 60), e = str(cs && cs.e, 16); need("cs", t || e); u.cs = t || e ? { t, e } : null; }
    if (fx !== undefined) { const v = ["", "grad", "glow", "rainbow"].includes(fx) ? fx : ""; need("fx", v); u.fx = v; }
    if (pfx !== undefined) { const v = PFXS.includes(pfx) ? pfx : ""; need("pfx", v); u.pfx = v; }
    if (avatar !== undefined && typeof avatar === "string" && avatar.startsWith("/f/")) need("avatarFile", true);
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
    if (accent !== undefined || ring !== undefined) io.to("u:" + uid).emit("me:update", { me: meView(u) });
    if (steam) pollSteam();
  });

  /* ---------- planos, pedidos Pix e atendimento ---------- */
  const requireAdmin = () => { const u = me(); if (!isAdmin(u)) fail("Apenas ADMs podem fazer isso."); return u; };
  // ações críticas: só o ADM Supremo (dono do app)
  const requireSupreme = () => { const u = me(); if (!isOwnerUser(u)) fail("Só o ADM Supremo pode fazer isso."); return u; };
  const ticketMsg = (o, authorId, kind, text, files) => {
    const cid = "t." + o.id;
    const list = db.messages[cid] || (db.messages[cid] = []);
    const m = { id: msgId(), a: authorId, t: text || "", ts: Date.now() };
    if (kind) m.sys = kind;
    if (files) m.f = files;
    list.push(m);
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    io.to(["u:" + o.uid, "admins"]).emit("msg", { channelId: cid, serverId: null, m });
  };
  const audit = (action, target, details) => {
    db.audit.push({ at: Date.now(), admin: uid, action, target, details });
    if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
  };
  const grantPlan = (u, tier, days, orderId) => {
    const now = Date.now(), cur = planOf(u);
    let base = now, since = now, credit = 0;
    if (cur === tier) { base = Math.max(u.plan.until, now); since = u.plan.since || now; }
    else if (cur) credit = Math.round((u.plan.until - now) * PLANS[cur].price / PLANS[tier].price);   // troca de plano: o tempo pago que sobrou é convertido
    u.plan = { tier, since, until: base + credit + days * 86400e3, order: orderId || "", by: uid };
    u.planLog = (u.planLog || []).concat({ at: now, tier, days, order: orderId || "", credit: Math.round(credit / 3600e3), from: cur || "" }).slice(-50);
    save();
    emitToPeers(u.id, "user:update", { user: pubUser(u) });
    io.to("u:" + u.id).emit("me:update", { me: meView(u) });
  };

  /* --- Aury: bate-papo com IA exclusivo dos assinantes --- */
  on("ai:state", () => {
    const tier = aiTier(me()), st = aiStore(uid);
    return { on: AI.configured(), tier, limit: tier ? AI_LIMIT[tier] : 0, limits: AI_LIMIT, used: st.n, busy: aiBusy.has("c." + uid), msgs: tier ? st.msgs.slice(-AI_KEEP).map(aiMsgView) : [] };
  });
  on("ai:send", ({ text }) => {
    const tier = aiTier(me());
    if (!tier) fail("A Aury é exclusiva para assinantes (VIP, Pro ou Max).");
    if (!AI.configured()) fail("A IA ainda não foi ligada pela equipe. Tente mais tarde.");
    text = typeof text === "string" ? text.replace(/\r\n?/g, "\n").trim().slice(0, 4000) : "";
    if (!text) fail("Escreva uma mensagem.");
    if (aiBusy.has("c." + uid)) fail("Espere a Aury terminar de responder.");
    const st = aiStore(uid);
    if (st.n >= AI_LIMIT[tier]) fail(`Você usou as ${AI_LIMIT[tier]} mensagens de hoje do plano ${PLANS[tier].name}. Amanhã tem mais!${tier !== "max" ? " Nos planos maiores o limite é maior." : ""}`);
    if (!chat()) fail("Devagar! Espere um instante.");
    const m = { id: msgId(), r: "u", t: text, ts: Date.now() };
    st.msgs.push(m);
    save();
    const replyId = msgId();
    aiBusy.add("c." + uid);
    aiChatRun(uid, replyId)
      .catch(e => { console.warn("[ia] chat:", e && e.message); io.to("u:" + uid).emit("ai:error", { id: replyId, error: "A Aury não conseguiu responder agora. Tente de novo em instantes." }); })
      .finally(() => aiBusy.delete("c." + uid));
    return { msg: aiMsgView(m), replyId };
  });
  on("ai:clear", () => {
    const st = aiStore(uid);
    if (aiBusy.has("c." + uid)) fail("Espere a Aury terminar de responder.");
    st.msgs = [];
    save();
    return { ok: true };
  });

  on("plans:get", () => {
    const u = me();
    return {
      // link de cobrança de cada ciclo (o ADM Supremo pode trocar no painel); sem link, o app mostra a chave Pix
      plans: Object.values(PLANS).map(p => ({ tier: p.tier, name: p.name, price: p.price, price3: p.price3, link: payLink(p, "m"), link3: payLink(p, "q"), benefits: p.benefits, rank: p.rank })),
      pixKey: db.settings.pixKey || "",
      mine: planOf(u) ? { tier: u.plan.tier, until: u.plan.until, since: u.plan.since || 0 } : null,
      last: !planOf(u) && u.plan && u.plan.until ? { tier: u.plan.tier, until: u.plan.until } : null,
      log: (u.planLog || []).slice(-20).reverse().map(x => ({ ...x, name: (PLANS[x.tier] || {}).name || x.tier })),
      orders: Object.values(db.orders).filter(o => o.uid === uid).sort((a, b) => b.created - a.created).map(o => orderView(o, false)),
      admin: isAdmin(u)
    };
  });

  on("order:create", ({ tier, receipt, note, cycle }) => {
    const p = PLANS[tier];
    if (!p) fail("Plano inválido.");
    cycle = cycleOf(cycle);
    const price = priceOf(p, cycle);
    const f = typeof receipt === "string" ? db.files[receipt] : null;
    if (!f || f.o !== uid || !f.p) fail("Envie o comprovante do pagamento antes de continuar.");
    if (f.u) fail("Esse comprovante já foi usado em outro pedido.");
    if (f.h && Object.values(db.orders).some(x => x.status !== "rejected" && db.files[x.receipt] && db.files[x.receipt].h === f.h)) fail("Esse comprovante já foi enviado em outro pedido. Se for um pagamento novo, envie o comprovante dele.");
    const open = Object.values(db.orders).filter(o => o.uid === uid && (o.status === "pending" || o.status === "review"));
    if (open.length >= 3) fail("Você já tem pedidos em análise. Aguarde a resposta da equipe.");
    f.u = 1;
    const o = { id: newId(), uid, tier, cycle, amount: price, status: "pending", receipt, note: str(note, 500), created: Date.now(), updated: Date.now() };
    db.orders[o.id] = o;
    ticketMsg(o, uid, "", `Pedido do plano ${p.name} ${CYCLES[cycle].name.toLowerCase()} — ${CYCLES[cycle].days} dias (${brl(price)}). Segue o comprovante do Pix.${o.note ? "\n\n" + o.note : ""}`, [{ id: receipt, n: f.n, t: f.t, s: f.s }]);
    ticketMsg(o, uid, "ocreate", "");
    save();
    pushOrder(o);
    io.to("admins").emit("order:new", { order: orderView(o, true) });
    aiTicket(o);
    return { order: orderView(o, false) };
  });

  on("order:list", ({ status }) => {
    requireAdmin();
    return {
      orders: Object.values(db.orders).filter(o => !status || status === "all" || o.status === status || (status === "open" && (o.status === "pending" || o.status === "review")))
        .sort((a, b) => b.created - a.created).slice(0, 300).map(o => orderView(o, true))
    };
  });

  on("order:get", ({ id }) => {
    const o = typeof id === "string" ? db.orders[id] : null;
    if (!o || (o.uid !== uid && !isAdmin(me()))) fail("Pedido não encontrado.");
    return { order: orderView(o, isAdmin(me())) };
  });

  on("order:review", ({ id }) => {
    requireAdmin();
    const o = db.orders[id];
    if (!o) fail("Pedido não encontrado.");
    if (o.status !== "pending" && o.status !== "expired") fail("Esse pedido não está pendente.");
    o.status = "review"; o.updated = Date.now();
    audit("order:review", o.uid, { order: o.id });
    ticketMsg(o, uid, "oreview", "");
    save(); pushOrder(o);
  });

  on("order:approve", ({ id, confirm }) => {
    requireAdmin();
    const o = db.orders[id];
    if (!o) fail("Pedido não encontrado.");
    if (!ordersOpen(o) && o.status !== "expired") fail("Esse pedido já foi decidido.");
    if (confirm !== true) fail("Confirme que o valor caiu na conta antes de aprovar.");
    const u = db.users[o.uid];
    if (!u) fail("O usuário não existe mais.");
    o.status = "approved"; o.by = uid; o.decided = o.updated = Date.now();
    grantPlan(u, o.tier, CYCLES[cycleOf(o.cycle)].days, o.id);
    audit("order:approve", o.uid, { order: o.id, tier: o.tier, amount: o.amount });
    ticketMsg(o, uid, "oapprove", PLANS[o.tier].name);
    pushTo(o.uid, { title: "Pagamento aprovado! 🎉", body: `Seu plano ${PLANS[o.tier].name} foi liberado.`, url: "/?abrir=premium", tag: "order:" + o.id });
    save(); pushOrder(o);
  });

  on("order:reject", ({ id, reason }) => {
    requireAdmin();
    const o = db.orders[id];
    if (!o) fail("Pedido não encontrado.");
    if (!ordersOpen(o) && o.status !== "expired") fail("Esse pedido já foi decidido.");
    reason = str(reason, 400);
    if (reason.length < 3) fail("Escreva o motivo da recusa.");
    o.status = "rejected"; o.reason = reason; o.by = uid; o.decided = o.updated = Date.now();
    audit("order:reject", o.uid, { order: o.id, tier: o.tier, reason });
    ticketMsg(o, uid, "oreject", reason);
    pushTo(o.uid, { title: "Pedido recusado", body: `Plano ${PLANS[o.tier].name}: ${reason}`, url: "/?c=t." + o.id, tag: "order:" + o.id });
    save(); pushOrder(o);
  });

  /* ---------- painel ADM: planos dos usuários e histórico ---------- */
  on("admin:users", ({ q }) => {
    requireAdmin();
    const s = str(q, 60).toLowerCase();
    const list = Object.values(db.users).filter(u => !s || u.username.toLowerCase().includes(s) || (u.email || "").includes(s) || (s === "premium" && planOf(u)));
    return {
      users: list.sort((a, b) => rankOf(b) - rankOf(a) || a.username.localeCompare(b.username)).slice(0, 100)
        .map(u => ({ id: u.id, username: u.username, color: u.color, avatar: pubUser(u).avatar, email: u.email || "", emailVerified: !!u.emailVerified, plan: planOf(u), until: planOf(u) ? u.plan.until : 0, created: u.created, admin: isAdmin(u), banned: u.banned ? { at: u.banned.at, reason: u.banned.reason || "" } : null }))
    };
  });
  on("admin:grant", ({ userId, tier, days }) => {
    requireAdmin();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    if (!PLANS[tier]) fail("Plano inválido.");
    days = Math.round(+days);
    if (!(days >= 1 && days <= 366)) fail("Escolha de 1 a 366 dias.");
    grantPlan(u, tier, days, "");
    audit("plan:grant", u.id, { tier, days });
    save();
  });
  on("admin:revoke", ({ userId, reason }) => {
    requireAdmin();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    reason = str(reason, 300);
    if (reason.length < 3) fail("Escreva o motivo.");
    const old = planOf(u);
    if (!old) fail("Esse usuário não tem plano ativo.");
    u.plan = null;
    save();
    audit("plan:revoke", u.id, { tier: old, reason });
    emitToPeers(u.id, "user:update", { user: pubUser(u) });
    io.to("u:" + u.id).emit("me:update", { me: meView(u) });
    io.to("u:" + u.id).emit("plan:revoked", { reason });
  });
  /* ---------- painel ADM: servidores, contas e aviso geral ---------- */
  const srvAdmView = x => ({ ...serverMeta(x), owner: (db.users[x.ownerId] || {}).username || "?", members: x.members.length, online: onlineCount(x), channels: x.channels.length,
    blocked: x.blocked ? { at: x.blocked.at, reason: x.blocked.reason || "", by: (db.users[x.blocked.by] || {}).username || "?" } : null });
  const admServer = id => { const x = typeof id === "string" ? db.servers[id] : null; if (!x) fail("Servidor não encontrado."); return x; };
  on("admin:servers", ({ q, filter }) => {
    requireAdmin();
    const k = str(q, 60).toLowerCase();
    const all = Object.values(db.servers);
    const list = all.filter(x => (filter === "blocked" ? !!x.blocked : !x.blocked) && (!k || x.name.toLowerCase().includes(k) || ((db.users[x.ownerId] || {}).username || "").toLowerCase().includes(k)));
    return { servers: list.sort((a, b) => b.members.length - a.members.length || b.created - a.created).slice(0, 200).map(srvAdmView), total: all.length, blocked: all.filter(x => x.blocked).length };
  });
  on("admin:server:block", ({ serverId, reason }) => {
    requireAdmin();
    const x = admServer(serverId);
    if (x.blocked) fail("Esse servidor já está bloqueado.");
    reason = str(reason, 300);
    for (const [k, v] of voice) if (v.sid === x.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
    x.blocked = { at: Date.now(), by: uid, reason };
    io.to("s:" + x.id).emit("server:remove", { serverId: x.id, reason: `O servidor "${x.name}" foi bloqueado pela equipe da Auryx.${reason ? " Motivo: " + reason : ""}` });
    io.in("s:" + x.id).socketsLeave("s:" + x.id);
    audit("server:block", x.ownerId, { server: x.name, reason });
    save();
    return { server: srvAdmView(x) };
  });
  on("admin:server:unblock", ({ serverId }) => {
    requireAdmin();
    const x = admServer(serverId);
    if (!x.blocked) fail("Esse servidor não está bloqueado.");
    delete x.blocked;
    for (const id of x.members) {
      io.in("u:" + id).socketsJoin("s:" + x.id);
      io.to("u:" + id).emit("server:add", { server: serverView(x), users: x.members.map(m => db.users[m]).filter(Boolean).map(pubUser), voice: voiceOf(x.id) });
    }
    audit("server:unblock", x.ownerId, { server: x.name });
    save();
    return { server: srvAdmView(x) };
  });
  on("admin:server:delete", ({ serverId, confirm }) => {
    requireAdmin();
    const x = admServer(serverId);
    if (str(confirm, 100) !== x.name) fail("Digite o nome exato do servidor para confirmar.");
    audit("server:delete", x.ownerId, { server: x.name, members: x.members.length });
    deleteServer(x, `O servidor "${x.name}" foi excluído pela equipe da Auryx.`);
  });
  on("admin:ban", ({ userId, reason }) => {
    const adm = requireAdmin();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    if (isOwnerUser(u)) fail("O ADM Supremo não pode ser suspenso.");
    if (isAdmin(u)) fail(isOwnerUser(adm) ? "Tire o cargo de ADM dessa pessoa antes de suspender." : "Não dá para suspender um ADM.");
    if (u.id === adm.id) fail("Você não pode suspender a si mesmo.");
    reason = str(reason, 300);
    u.banned = { at: Date.now(), by: uid, reason };
    io.to("u:" + u.id).emit("banned", { reason });
    setTimeout(() => io.in("u:" + u.id).disconnectSockets(true), 300);
    audit("user:ban", u.id, { reason });
    save();
  });
  on("admin:setpass", async ({ userId, password }) => {
    const adm = requireAdmin();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    if (isOwnerUser(u) && u.id !== adm.id) fail("Ninguém troca a senha do ADM Supremo.");
    if (isAdmin(u) && u.id !== adm.id && !isOwnerUser(adm)) fail("Não dá para trocar a senha de outro ADM.");
    password = typeof password === "string" ? password : "";
    if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) fail("A nova senha precisa ter 8+ caracteres, com letras e números.");
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = (await scrypt(password, u.salt)).toString("hex");
    failKey.delete(u.id);
    if (u.id !== adm.id) {
      for (const [k, v] of Object.entries(db.sessions)) if (v.userId === u.id) delete db.sessions[k];   // sai de todos os aparelhos
      io.in("u:" + u.id).disconnectSockets(true);
    }
    audit("user:setpass", u.id, {});
    save();
  });
  on("admin:unban", ({ userId }) => {
    requireAdmin();
    const u = db.users[userId];
    if (!u || !u.banned) fail("Essa conta não está suspensa.");
    delete u.banned;
    audit("user:unban", u.id, {});
    save();
  });
  /* --- painel ADM: números da plataforma e ficha do usuário --- */
  on("admin:stats", async () => {
    requireAdmin();
    const now = Date.now(), day = 86400e3, users = Object.values(db.users), servers = Object.values(db.servers);
    const subs = { plus: 0, pro: 0, max: 0 };
    for (const u of users) { const t = planOf(u); if (t) subs[t]++; }
    const orders = Object.values(db.orders);
    const paid = orders.filter(o => o.status === "approved");
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    let msgs = 0, msgsDay = 0;
    for (const list of Object.values(db.messages)) { msgs += list.length; for (let i = list.length - 1; i >= 0 && list[i].ts > now - day; i--) msgsDay++; }
    const bl = await backupList().catch(() => []);
    return {
      users: users.length, online: online.size, newDay: users.filter(u => u.created > now - day).length, newWeek: users.filter(u => u.created > now - 7 * day).length,
      verified: users.filter(u => u.emailVerified).length, banned: users.filter(u => u.banned).length,
      servers: servers.length, publicServers: servers.filter(s => s.public && !s.blocked).length, blocked: servers.filter(s => s.blocked).length,
      voiceNow: voice.size, rooms: new Set([...voice.values()].map(v => v.cid)).size,
      msgs, msgsDay, subs, pending: orders.filter(o => o.status === "pending" || o.status === "review").length,
      revenueMonth: paid.filter(o => (o.decided || o.updated) >= monthStart.getTime()).reduce((a, o) => a + o.amount, 0), revenueTotal: paid.reduce((a, o) => a + o.amount, 0), paidCount: paid.length,
      ai: AI.configured(), aiName: AI.provider(), aiStatus: AI.status(), mail: MAIL_ON, turn: !!process.env.TURN_URLS, db: pg ? "PostgreSQL" : "arquivo", lastBackup: bl[0] ? bl[0].at : 0,
      uptime: Math.round(process.uptime()), mem: Math.round(process.memoryUsage().rss / 1048576),
      // tempo real
      sockets: io.engine.clientsCount, msgsMin: msgClock.filter(t => t > now - 60e3).length, msgsHour: msgClock.filter(t => t > now - 3600e3).length,
      series: db.metrics.slice(-288), supreme: isOwnerUser(me()), admins: [...ADMIN_SET].length,
      settings: { maintenance: !!db.settings.maintenance, regOpen: db.settings.regOpen !== false, minApp: db.settings.minApp, announce: db.settings.announce ? db.settings.announce.title : "" },
      apps: [...io.sockets.sockets.values()].reduce((a, k) => { const t = appInfo(k.handshake.headers["user-agent"]).kind; a[t] = (a[t] || 0) + 1; return a; }, {})
    };
  });
  on("admin:user", ({ userId }) => {
    requireAdmin();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    const servers = Object.values(db.servers).filter(s => s.members.includes(u.id));
    const sessions = Object.entries(db.sessions).filter(([, v]) => v.userId === u.id);
    return {
      user: { ...pubUser(u), email: u.email || "", emailVerified: !!u.emailVerified, admin: isAdmin(u), banned: u.banned || null, created: u.created,
        plan: planOf(u), planUntil: u.plan ? u.plan.until : 0, planSince: u.plan ? u.plan.since || 0 : 0 },
      online: online.has(u.id),
      servers: servers.map(s => ({ id: s.id, name: s.name, owner: s.ownerId === u.id, members: s.members.length, blocked: !!s.blocked })),
      sessions: sessions.map(([, v]) => ({ dev: v.dev || "Aparelho", created: v.created, last: v.last || v.created })),
      orders: Object.values(db.orders).filter(o => o.uid === u.id).sort((a, b) => b.created - a.created).slice(0, 20).map(o => ({ id: o.id, plan: PLANS[o.tier].name, amount: o.amount, status: o.status, created: o.created })),
      planLog: (u.planLog || []).slice(-20).reverse().map(x => ({ ...x, name: (PLANS[x.tier] || {}).name || x.tier })),
      friends: Object.values(friendsOf(u)).filter(x => x === "friend").length,
      ai: db.ai && db.ai[u.id] ? db.ai[u.id].msgs.length : 0
    };
  });
  on("admin:user:logout", ({ userId }) => {
    requireAdmin();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    const n = endSessions(u.id, null);
    audit("user:logout", u.id, { n });
    save();
    return { ended: n };
  });
  on("admin:user:verify", ({ userId }) => {
    requireAdmin();
    const u = db.users[userId];
    if (!u || !u.email) fail("Essa conta não tem e-mail.");
    u.emailVerified = true; delete u.vc;
    audit("user:verify", u.id, {});
    save();
    io.to("u:" + u.id).emit("me:update", { me: meView(u) });
    return { ok: true };
  });
  on("admin:backups", async () => {
    requireSupreme();
    const list = await backupList();
    return { list, running: backupState.running, mail: backupState.lastMail, every: BACKUP_EVERY, keep: BACKUP_KEEP };
  });
  on("admin:backup:now", async () => {
    requireSupreme();
    const b = await backupNow("manual");
    audit("backup:now", "", { size: b.size });
    save();
    return { backup: b };
  });
  on("admin:broadcast", ({ text, title, keep, push }) => {
    requireAdmin();
    text = str(text, 1500);
    title = str(title, 80);
    if (text.length < 3) fail("Escreva o aviso.");
    // fixar (aparece também para quem entrar depois) e mandar notificação para todos: só o ADM Supremo
    if ((keep || push) && !isOwnerUser(me())) fail("Só o ADM Supremo pode fixar o aviso ou mandar notificação para todos.");
    const a = { id: newId(), title: title || "Aviso da equipe Auryx", text, by: me().username, at: Date.now() };
    if (keep) { db.settings.announce = a; save(); }
    io.emit("announce", a);
    let sent = 0;
    if (push) sent = pushAll({ title: a.title, body: text.slice(0, 180), url: "/", tag: "announce:" + a.id });
    audit("broadcast", uid, { reason: (title ? title + ": " : "") + text.slice(0, 200), push: sent });
    save();
    return { ok: true, push: sent };
  });

  /* --- ADM Supremo: equipe, sistema e desconexão geral --- */
  const admList = () => [...ADMIN_SET].map(n => db.users[byName.get(n)]).filter(Boolean)
    .map(u => ({ id: u.id, username: u.username, color: u.color, avatar: pubUser(u).avatar, supreme: isOwnerUser(u), env: ENV_ADMINS.includes(u.username.toLowerCase()), online: online.has(u.id) }));
  on("admin:admins", () => { requireAdmin(); return { admins: admList() }; });
  on("admin:admin:set", ({ userId, on: give }) => {
    requireSupreme();
    const u = db.users[userId];
    if (!u) fail("Usuário não encontrado.");
    if (isOwnerUser(u)) fail("O ADM Supremo é sempre ADM.");
    if (!give && ENV_ADMINS.includes(u.username.toLowerCase())) fail("Esse ADM vem da configuração do servidor (ADMIN_USERS no Render). Tire de lá.");
    if (give && u.banned) fail("Reative a conta antes.");
    db.admins = db.admins.filter(x => x !== u.id);
    if (give) db.admins.push(u.id);
    refreshAdmins();
    if (give) io.in("u:" + u.id).socketsJoin("admins"); else io.in("u:" + u.id).socketsLeave("admins");
    io.to("u:" + u.id).emit("me:update", { me: meView(u) });
    emitToPeers(u.id, "user:update", { user: pubUser(u) });
    audit(give ? "admin:add" : "admin:remove", u.id, {});
    save();
    return { admins: admList() };
  });
  const settingsView = () => ({ ...db.settings, links: { ...db.settings.links }, defaults: Object.fromEntries(Object.values(PLANS).flatMap(p => [[p.tier + "_m", p.link], [p.tier + "_q", ""]])), downloads: DOWNLOADS });
  on("admin:settings", () => { requireSupreme(); return { settings: settingsView() }; });
  on("admin:settings:save", ({ maintenance, regOpen, pixKey, links, minApp }) => {
    requireSupreme();
    const st = db.settings, changed = [];
    if (maintenance !== undefined) { st.maintenance = str(maintenance, 300); changed.push("manutenção " + (st.maintenance ? "ligada" : "desligada")); }
    if (regOpen !== undefined) { st.regOpen = !!regOpen; changed.push("cadastros " + (st.regOpen ? "abertos" : "fechados")); }
    if (pixKey !== undefined) { st.pixKey = str(pixKey, 140); changed.push("chave Pix"); }
    if (links && typeof links === "object") {
      for (const p of Object.values(PLANS)) for (const c of Object.keys(CYCLES)) {
        const k = p.tier + "_" + c;
        if (links[k] === undefined) continue;
        const v = str(links[k], 400);
        if (v && !/^https:\/\/\S+$/.test(v)) fail("Os links de pagamento precisam começar com https://");
        if (v) st.links[k] = v; else delete st.links[k];
      }
      changed.push("links de pagamento");
    }
    if (minApp !== undefined) {
      const ok = v => !v || /^\d{1,3}(\.\d{1,4}){0,2}$/.test(v);
      if (!minApp) st.minApp = null;
      else {
        const android = str(minApp.android, 20), desktop = str(minApp.desktop, 20);
        if (!ok(android) || !ok(desktop)) fail("Versão inválida (ex.: 3.0.0).");
        const grace = Math.max(0, Math.min(72 * 60, Math.round(+minApp.graceMin || 0)));
        st.minApp = android || desktop ? { android, desktop, since: Date.now() + grace * 60e3 } : null;
      }
      changed.push("versão mínima do app");
    }
    save();
    if (st.maintenance) for (const k of io.sockets.sockets.values()) { const u = db.users[k.data.uid]; if (u && !isAdmin(u)) { k.emit("maintenance", { text: st.maintenance }); setTimeout(() => k.disconnect(true), 400); } }
    audit("settings", "", { reason: changed.join(", ") });
    return { settings: settingsView() };
  });
  on("admin:announce:clear", () => {
    requireSupreme();
    db.settings.announce = null;
    save();
    io.emit("announce:clear", {});
    audit("announce:clear", "", {});
  });
  // desconecta TODO MUNDO de todos os aparelhos (quem pediu continua conectado neste aparelho)
  on("admin:logout:all", ({ confirm }) => {
    requireSupreme();
    if (str(confirm, 40).toUpperCase() !== "DESCONECTAR TODOS") fail("Digite DESCONECTAR TODOS para confirmar.");
    const n = logoutEveryone(socket.data.tk);
    audit("logout:all", "", { n });
    save();
    return { ended: n };
  });

  on("admin:audit", ({ q, action }) => {
    requireAdmin();
    const name = id => (db.users[id] || {}).username || ((db.games || []).find(g => g.id === id) || {}).name || "?";
    const k = str(q, 60).toLowerCase(), act = str(action, 40);
    const all = db.audit.map(e => ({ ...e, adminName: name(e.admin), targetName: name(e.target) }));
    const list = all.filter(e => (!act || e.action.split(":")[0] === act) && (!k || [e.adminName, e.targetName, JSON.stringify(e.details || {})].join(" ").toLowerCase().includes(k)));
    return { entries: list.slice(-400).reverse(), total: all.length };
  });

  /* ---------- catálogo de jogos ---------- */
  const gameView = g => ({ id: g.id, name: g.name, url: g.url, category: g.category || "", status: g.status, embed: g.embed !== false, img: g.img || "", desc: g.desc || "", order: g.order || 0 });
  on("games:list", () => ({ games: (db.games || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)).map(gameView) }));
  on("games:save", ({ game }) => {
    requireAdmin();
    if (!game || typeof game !== "object") fail("Dados inválidos.");
    const name = str(game.name, 60), url = str(game.url, 400), category = str(game.category, 30), desc = str(game.desc, 300);
    if (name.length < 2) fail("Dê um nome ao jogo.");
    let u;
    try { u = new URL(url); } catch { fail("Endereço inválido. Use um link https://"); }
    if (u.protocol !== "https:") fail("O endereço precisa começar com https://");
    const img = typeof game.img === "string" && (game.img === "" || /^https:\/\/\S+$/.test(game.img) || FILE_URL_RE.test(game.img)) ? game.img.slice(0, 400) : "";
    const status = ["on", "off", "soon"].includes(game.status) ? game.status : "on";
    db.games = db.games || [];
    let g = typeof game.id === "string" ? db.games.find(x => x.id === game.id) : null;
    if (!g) { if (db.games.length >= 200) fail("Limite de jogos atingido."); g = { id: newId(), created: Date.now(), order: db.games.length + 1 }; db.games.push(g); }
    Object.assign(g, { name, url: u.href, category, desc, img, status, embed: game.embed !== false });
    if (Number.isFinite(+game.order)) g.order = Math.max(0, Math.min(999, Math.round(+game.order)));
    audit("game:save", g.id, { game: g.name, status });
    save();
    io.emit("games:changed", {});
    return { game: gameView(g) };
  });
  on("games:delete", ({ id }) => {
    requireAdmin();
    const g = (db.games || []).find(x => x.id === id);
    if (!g) fail("Jogo não encontrado.");
    db.games = db.games.filter(x => x !== g);
    audit("game:delete", g.id, { game: g.name });
    save();
    io.emit("games:changed", {});
  });

  /* ---------- e-mail da conta ---------- */
  on("account:email", async ({ email, password }) => {
    const u = me();
    email = str(email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) fail("Digite um e-mail válido.");
    const other = byEmail.get(email);
    if (other && other !== uid) fail("Esse e-mail já está em uso em outra conta.");
    const hash = await scrypt(typeof password === "string" ? password : "", u.salt);
    if (!crypto.timingSafeEqual(hash, Buffer.from(u.hash, "hex"))) fail("Senha incorreta.");
    if (!MAIL_ON) fail("O envio de e-mails ainda não foi configurado no servidor.");
    if (u.vc && Date.now() - u.vc.sent < 45e3) fail("Espere alguns segundos para pedir outro código.");
    try { await sendCode(u, "vc", email); } catch (e) { fail(e.message); }
    return { email: maskEmail(email) };
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
    else { setFriend(uid, other.id, "out"); setFriend(other.id, uid, "in"); pushTo(other.id, { title: "Novo pedido de amizade", body: `${me().username} quer ser seu amigo na Auryx Nexos`, url: "/?abrir=amigos", tag: "friend:" + uid }); }
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

  /* ---------- grupos de mensagem direta ---------- */
  const groupSys = (d, userId, kind, extra) => {
    const list = db.messages[d.id] || (db.messages[d.id] = []);
    const m = { id: msgId(), a: userId, t: extra || "", ts: Date.now(), sys: kind };
    list.push(m);
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    io.to(d.members.map(x => "u:" + x)).emit("msg", { channelId: d.id, serverId: null, m });
  };
  const sendGroup = d => {
    for (const id of d.members) {
      io.to("u:" + id).emit("dm:add", { dm: dmView(d, id), users: d.members.map(x => db.users[x]).filter(Boolean).map(pubUser) });
    }
  };
  const getGroup = id => {
    const d = typeof id === "string" && db.dms[id];
    if (!d || !d.group || !d.members.includes(uid)) fail("Grupo não encontrado.");
    return d;
  };
  on("group:create", ({ userIds, name }) => {
    const mine = friendsOf(me());
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [])].filter(id => id !== uid && mine[id] === "friend" && db.users[id]);
    if (!ids.length) fail("Escolha pelo menos um amigo.");
    if (ids.length > 9) fail("Um grupo pode ter até 10 pessoas.");
    const d = { id: "g." + newId(), members: [uid, ...ids], created: Date.now(), group: true, owner: uid, name: str(name, 40) };
    db.dms[d.id] = d;
    groupSys(d, uid, "gcreate");
    save();
    sendGroup(d);
    return { id: d.id };
  });
  on("group:add", ({ id, userIds }) => {
    const d = getGroup(id);
    const mine = friendsOf(me());
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [])].filter(x => !d.members.includes(x) && mine[x] === "friend" && db.users[x]);
    if (!ids.length) fail("Escolha amigos que ainda não estão no grupo.");
    if (d.members.length + ids.length > 10) fail("Um grupo pode ter até 10 pessoas.");
    d.members.push(...ids);
    for (const x of ids) groupSys(d, x, "gjoin");
    save();
    sendGroup(d);
  });
  on("group:leave", ({ id }) => {
    const d = getGroup(id);
    for (const [k, v] of voice) if (v.uid === uid && v.cid === d.id) { leaveVoice(k); io.to(k).emit("voice:kicked", {}); }
    d.members = d.members.filter(x => x !== uid);
    io.to("u:" + uid).emit("dm:remove", { id: d.id });
    if (!d.members.length) { delete db.dms[d.id]; delete db.messages[d.id]; save(); return; }
    if (d.owner === uid) d.owner = d.members[0];
    groupSys(d, uid, "gleave");
    save();
    sendGroup(d);
  });
  on("group:update", ({ id, name, icon }) => {
    const d = getGroup(id);
    if (name !== undefined) { d.name = str(name, 40); groupSys(d, uid, "gname", d.name); }
    if (icon !== undefined) d.icon = cleanPic(icon);
    save();
    sendGroup(d);
  });

  on("dm:open", ({ userId }) => {
    const other = typeof userId === "string" ? db.users[userId] : null;
    if (!canDm(other)) fail("Adicione essa pessoa como amiga para conversar no privado.");
    db.dms = db.dms || {};
    const id = dmIdOf(uid, other.id);
    if (!db.dms[id]) { db.dms[id] = { id, members: [uid, other.id], created: Date.now() }; save(); }
    return { dm: dmView(db.dms[id], uid), user: pubUser(other) };
  });

  /* --- segurança da conta: aparelhos conectados e troca de senha --- */
  on("account:sessions", () => {
    const list = Object.entries(db.sessions).filter(([, v]) => v.userId === uid)
      .map(([k, v]) => ({ id: sessId(k), dev: v.dev || "Aparelho", created: v.created, last: v.last || v.created, current: k === socket.data.tk, online: [...io.sockets.sockets.values()].some(sk => sk.data.tk === k) }))
      .sort((a, b) => b.current - a.current || b.last - a.last);
    return { list };
  });
  on("account:session:end", ({ id, others }) => {
    const n = others ? endSessions(uid, socket.data.tk) : (typeof id === "string" && id !== sessId(socket.data.tk) ? endSessions(uid, socket.data.tk, id) : 0);
    return { ended: n };
  });
  on("account:password", async ({ current, next }) => {
    const u = me();
    if (!passLimit()) fail("Muitas tentativas. Espere um minuto.");
    const ok = crypto.timingSafeEqual(await scrypt(typeof current === "string" ? current : "", u.salt), Buffer.from(u.hash, "hex"));
    if (!ok) fail("A senha atual está errada.");
    next = typeof next === "string" ? next : "";
    if (next.length < 8 || next.length > 128 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) fail("A nova senha precisa ter 8+ caracteres, com letras e números.");
    if (next === current) fail("A nova senha é igual à atual.");
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = (await scrypt(next, u.salt)).toString("hex");
    const ended = endSessions(uid, socket.data.tk);        // sai dos outros aparelhos
    save();
    return { ok: true, ended };
  });
  on("logout", () => {
    delete db.sessions[socket.data.tk];
    save();
    setTimeout(() => socket.disconnect(true), 50);
  });

  /* ---------- Voz / vídeo / tela (sinalização WebRTC) ---------- */
  on("voice:join", ({ channelId, muted, deaf }) => {
    const dm = typeof channelId === "string" && db.dms && db.dms[channelId];
    if (dm && !dm.members.includes(uid)) fail("Conversa não encontrada.");
    const { s, c } = dm ? { s: { id: dm.id }, c: { id: dm.id } } : getChannel(channelId, "voice");
    for (const [k, v] of voice) {
      if (v.uid === uid && k !== socket.id) { leaveVoice(k); io.to(k).emit("voice:kicked", { reason: "Você entrou em uma sala por outro dispositivo." }); }
    }
    leaveVoice(socket.id);
    const peers = [...voice].filter(([, v]) => v.cid === c.id);
    if (peers.length >= VOICE_LIMIT) fail(`A sala está cheia (máximo de ${VOICE_LIMIT}).`);
    const st = { uid, sid: s.id, cid: c.id, muted: !!muted, deaf: !!deaf, screen: null, cam: null, at: Date.now() };
    voice.set(socket.id, st);
    socket.join("v:" + c.id);
    vTo(s.id).emit("voice:state", vView(socket.id, st));
    if (dm && !peers.length) {   // call privada começando: chama as outras pessoas (mesmo com o app fechado)
      const u = me();
      for (const m of dm.members) if (m !== uid) {
        io.to("u:" + m).emit("call:ring", { channelId: dm.id, from: uid });
        pushTo(m, { title: `📞 ${u.username} está te ligando`, body: dm.group ? `Call no grupo ${dm.name || ""}`.trim() : "Toque para atender", url: "/?atender=" + dm.id, tag: "call:" + dm.id });
      }
    }
    return { peers: peers.map(([k, v]) => vView(k, v)), iceServers: ICE_SERVERS, act: actView(c.id, acts.get(c.id)), now: Date.now() };
  });

  /* ---------- atividades, sons e reações na call ---------- */
  const myVoice = () => { const v = voice.get(socket.id); if (!v) fail("Entre numa sala de voz primeiro."); return v; };
  const fxLimit = mk(12, 5000);
  const musicLimit = mk(10, 30000);
  on("music:search", async ({ q }) => {
    q = str(q, 200);
    if (!q) fail("Digite o nome da música.");
    if (!musicLimit()) fail("Calma! Espere uns segundos para buscar de novo.");
    let from = "";
    if (/open\.spotify\.com\//.test(q)) {
      from = await spotifyTitle(q);
      if (!from) fail("Não consegui ler esse link do Spotify. Tente digitar o nome da música.");
      q = from;
    }
    if (!YT_KEY) fail("A busca por nome ainda não foi ligada pela equipe (falta a chave do YouTube). Por enquanto, cole o link do vídeo do YouTube.");
    try { return { results: await ytSearch(q), from }; }
    catch (e) { fail(e.message || "A busca falhou."); }
  });
  on("music:titles", async ({ ids }) => {
    const list = Array.isArray(ids) ? ids.filter(x => typeof x === "string" && /^[A-Za-z0-9_-]{11}$/.test(x)).slice(0, 25) : [];
    const out = {};
    await Promise.all(list.map(async id => { out[id] = await ytTitle(id).catch(() => ""); }));
    return { titles: out };
  });
  on("act:start", ({ type }) => {
    const v = myVoice();
    if (!ACT_TYPES.includes(type)) fail("Atividade inválida.");
    const state = type === "yt" ? { vid: "", title: "", playing: false, pos: 0, at: Date.now(), queue: [] }
      : type === "sp" ? { uri: "", playing: false, pos: 0, at: Date.now(), queue: [] }
      : type === "ttt" ? { b: Array(9).fill(""), x: "", o: "", turn: "X", win: "", score: { X: 0, O: 0 } } : {};
    const a = { type, state, by: uid, strokes: [] };
    acts.set(v.cid, a);
    io.to("v:" + v.cid).emit("act", actView(v.cid, a));
    vTo(v.sid).emit("act:sum", { channelId: v.cid, type });
  });
  on("act:stop", () => {
    const v = myVoice();
    acts.delete(v.cid);
    io.to("v:" + v.cid).emit("act", actView(v.cid, null));
    vTo(v.sid).emit("act:sum", { channelId: v.cid, type: null });
  });
  on("act:state", ({ state }) => {
    const v = myVoice(), a = acts.get(v.cid);
    if (!a || !state || typeof state !== "object") fail("Nenhuma atividade aberta.");
    if (JSON.stringify(state).length > 20000) fail("Estado grande demais.");
    if (a.type === "yt" || a.type === "sp") state.at = Date.now();   // relógio do servidor para sincronizar
    a.state = state;
    io.to("v:" + v.cid).emit("act", actView(v.cid, a));
  });
  socket.on("act:ev", ev => {
    const v = voice.get(socket.id), a = v && acts.get(v.cid);
    if (!a || a.type !== "board" || !ev || !signals()) return;
    if (ev.k === "clear") { a.strokes = []; }
    else if (ev.k === "seg" && Array.isArray(ev.p) && ev.p.length <= 400) {
      ev = { k: "seg", id: str(ev.id, 24), c: isColor(ev.c) ? ev.c : "#ffffff", w: Math.max(1, Math.min(60, +ev.w || 4)), e: !!ev.e, p: ev.p.map(Number).filter(Number.isFinite).slice(0, 400) };
      a.strokes.push(ev);
      if (a.strokes.length > 4000) a.strokes.splice(0, a.strokes.length - 4000);
    } else return;
    socket.to("v:" + v.cid).emit("act:ev", ev);
  });
  socket.on("call:fx", fx => {
    const v = voice.get(socket.id);
    if (!v || !fx || !fxLimit()) return;
    const kind = fx.k === "sound" ? "sound" : fx.k === "emoji" ? "emoji" : null;
    const val = str(fx.v, 16);
    if (!kind || !val) return;
    socket.to("v:" + v.cid).emit("call:fx", { k: kind, v: val, userId: uid });
  });

  on("voice:update", ({ muted, deaf, screen, cam }) => {
    const st = voice.get(socket.id);
    if (!st) return { ok: false };
    if (muted !== undefined) st.muted = !!muted;
    if (deaf !== undefined) st.deaf = !!deaf;
    if (screen !== undefined) st.screen = screen ? str(screen, 64) : null;
    if (cam !== undefined) st.cam = cam ? str(cam, 64) : null;
    vTo(st.sid).emit("voice:state", vView(socket.id, st));
  });

  on("voice:leave", () => { leaveVoice(socket.id); });
  on("call:decline", ({ channelId }) => {
    const d = typeof channelId === "string" && db.dms && db.dms[channelId];
    if (!d || !d.members.includes(uid)) return;
    io.to("u:" + uid).emit("call:end", { channelId: d.id, mine: true });   // some o toque nos outros aparelhos da pessoa
    for (const [k, v] of voice) if (v.cid === d.id) io.to(k).emit("call:declined", { channelId: d.id, userId: uid });
  });

  // voltou depois de cair: assume o lugar guardado sem refazer a chamada
  on("voice:resume", ({ oldSock, channelId }) => {
    const v = typeof oldSock === "string" ? voice.get(oldSock) : null;
    if (!v || v.uid !== uid || v.cid !== channelId || oldSock === socket.id) fail("Lugar na sala expirou.");
    clearTimeout(v.awayTimer);
    v.away = 0;
    voice.delete(oldSock);
    voice.set(socket.id, v);
    sockAlias.set(oldSock, socket.id);
    socket.join("v:" + v.cid);
    vTo(v.sid).emit("voice:resock", { old: oldSock, sock: socket.id, userId: uid, channelId: v.cid });
    vTo(v.sid).emit("voice:state", vView(socket.id, v));
    const peers = [...voice].filter(([k, x]) => x.cid === v.cid && k !== socket.id).map(([k, x]) => vView(k, x));
    return { peers, act: actView(v.cid, acts.get(v.cid)), now: Date.now() };
  });

  socket.on("voice:signal", msg => {
    if (!msg || typeof msg.to !== "string" || !msg.data || typeof msg.data !== "object" || !signals()) return;
    const to = sockAlias.get(msg.to) || msg.to;
    const a = voice.get(socket.id), b = voice.get(to);
    if (!a || !b || a.cid !== b.cid) return;
    io.to(to).emit("voice:signal", { from: socket.id, userId: uid, data: msg.data });
  });

  /* ---------- push e visibilidade ---------- */
  const setVisible = vis => {
    let s = visibleSockets.get(uid);
    if (vis) { if (!s) visibleSockets.set(uid, (s = new Set())); s.add(socket.id); }
    else if (s) { s.delete(socket.id); if (!s.size) visibleSockets.delete(uid); }
  };
  setVisible(true);
  socket.on("vis", d => setVisible(!(d && d.hidden)));
  on("push:key", () => ({ key: db.vapid ? db.vapid.publicKey : "" }));
  on("push:sub", ({ sub }) => {
    if (!webpush) fail("Notificações push não estão disponíveis no servidor.");
    if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 || !sub.keys || typeof sub.keys.p256dh !== "string" || typeof sub.keys.auth !== "string") fail("Inscrição inválida.");
    const u = me();
    u.push = (u.push || []).filter(x => x.endpoint !== sub.endpoint);
    u.push.push({ endpoint: sub.endpoint, keys: { p256dh: str(sub.keys.p256dh, 200), auth: str(sub.keys.auth, 100) } });
    if (u.push.length > 6) u.push.splice(0, u.push.length - 6);
    save();
  });
  on("push:unsub", ({ endpoint }) => { const u = me(); u.push = (u.push || []).filter(x => x.endpoint !== endpoint); save(); });

  socket.on("disconnect", reason => {
    setVisible(false);
    // saída de propósito: sai na hora; queda de conexão: segura o lugar por 60 s
    if (reason === "client namespace disconnect" || reason === "server namespace disconnect") leaveVoice(socket.id);
    else holdVoice(socket.id);
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
/* ------------------------------------------------------------------ */
/* Migração da atualização "Auryx Nexos" — roda UMA vez no primeiro boot */
/* depois do deploy: desconecta todo mundo, exige o app novo (Android/PC) */
/* depois de 30 min, fixa o aviso do novo nome e manda notificação.      */
/* ------------------------------------------------------------------ */
const NEXOS_MIGRATION = "2026-11-auryx-nexos";
const NEXOS_ANNOUNCE = {
  title: "✨ Bem-vindo à Auryx Nexos!",
  text: `A Auryx Nexavória agora se chama Auryx Nexos — mesmo app, mesmos amigos e servidores, com nome e visual novos.

🔐 Por segurança, todo mundo foi desconectado nesta atualização: é só entrar de novo com seu usuário (ou e-mail) e senha.

🚀 Novidades:
• Planos trimestrais com desconto (VIP, Pro e Max)
• Mensagens maiores e mais seguidas — ainda mais para assinantes
• Aurys: no Pro e no Max você escolhe a cor do app inteiro
• Banner animado em GIF, molduras e partículas no perfil
• Assinantes em destaque na lista de membros e no chat
• Servidores com banner, cor temática, cargos com ícone e categorias de canais
• Menu do Android corrigido (o botão voltar fecha menus e janelas) e visual novo no PC

📲 Usa o app de Android ou de PC? Baixe a versão nova pelo aviso que aparece no app — a antiga para de funcionar em breve.`
};
function runMigrations() {
  if (db.migrations.includes(NEXOS_MIGRATION)) return;
  const now = Date.now();
  const ended = logoutEveryone(null);
  db.settings.minApp = { android: "3.0.0", desktop: "3.0.0", since: now + 30 * 60e3 };
  db.settings.announce = { id: "nexos-1", ...NEXOS_ANNOUNCE, by: "Equipe Auryx", at: now };
  db.migrations.push(NEXOS_MIGRATION);
  db.audit.push({ at: now, admin: "", action: "migration", target: "", details: { reason: `Auryx Nexos: ${ended} sessões encerradas, app novo exigido em 30 min, aviso fixado` } });
  save();
  const sent = pushAll({ title: NEXOS_ANNOUNCE.title, body: "A Auryx Nexavória agora é Auryx Nexos! Entre de novo para ver as novidades.", url: "/", tag: "nexos-1" });
  console.log(`  Migração ${NEXOS_MIGRATION}: ${ended} sessões encerradas, ${sent} notificações enviadas.`);
}

loadDb().then(async () => {
  try { await backupInit(); backupSchedule(); } catch (e) { console.error("Backup indisponível:", e.message); }
  // cópia de segurança antes de mexer em tudo (só na primeira vez)
  if (!db.migrations.includes(NEXOS_MIGRATION)) { try { await backupNow("antes da atualização Nexos"); } catch (e) { console.error("Backup antes da migração:", e.message); } }
  try { runMigrations(); } catch (e) { console.error("Migração falhou:", e); }
  setTimeout(vipSweep, 30e3); setInterval(vipSweep, 3600e3).unref();
  setInterval(sampleMetrics, 300e3).unref();
  server.listen(PORT, HOST, () => {
    console.log(`\n  ${APP_NAME} rodando em http://localhost:${PORT}`);
    const admins = [...ADMIN_SET].map(n => (byName.has(n) ? n : n + " (essa conta não existe ainda)"));
    console.log(`  ADMs: ${admins.length ? admins.join(", ") : "nenhum — configure ADMIN_USERS"}`);
    console.log(`  E-mail: ${MAIL_ON ? "Resend configurado" : "desligado — configure RESEND_API_KEY"}`);
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
