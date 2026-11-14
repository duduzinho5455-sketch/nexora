/* =====================================================================
   NEXORA — cliente
   Sem frameworks: renderização com delegação de eventos e agendamento
   por requestAnimationFrame. Voz/vídeo/tela via WebRTC em malha P2P.
   ===================================================================== */
"use strict";
(() => {

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ESC[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const IS_IMG = s => typeof s === "string" && (s.startsWith("data:image/") || s.startsWith("/f/"));
const store = {
  get(k, d) { try { const v = localStorage.getItem("nx:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("nx:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("nx:" + k); } catch {} }
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const P = {
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
  micOff: '<path d="M2 2l20 20M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8M19 10a7 7 0 0 1-1.2 3.9M5 10a7 7 0 0 0 11.3 5.5M12 17v4M8 21h8"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3zM3 19a2 2 0 0 0 2 2h1v-7H3z"/>',
  headOff: '<path d="M3 18v-6a9 9 0 0 1 15-6.7M21 12v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3zM3 19a2 2 0 0 0 2 2h1v-7H3zM2 2l20 20"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  monitorUp: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M9 10l3-3 3 3M12 7v6"/>',
  camera: '<path d="m23 7-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  cameraOff: '<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.7 0H14a2 2 0 0 1 2 2v3.3l1 1L23 7v10M1 1l22 22"/>',
  phoneOff: '<path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-3.6-2.9M5.2 13.4A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.7M22 2 2 22"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  focus: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  crown: '<path d="m2 7 5 5 5-8 5 8 5-5-2 12H4z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10.5 10.5 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  arrowRight: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  gamepad: '<path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/><rect x="2" y="6" width="20" height="12" rx="6"/>',
  pointer: '<path d="m4 4 7 17 2.5-7.5L21 11z"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  steam: '<circle cx="12" cy="12" r="10"/><circle cx="15.5" cy="9.5" r="2.5"/><path d="m2.5 14 5 2a3 3 0 1 0 1.6-3.9l3.7-2.6"/>',
  clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  brush: '<path d="m9.1 11.3 9.4-9.4a2.1 2.1 0 0 1 3 3l-9.4 9.4M7 14a3 3 0 0 0-3 3c0 1.3-1 2-2 2 1 1.5 3 2.5 5 2.5a4.5 4.5 0 0 0 4.5-4.5 3 3 0 0 0-3-3"/>',
  grid3: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  speaker: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><path d="M12 6h.01"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  skip: '<path d="m5 4 10 8-10 8zM19 5v14"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>'
};
const ic = (n, c = "") => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="nxg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><path d="M14 35V13l20 22V13" fill="none" stroke="url(#nxg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const DESKTOP = window.nexoraDesktop || null;
const DESKTOP_URL = "https://github.com/duduzinho5455-sketch/nexora/releases/latest/download/NEXORA-Setup.exe";
let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; });
window.addEventListener("appinstalled", () => { installPrompt = null; });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const COLORS = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#a78bfa", "#fb923c", "#2dd4bf"];
const STATUS = { online: "Disponível", idle: "Ausente", dnd: "Não perturbe", invisible: "Invisível", offline: "Offline" };
const EMOJIS = "😀 😂 🤣 😊 😍 🥰 😎 🤩 🥳 😅 😭 😤 😡 🤯 😱 🤔 🫡 😴 🙄 😏 🤡 💀 👻 👽 🤖 💩 👍 👎 👏 🙌 🙏 🤝 💪 👀 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 💯 🔥 ✨ ⚡ 🎉 🎮 🏆 🎧 🍕 🍔 ☕ 🍺 🚀 ✅ ❌ ⭐ 🌙".split(" ");
const QUICK = ["👍", "😂", "❤️"];
const SYS = { join: "entrou no servidor. Deem as boas-vindas! 🎉", gcreate: "criou o grupo. 🎉", gjoin: "entrou no grupo. 👋", gleave: "saiu do grupo.", gname: "mudou o nome do grupo." };
const QUALITY = {
  "720": { label: "720p", sub: "30 FPS · leve", w: 1280, h: 720, fps: 30, br: 2500000 },
  "720-60": { label: "720p", sub: "60 FPS · jogo leve", w: 1280, h: 720, fps: 60, br: 4500000, tag: "COOP" },
  "1080": { label: "1080p", sub: "30 FPS · nítido", w: 1920, h: 1080, fps: 30, br: 4500000 },
  "1080-60": { label: "1080p", sub: "60 FPS · fluido", w: 1920, h: 1080, fps: 60, br: 8000000, tag: "GAMES" },
  "src": { label: "Fonte", sub: "até 1440p · 60 FPS", w: 2560, h: 1440, fps: 60, br: 12000000, tag: "MÁX" }
};
const TEMPLATES = {
  friends: { name: "Amigos", icon: "🎉", desc: "Bate-papo, memes e call" },
  gaming: { name: "Jogos", icon: "🎮", desc: "Squads, clipes e LFG" },
  study: { name: "Estudos", icon: "📚", desc: "Foco, dúvidas e materiais" },
  community: { name: "Comunidade", icon: "🌐", desc: "Avisos e conversa geral" }
};

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */
const DEFAULTS = {
  theme: "dark", accent: "#7c5cff", reduceMotion: false, sounds: true, notify: false,
  noise: true, nsMode: "ai", nsGate: true, echo: true, agc: true, inputId: "", outputId: "", sensitivity: 0.06,
  shareQuality: "1080", shareMode: "detail", shareAudio: true
};
const S = {
  token: store.get("token", null), socket: null, me: null, ice: [],
  users: new Map(), servers: new Map(), voice: new Map(),
  serverId: null, channelId: null, view: "home",
  msgs: new Map(), drafts: {}, typing: new Map(),
  lastRead: store.get("lastRead", {}), mentions: new Map(Object.entries(store.get("mentions", {}))),
  replyTo: null, editing: null, mention: null, newMarker: null, stick: true,
  showMembers: store.get("showMembers", true),
  settings: Object.assign({}, DEFAULTS, store.get("settings", {})),
  muted: store.get("muted", false), deaf: store.get("deaf", false),
  volumes: store.get("volumes", {}), localMute: {}, order: store.get("order", []),
  pendingInvite: null, voiceLimit: 12, ready: false,
  friends: new Map(), dms: new Map(), friendsTab: "online", steamAuto: false,
  acts: new Map(), clockOff: 0
};
const V = {
  channelId: null, serverId: null, joining: false,
  mic: null, screen: null, screenCfg: null, cam: null,
  peers: new Map(), ctx: null, sink: null, meters: new Map(), speaking: new Set(),
  loop: null, statsTimer: null, ping: null, watching: new Set(), viewers: new Set(), focus: null,
  granted: new Map(),   // quem pode controlar meu PC: sock -> { uid, mode }
  controlling: null     // PC que eu controlo: { uid, sock, mode, kb }
};

const srv = () => S.servers.get(S.serverId);
function chan(cid = S.channelId) {
  const d = S.dms.get(cid);
  if (d) { d.type = "text"; d.dm = true; if (!d.group) d.name = user(d.userId).username; d.topic = ""; return d; }
  for (const s of S.servers.values()) { const c = s.channels.find(x => x.id === cid); if (c) return c; }
  return null;
}
const isDm = cid => typeof cid === "string" && (cid.startsWith("d.") || cid.startsWith("g."));
const groupTitle = d => d.name || d.members.filter(id => !S.me || id !== S.me.id).map(id => user(id).username).slice(0, 4).join(", ") || "Grupo";
const dmTitle = d => (d.group ? groupTitle(d) : user(d.userId).username);
function groupAvatar(d, size = 32) {
  if (d.icon && IS_IMG(d.icon)) return `<span class="av" style="--c:#5865f2;--s:${size}px"><img src="${esc(d.icon)}" alt=""></span>`;
  const others = d.members.filter(id => !S.me || id !== S.me.id).slice(0, 2).map(user);
  return `<span class="av-stack" style="--s:${size}px">${others.map(u => avatar(u, Math.round(size * 0.68))).join("")}</span>`;
}
function serverOf(cid) { for (const s of S.servers.values()) if (s.channels.some(c => c.id === cid)) return s; return null; }
const user = id => S.users.get(id) || { id, username: "Usuário removido", color: "#4b5068", avatar: "", status: "offline", about: "", created: 0 };
function userByName(n) { n = n.toLowerCase(); for (const u of S.users.values()) if (u.username.toLowerCase() === n) return u; return null; }
const isOwner = s => !!(s && S.me && s.ownerId === S.me.id);
const peerByUser = uid => { for (const p of V.peers.values()) if (p.userId === uid) return p; return null; };
const isUnread = c => !!(c && c.type === "text" && c.last && S.me && c.last.a !== S.me.id && c.last.ts > (S.lastRead[c.id] || 0));
const initials = n => (n || "?").split(/\s+/).filter(Boolean).slice(0, 3).map(w => [...w][0]).join("").toUpperCase() || "?";

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const fmtTime = ts => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtFull = ts => new Date(ts).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
function fmtDay(ts) {
  const now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
  if (sameDay(ts, now)) return "Hoje";
  if (sameDay(ts, y)) return "Ontem";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtStamp(ts) {
  const d = fmtDay(ts);
  return (d === "Hoje" || d === "Ontem" ? d + " às " : new Date(ts).toLocaleDateString("pt-BR") + " ") + fmtTime(ts);
}

function avatar(u, size = 40, status = false, attrs = "") {
  const name = u.username || "?";
  const inner = IS_IMG(u.avatar) ? `<img src="${esc(u.avatar)}" alt="" decoding="async">`
    : u.avatar ? `<span class="av-emoji">${esc(u.avatar)}</span>` : esc(([...name][0] || "?").toUpperCase());
  return `<span class="av" style="--c:${esc(u.color || "#555")};--s:${size}px" ${attrs}>${inner}${status ? `<i class="st st-${esc(u.status || "offline")}"></i>` : ""}</span>`;
}
/* Perfil Turbo: nome com efeito, status personalizado e insígnias */
function nameHTML(u) {
  const t = u.theme || [u.color || "#7c5cff", "#22d3ee"];
  return `<span class="nm${u.fx ? " fx-" + esc(u.fx) : ""}" style="--n1:${esc(t[0])};--n2:${esc(t[1])}">${esc(u.username)}</span>`;
}
const csText = u => (u.cs ? `${u.cs.e ? esc(u.cs.e) + " " : ""}${esc(u.cs.t || "")}` : "");
function badges(u) {
  const b = [];
  if (u.created && u.created < Date.UTC(2027, 0, 1)) b.push(["⭐", "Fundador — chegou no começo do NEXORA"]);
  if ([...S.servers.values()].some(s => s.ownerId === u.id)) b.push(["👑", "Dono de servidor"]);
  if (u.banner || u.theme || u.fx || u.pfx) b.push(["⚡", "Perfil Turbo"]);
  if (u.steam) b.push(["🎮", "Steam conectada"]);
  return b.length ? `<div class="badges">${b.map(([e, t]) => `<span data-tip="${esc(t)}">${e}</span>`).join("")}</div>` : "";
}
function bannerStyle(u) {
  if (u.banner && u.banner.startsWith("/f/")) return `background-image:url('${esc(u.banner)}');background-size:cover;background-position:center`;
  const t = u.theme || [u.banner && u.banner.startsWith("#") ? u.banner : u.color || "#7c5cff", null];
  return `background:linear-gradient(135deg, ${esc(t[0])}, ${esc(t[1] || `color-mix(in srgb, ${t[0]} 30%, #000)`)})`;
}
function uploadBlob(file) {
  return new Promise((resolve, reject) => {
    if (LOCAL) return reject(new Error("Disponível na versão online do NEXORA."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Arquivo muito grande (máximo 8 MB)."));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("authorization", "Bearer " + S.token);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name || "imagem"));
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.onload = () => { let j = {}; try { j = JSON.parse(xhr.responseText); } catch {} if (xhr.status === 200 && j.url) resolve(j); else reject(new Error(j.error || "Falha no envio.")); };
    xhr.onerror = () => reject(new Error("Falha na conexão."));
    xhr.send(file);
  });
}
function serverIcon(s, cls = "") {
  const v = s.icon || "";
  if (IS_IMG(v)) return `<div class="srv-icon ${cls}" style="--c:${esc(s.color)}"><img src="${esc(v)}" alt=""></div>`;
  if (v) return `<div class="srv-icon ${/\p{Extended_Pictographic}/u.test(v) ? "emoji" : ""} ${cls}" style="--c:${esc(s.color)}">${esc(v)}</div>`;
  return `<div class="srv-icon ${cls}" style="--c:${esc(s.color)}">${esc(initials(s.name))}</div>`;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,:;'")\]!?*_~|]/g;
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif)(\?[^\s]*)?$/i;
const JUMBO = /^(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*|[\u{1F1E6}-\u{1F1FF}]{2}|\s)+$/u;

function inlineFormat(raw, images) {
  const keep = [];
  const hold = html => `\u0001${keep.push(html) - 1}\u0001`;
  let s = raw.replace(URL_RE, url => {
    if (IMG_EXT.test(url) && images.length < 3) images.push(url);
    return hold(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(url)}</a>`);
  });
  s = s.replace(/(^|[^\p{L}\p{N}_.-])@([\p{L}\p{N}_.-]{2,24})/gu, (all, pre, name) => {
    const trimmed = name.replace(/[._-]+$/, "");
    const u = userByName(name) || userByName(trimmed);
    if (u) return pre + hold(`<span class="mention" data-act="profile" data-uid="${esc(u.id)}">@${esc(u.username)}</span>`) + name.slice(u.username.length);
    if (/^(everyone|todos|here)$/i.test(trimmed)) return pre + hold(`<span class="mention">@${esc(trimmed)}</span>`) + name.slice(trimmed.length);
    return all;
  });
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>')
    .replace(/(^|[^*\p{L}\p{N}])\*(?=\S)(.+?)(?<=\S)\*(?![*\p{L}\p{N}])/gu, "$1<i>$2</i>")
    .replace(/(^|[^_\p{L}\p{N}])_(?=\S)(.+?)(?<=\S)_(?![_\p{L}\p{N}])/gu, "$1<i>$2</i>")
    .replace(/^&gt; (.*)$/gm, '<span class="quote">$1</span>');
  return s.replace(/\u0001(\d+)\u0001/g, (_, i) => keep[+i]);
}
function renderText(raw) {
  const images = [];
  const jumbo = raw.length <= 40 && JUMBO.test(raw);
  const parts = raw.split(/```(?:[\w+-]*\n)?([\s\S]*?)```/);
  let html = "";
  parts.forEach((p, i) => {
    if (i % 2) { html += `<pre><code>${esc(p.replace(/\n$/, ""))}</code></pre>`; return; }
    html += p.split(/(`[^`\n]+`)/).map((seg, j) => (j % 2 ? `<code>${esc(seg.slice(1, -1))}</code>` : inlineFormat(seg, images))).join("");
  });
  return { html, images, jumbo };
}
function mentionsMe(m) {
  if (!S.me || m.sys || m.a === S.me.id) return false;
  if (m.re && m.re.a === S.me.id) return true;
  if (m.dm) return true;
  const t = m.t.toLowerCase(), n = "@" + S.me.username.toLowerCase();
  if (/(^|\s)@(everyone|todos|here)\b/.test(t)) return true;
  for (let i = t.indexOf(n); i >= 0; i = t.indexOf(n, i + 1)) {
    const before = i ? t[i - 1] : " ", after = t[i + n.length] || " ";
    if (!/[\p{L}\p{N}_.-]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Agendador de renderização                                           */
/* ------------------------------------------------------------------ */
const dirty = new Set();
let rafId = 0;
function schedule(...parts) {
  for (const p of parts) dirty.add(p);
  if (rafId) return;
  // Em segundo plano o navegador pausa requestAnimationFrame; o timer garante título e contadores certos.
  rafId = requestAnimationFrame(flushRender);
  rafTimer = setTimeout(flushRender, 300);
}
let rafTimer = 0;
function flushRender() {
  cancelAnimationFrame(rafId); clearTimeout(rafTimer);
  rafId = 0;
  const list = [...dirty]; dirty.clear();
  for (const p of list) try { RENDER[p] && RENDER[p](); } catch (e) { console.error("render", p, e); }
}
const RENDER = {
  rail: () => renderRail(), side: () => renderSide(), top: () => renderTop(), members: () => renderMembers(),
  user: () => renderUserPanel(), vpanel: () => renderVoicePanel(), stage: () => renderStage(),
  home: () => { if (S.view === "home") renderHome(); if (S.view === "friends") renderFriends(); }, title: () => renderTitle(), typing: () => renderTyping()
};
const renderAll = () => schedule("rail", "side", "top", "members", "user", "vpanel", "stage", "home", "title");

/* ------------------------------------------------------------------ */
/* Render: trilho de servidores                                        */
/* ------------------------------------------------------------------ */
function sortedServers() {
  const idx = id => { const i = S.order.indexOf(id); return i < 0 ? 1e9 : i; };
  return [...S.servers.values()].sort((a, b) => idx(a.id) - idx(b.id) || a.created - b.created);
}
function serverUnread(s) {
  let mentions = 0, unread = false;
  for (const c of s.channels) { mentions += S.mentions.get(c.id) || 0; if (isUnread(c)) unread = true; }
  return { mentions, unread };
}
function renderRail() {
  const inServer = (S.view === "chat" && !isDm(S.channelId)) || S.view === "stage";
  $("#serverList").innerHTML = sortedServers().map(s => {
    const { mentions, unread } = serverUnread(s);
    const flag = mentions ? `<b class="badge">${mentions > 99 ? "99+" : mentions}</b>` : V.serverId === s.id ? `<span class="vc-dot">${ic("volume")}</span>` : "";
    return `<div class="rail-item${inServer && s.id === S.serverId ? " on" : ""}${unread ? " unread" : ""}" data-act="server" data-id="${s.id}" data-tip="${esc(s.name)}" role="button" tabindex="0" draggable="true"><span class="pill"></span>${serverIcon(s)}${flag}</div>`;
  }).join("");
  const home = $(".rail-item.home");
  const inHome = S.view === "home" || S.view === "friends" || (S.view === "chat" && isDm(S.channelId));
  home.classList.toggle("on", inHome);
  let dmPings = 0;
  for (const d of S.dms.values()) dmPings += S.mentions.get(d.id) || 0;
  const pending = [...S.friends.values()].filter(v => v === "in").length;
  const total = dmPings + pending;
  const old = home.querySelector(".badge");
  if (old) old.remove();
  if (total) home.insertAdjacentHTML("beforeend", `<b class="badge">${total > 99 ? "99+" : total}</b>`);
  $('.rail-item[data-act="discover"]').classList.toggle("on", S.view === "discover");
}

/* ------------------------------------------------------------------ */
/* Render: barra lateral                                               */
/* ------------------------------------------------------------------ */
let lastSideKey = "";
function vcUser(v) {
  const u = user(v.userId);
  const flags = (v.screen ? '<b class="live-tag">AO VIVO</b>' : "") + (v.cam ? ic("camera", "xs") : "") + (v.deaf ? ic("headOff", "xs") : v.muted ? ic("micOff", "xs") : "");
  return `<div class="vc-user${V.speaking.has(v.userId) ? " speaking" : ""}" data-voice-user="${v.userId}" data-act="profile" data-uid="${v.userId}">${avatar(u, 24)}<span class="name">${esc(u.username)}</span><span class="flags">${flags}</span></div>`;
}
function renderSide() {
  const head = $("#sideHead"), body = $("#sideBody");
  const s = srv();
  const homeLike = S.view === "home" || S.view === "friends" || (S.view === "chat" && isDm(S.channelId));
  const key = homeLike ? "home" : (S.view === "chat" || S.view === "stage") && s ? s.id : S.view;
  const anim = key !== lastSideKey;
  lastSideKey = key;
  body.classList.toggle("anim", anim);
  if (anim) setTimeout(() => body.classList.remove("anim"), 500);

  if (!(S.view === "chat" || S.view === "stage") || !s) {
    head.className = "side-head";
    delete head.dataset.act;
    if (S.view === "discover") {
      head.innerHTML = `<span class="title">Explorar</span>`;
      body.innerHTML = `<div class="cat">Descobrir</div><div class="ch on">${ic("compass")}<span class="ch-name">Comunidades</span></div><div class="cat">Dica</div><p style="padding:0 8px;color:var(--muted);font-size:13.5px;margin:0">Torne seu servidor público em <b>Configurações do servidor</b> para ele aparecer aqui.</p>`;
      return;
    }
    head.innerHTML = `<button class="side-search" data-act="switcher">${ic("search", "sm")}Encontrar ou começar conversa</button>`;
    const pending = [...S.friends.values()].filter(v => v === "in").length;
    const dms = [...S.dms.values()].sort((a, b) => ((b.last && b.last.ts) || b.created || 0) - ((a.last && a.last.ts) || a.created || 0));
    body.innerHTML = `<div class="ch${S.view === "home" ? " on" : ""}" data-act="home" role="button" tabindex="0">${ic("compass")}<span class="ch-name">Início</span></div>
      <div class="ch${S.view === "friends" ? " on" : ""}" data-act="friends" role="button" tabindex="0">${ic("users")}<span class="ch-name">Amigos</span>${pending ? `<b class="badge">${pending}</b>` : ""}</div>
      <div class="cat"><span>Mensagens diretas</span><button data-act="new-group" data-tip="Novo grupo">${ic("plus", "sm")}</button></div>` +
      (dms.length ? dms.map(d => {
        const n = S.mentions.get(d.id) || 0;
        if (d.group) return `<div class="dm-item${S.view === "chat" && S.channelId === d.id ? " on" : ""}${n ? " unread" : ""}" data-act="open-dm" data-id="${d.id}" data-group="${d.id}" role="button" tabindex="0">${groupAvatar(d)}<div class="who"><b>${esc(groupTitle(d))}</b><small>${d.members.length} membros</small></div>${n ? `<b class="badge">${n}</b>` : ""}</div>`;
        const u = user(d.userId);
        const sub = u.game ? `${ic("gamepad", "xs")} ${esc(u.game.name)}` : csText(u) || esc(u.about || "");
        return `<div class="dm-item${S.view === "chat" && S.channelId === d.id ? " on" : ""}${n ? " unread" : ""}" data-act="open-dm" data-id="${d.id}" data-uid="${u.id}" role="button" tabindex="0">${avatar(u, 32, true)}<div class="who"><b>${esc(u.username)}</b>${sub ? `<small>${sub}</small>` : ""}</div>${n ? `<b class="badge">${n}</b>` : ""}</div>`;
      }).join("") : `<p style="padding:0 8px;color:var(--muted);font-size:13px;margin:0">Nenhuma conversa ainda. Adicione amigos e mande um oi! 👋</p>`);
    return;
  }

  head.className = "side-head clickable";
  head.dataset.act = "server-menu";
  head.innerHTML = `<span class="title">${esc(s.name)}</span>${ic("chevron", "chev")}`;
  const owner = isOwner(s);
  const tools = id => (owner ? `<span class="ch-tools"><i data-act="ch-settings" data-id="${id}" data-tip="Editar canal">${ic("settings", "sm")}</i></span>` : "");
  const text = s.channels.filter(c => c.type === "text"), voiceCh = s.channels.filter(c => c.type === "voice");
  let h = `<div class="cat"><span>Canais de texto</span>${owner ? `<button data-act="new-channel" data-type="text" data-tip="Criar canal">${ic("plus", "sm")}</button>` : ""}</div>`;
  h += text.map(c => {
    const m = S.mentions.get(c.id) || 0;
    return `<div class="ch${S.view === "chat" && c.id === S.channelId ? " on" : ""}${isUnread(c) ? " unread" : ""}" data-act="open-ch" data-id="${c.id}" role="button" tabindex="0">${ic("hash")}<span class="ch-name">${esc(c.name)}</span>${m ? `<b class="badge">${m}</b>` : ""}${tools(c.id)}</div>`;
  }).join("");
  h += `<div class="cat"><span>Salas de voz</span>${owner ? `<button data-act="new-channel" data-type="voice" data-tip="Criar sala de voz">${ic("plus", "sm")}</button>` : ""}</div>`;
  h += voiceCh.map(c => {
    const people = [...S.voice.values()].filter(v => v.channelId === c.id).sort((a, b) => a.at - b.at);
    const live = people.some(p => p.screen);
    const act = S.acts.get(c.id);
    return `<div class="ch${S.view === "stage" && c.id === S.channelId ? " on" : ""}${live ? " live" : ""}" data-act="open-ch" data-id="${c.id}" role="button" tabindex="0">${ic("volume")}<span class="ch-name">${esc(c.name)}</span>${act ? `<span class="act-dot" data-tip="${esc(ACT_NAMES[act] || "Atividade")}">${ic({ yt: "music", board: "brush", ttt: "grid3" }[act] || "rocket", "xs")}</span>` : ""}${people.length ? `<span class="count">${people.length}/${S.voiceLimit}</span>` : ""}${tools(c.id)}</div>${people.length ? `<div class="vc-users">${people.map(vcUser).join("")}</div>` : ""}`;
  }).join("");
  body.innerHTML = h;
}

/* ------------------------------------------------------------------ */
/* Render: topo, membros, painel do usuário                            */
/* ------------------------------------------------------------------ */
function renderTop() {
  const icon = $("#topIcon"), title = $("#topTitle"), topic = $("#topTopic"), actions = $("#topActions");
  const c = chan();
  const search = `<button class="icon-btn" data-act="switcher" data-tip="Ir para… (Ctrl+K)">${ic("search")}</button>`;
  if (S.view === "chat" && c && c.dm && c.group) {
    icon.innerHTML = ic("users");
    title.textContent = groupTitle(c);
    topic.textContent = `${c.members.length} membros`;
    actions.innerHTML = `<button class="icon-btn" data-act="group-add" data-id="${c.id}" data-tip="Adicionar pessoas">${ic("userPlus")}</button><button class="icon-btn${S.showMembers ? " on" : ""}" data-act="toggle-members" data-tip="Membros">${ic("users")}</button><button class="icon-btn" data-act="group-menu" data-id="${c.id}" data-tip="Opções do grupo">${ic("settings")}</button>${search}`;
  } else if (S.view === "chat" && c && c.dm) {
    const u = user(c.userId), f = S.friends.get(u.id);
    icon.innerHTML = ic("at");
    title.textContent = u.username;
    topic.textContent = u.game ? `🎮 Jogando ${u.game.name}` : STATUS[u.status] || "";
    actions.innerHTML = `${f === "friend" ? "" : `<button class="icon-btn" data-act="add-friend" data-uid="${u.id}" data-tip="${f === "out" ? "Pedido enviado" : "Adicionar amigo"}">${ic(f === "out" ? "userCheck" : "userPlus")}</button>`}<button class="icon-btn" data-act="profile" data-uid="${u.id}" data-tip="Perfil">${ic("users")}</button>${search}`;
  } else if (S.view === "chat" && c) {
    icon.innerHTML = ic("hash");
    title.textContent = c.name;
    topic.textContent = c.topic || "";
    actions.innerHTML = `<button class="icon-btn" data-act="invite" data-tip="Convidar pessoas">${ic("userPlus")}</button><button class="icon-btn${S.showMembers ? " on" : ""}" data-act="toggle-members" data-tip="Lista de membros">${ic("users")}</button>${search}`;
  } else if (S.view === "stage" && c) {
    const n = [...S.voice.values()].filter(v => v.channelId === c.id).length;
    icon.innerHTML = ic("volume");
    title.textContent = c.name;
    topic.textContent = n ? `${n} ${n === 1 ? "pessoa" : "pessoas"} na sala` : "Sala vazia";
    actions.innerHTML = `<button class="icon-btn" data-act="invite" data-tip="Convidar pessoas">${ic("userPlus")}</button>${search}`;
  } else if (S.view === "discover") {
    icon.innerHTML = ic("compass"); title.textContent = "Explorar"; topic.textContent = "Comunidades públicas"; actions.innerHTML = search;
  } else if (S.view === "friends") {
    icon.innerHTML = ic("users"); title.textContent = "Amigos"; topic.textContent = ""; actions.innerHTML = search;
  } else {
    icon.innerHTML = ic("users"); title.textContent = "Início"; topic.textContent = ""; actions.innerHTML = search;
  }
}

function renderMembers() {
  const el = $("#members"), app = $("#app"), gc = S.view === "chat" ? chan() : null;
  const s = gc && gc.group ? { members: gc.members, ownerId: gc.ownerId, id: gc.id } : srv();
  const show = S.view === "chat" && s;
  app.classList.toggle("no-members", !(show && S.showMembers));
  if (!show) { el.innerHTML = ""; app.classList.remove("show-members"); return; }
  const all = s.members.map(user).sort((a, b) => a.username.localeCompare(b.username, "pt-BR"));
  const on = all.filter(u => u.status !== "offline"), off = all.filter(u => u.status === "offline");
  const row = u => {
    const v = S.voice.get(u.id);
    const sub = v && v.serverId === s.id ? `<small>${ic("volume", "xs")} ${esc(chan(v.channelId)?.name || "Em chamada")}${v.screen ? " · ao vivo" : ""}</small>`
      : u.game ? `<small class="playing">${ic("gamepad", "xs")} Jogando <b>${esc(u.game.name)}</b></small>`
      : u.cs ? `<small>${csText(u)}</small>`
      : u.about ? `<small>${esc(u.about)}</small>` : "";
    return `<div class="member${u.status === "offline" ? " off" : ""}${V.speaking.has(u.id) ? " speaking" : ""}" data-act="profile" data-uid="${u.id}" data-voice-user="${u.id}">${avatar(u, 34, true)}<div class="who"><b>${nameHTML(u)}${u.id === s.ownerId ? `<span data-tip="Dono do servidor">${ic("crown", "xs")}</span>` : ""}</b>${sub}</div></div>`;
  };
  el.innerHTML = `<div class="cat">Online — ${on.length}</div>${on.map(row).join("")}${off.length ? `<div class="cat">Offline — ${off.length}</div>${off.map(row).join("")}` : ""}`;
}

function renderUserPanel() {
  if (!S.me) return;
  const pref = S.me.statusPref || "online";
  const shown = { ...S.me, status: pref === "invisible" ? "offline" : pref };
  const micOff = S.muted || S.deaf;
  $("#userPanel").innerHTML = `<div class="me-card" data-act="status-menu" data-tip="Definir status">${avatar(shown, 34, true)}<div class="who"><b>${nameHTML(S.me)}</b><small>${csText(S.me) || esc(S.me.about || STATUS[pref])}</small></div></div>
    <button class="icon-btn${micOff ? " bad" : ""}" data-act="mute" data-tip="${micOff ? "Ativar microfone" : "Silenciar"} (Ctrl+Shift+M)">${ic(micOff ? "micOff" : "mic")}</button>
    <button class="icon-btn${S.deaf ? " bad" : ""}" data-act="deafen" data-tip="${S.deaf ? "Ativar áudio" : "Desativar áudio"} (Ctrl+Shift+D)">${ic(S.deaf ? "headOff" : "headphones")}</button>
    <button class="icon-btn" data-act="settings" data-tip="Configurações do usuário">${ic("settings")}</button>`;
}

function renderVoicePanel() {
  const el = $("#voicePanel");
  if (!V.channelId) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  const c = chan(V.channelId), s = S.servers.get(V.serverId);
  const peers = [...V.peers.values()];
  const failed = peers.some(p => p.pc.connectionState === "failed");
  const waiting = V.joining || peers.some(p => !["connected", "closed"].includes(p.pc.connectionState));
  el.classList.remove("hidden");
  el.innerHTML = `<div class="vp-row"><div class="vp-status"><b class="${failed || waiting ? "wait" : ""}" data-ping data-tip="${V.ping != null ? `Latência: ${V.ping} ms` : "Medindo latência…"}">${ic("signal", "sm")}${failed ? "Reconectando…" : waiting ? "Conectando…" : "Voz conectada"}</b><small data-act="open-ch" data-id="${V.channelId}">${esc(c?.name || "")} / ${esc(s?.name || "")}</small></div><button class="icon-btn" data-act="voice-leave" data-tip="Desconectar">${ic("phoneOff")}</button></div>
    <div class="vp-actions"><button class="btn${V.cam ? " on" : ""}" data-act="cam">${ic(V.cam ? "camera" : "cameraOff", "sm")}Câmera</button><button class="btn${V.screen ? " on" : ""}" data-act="share">${ic("monitorUp", "sm")}${V.screen ? "Ao vivo" : "Tela"}</button></div>`;
}

function renderTitle() {
  let m = 0, u = false;
  for (const s of S.servers.values()) { const r = serverUnread(s); m += r.mentions; u = u || r.unread; }
  document.title = (m ? `(${m}) ` : u ? "• " : "") + "NEXORA";
}

/* ------------------------------------------------------------------ */
/* Navegação                                                           */
/* ------------------------------------------------------------------ */
const VIEWS = { chat: "#chatView", stage: "#stageView", home: "#homeView", discover: "#discoverView", friends: "#friendsView" };
function setView(view) {
  if (S.view === "chat" && S.channelId) S.drafts[S.channelId] = $("#input").value;
  const changed = S.view !== view;
  S.view = view;
  for (const [k, sel] of Object.entries(VIEWS)) $(sel).classList.toggle("hidden", k !== view);
  const el = $(VIEWS[view]);
  if (changed || view === "chat") {
    el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("enter"), 450);
  }
  $("#app").classList.remove("drawer", "show-members");
  closeMention();
}
function goHome() {
  setView("home");
  S.serverId = null; S.channelId = null;
  store.set("last", { view: "home" });
  renderHome(); renderAll(); updateMini();
}
function goDiscover() {
  setView("discover");
  S.serverId = null; S.channelId = null;
  loadDiscover(); renderAll(); updateMini();
}
function goFriends(tab) {
  if (tab) S.friendsTab = tab;
  setView("friends");
  S.serverId = null; S.channelId = null;
  renderFriends(); renderAll(); updateMini();
  if (S.friendsTab === "add") setTimeout(() => $("#addFriendInput")?.focus(), 80);
}
function openDM(id) {
  const d = S.dms.get(id);
  if (!d) return;
  if (S.view === "chat" && S.channelId) S.drafts[S.channelId] = $("#input").value;
  S.serverId = null;
  S.channelId = id;
  setView("chat");
  cancelReply(); cancelEdit();
  openText(chan(id));
  renderRail(); renderSide(); renderTop(); renderMembers(); updateMini();
}
async function startDM(userId) {
  for (const d of S.dms.values()) if (d.userId === userId) { openDM(d.id); return; }
  const r = await emit("dm:open", { userId });
  if (r.error) { toast(r.error, "error"); return; }
  if (r.user) S.users.set(r.user.id, r.user);
  if (!S.dms.has(r.dm.id)) S.dms.set(r.dm.id, r.dm);
  openDM(r.dm.id);
}
/* grupos de mensagem direta */
function groupModal(groupId) {
  const g = groupId ? S.dms.get(groupId) : null;
  const friends = [...S.friends].filter(([id, st]) => st === "friend" && !(g && g.members.includes(id))).map(([id]) => user(id)).sort((a, b) => a.username.localeCompare(b.username, "pt-BR"));
  const sel = new Set();
  modal({
    title: g ? "Adicionar ao grupo" : "Criar grupo", sub: g ? esc(groupTitle(g)) : "Converse com até 10 amigos de uma vez.",
    body: `${g ? "" : `<label class="field"><span>Nome do grupo (opcional)</span><input id="gName" maxlength="40" placeholder="Ex.: Squad do sábado"></label>`}
      <span class="label">Amigos — <span data-count>0</span> selecionados</span>
      <div class="pick-list">${friends.length ? friends.map(u => `<label class="pick">${avatar(u, 32, true)}<b>${esc(u.username)}</b><input type="checkbox" value="${u.id}"></label>`).join("") : `<p style="color:var(--muted)">${g ? "Todos os seus amigos já estão aqui." : "Adicione amigos primeiro em Início › Amigos."}</p>`}</div>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go ${friends.length ? "" : "disabled"}>${g ? "Adicionar" : "Criar grupo"}</button></div>`,
    onMount(m, close) {
      m.addEventListener("change", e => {
        if (e.target.type !== "checkbox") return;
        if (e.target.checked) sel.add(e.target.value); else sel.delete(e.target.value);
        if (sel.size > 9 - (g ? g.members.length - 1 : 0)) { e.target.checked = false; sel.delete(e.target.value); toast("Um grupo pode ter até 10 pessoas.", "warn"); }
        e.target.closest(".pick").classList.toggle("on", e.target.checked);
        m.querySelector("[data-count]").textContent = sel.size;
      });
      m.querySelector("[data-go]").onclick = async () => {
        if (!sel.size) { toast("Escolha pelo menos um amigo.", "warn"); return; }
        const r = g ? await emit("group:add", { id: g.id, userIds: [...sel] }) : await emit("group:create", { userIds: [...sel], name: m.querySelector("#gName").value });
        if (r.error) { toast(r.error, "error"); return; }
        close();
        if (!g) { setTimeout(() => openDM(r.id), 150); confetti(); }
      };
    }
  });
}
function groupMenu(id, at) {
  const g = S.dms.get(id);
  if (!g) return;
  menu(at, [
    { label: "Adicionar pessoas", icon: "userPlus", run: () => groupModal(id) },
    { label: "Mudar nome do grupo", icon: "edit", run: () => modal({ title: "Nome do grupo", body: `<label class="field"><span>Nome</span><input id="gn" maxlength="40" value="${esc(g.name || "")}"></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Salvar</button></div>`, onMount(m, close) { m.querySelector("[data-go]").onclick = async () => { const r = await emit("group:update", { id, name: m.querySelector("#gn").value }); if (r.error) toast(r.error, "error"); else close(); }; } }) },
    { label: "Mudar ícone", icon: "image", run: () => iconMenu(at instanceof Element ? at : document.body, v => emit("group:update", { id, icon: v }), true) },
    "-",
    { label: "Sair do grupo", icon: "logout", danger: true, run: async () => { if (await confirmBox({ title: "Sair do grupo", html: `Sair de <b>${esc(groupTitle(g))}</b>? Você só volta se alguém te adicionar.`, ok: "Sair" })) { const r = await emit("group:leave", { id }); if (r.error) toast(r.error, "error"); } } }
  ]);
}
async function addFriend(username) {
  const r = await emit("friend:request", { username });
  if (r.error) { toast(r.error, "error"); return false; }
  toast(r.state === "friend" ? "Vocês agora são amigos! 🎉" : `Pedido de amizade enviado para ${username}.`, "ok");
  return true;
}
function friendRow(u, state) {
  const v = S.voice.get(u.id);
  const sub = state === "in" ? "Pedido de amizade recebido" : state === "out" ? "Pedido enviado" : v ? `${ic("volume", "xs")} Em chamada` : u.game ? `${ic("gamepad", "xs")} Jogando <b>${esc(u.game.name)}</b>` : esc(u.about || STATUS[u.status]);
  const btns = state === "in"
    ? `<button class="round ok" data-act="friend-accept" data-uid="${u.id}" data-tip="Aceitar">${ic("check")}</button><button class="round bad" data-act="friend-remove" data-uid="${u.id}" data-tip="Recusar">${ic("x")}</button>`
    : state === "out" ? `<button class="round bad" data-act="friend-remove" data-uid="${u.id}" data-tip="Cancelar pedido">${ic("x")}</button>`
    : `<button class="round" data-act="dm-user" data-uid="${u.id}" data-tip="Mensagem">${ic("message")}</button><button class="round" data-act="friend-more" data-uid="${u.id}" data-tip="Mais">${ic("chevron")}</button>`;
  return `<div class="friend-row" data-uid="${u.id}">${avatar(u, 38, true, `data-act="profile" data-uid="${u.id}"`)}<div class="who"><b>${esc(u.username)}</b><small>${sub}</small></div><div class="acts">${btns}</div></div>`;
}
function renderFriends() {
  const root = $("#friendsView");
  if (!S.me) return;
  const tab = S.friendsTab;
  const all = [...S.friends].map(([id, st]) => ({ u: user(id), st })).sort((a, b) => a.u.username.localeCompare(b.u.username, "pt-BR"));
  const friends = all.filter(x => x.st === "friend");
  const pending = all.filter(x => x.st !== "friend");
  const inCount = pending.filter(x => x.st === "in").length;
  const tabs = [["online", "Online"], ["all", "Todos"], ["pending", `Pendentes${inCount ? ` <b class="badge">${inCount}</b>` : ""}`], ["add", "Adicionar amigo"]];
  let body = "";
  if (tab === "add") {
    body = `<div class="add-friend"><h2>Adicionar amigo</h2><p>Você pode adicionar amigos pelo nome de usuário do NEXORA.</p>
      <form class="add-box" id="addFriendForm"><input id="addFriendInput" placeholder="Digite o nome de usuário" maxlength="24" autocomplete="off" spellcheck="false"><button class="btn primary">Enviar pedido</button></form></div>
      <div class="section-title">Sugestões dos seus servidores</div>` +
      ([...S.users.values()].filter(u => u.id !== S.me.id && !S.friends.has(u.id)).slice(0, 12).map(u => `<div class="friend-row">${avatar(u, 38, true, `data-act="profile" data-uid="${u.id}"`)}<div class="who"><b>${esc(u.username)}</b><small>${esc(u.about || STATUS[u.status])}</small></div><div class="acts"><button class="btn sm" data-act="add-friend" data-uid="${u.id}">${ic("userPlus", "sm")}Adicionar</button></div></div>`).join("") || `<p style="color:var(--muted)">Entre em servidores para ver sugestões.</p>`);
  } else {
    const list = tab === "online" ? friends.filter(x => x.u.status !== "offline") : tab === "all" ? friends : pending;
    const label = tab === "online" ? "Online" : tab === "all" ? "Todos os amigos" : "Pendentes";
    body = `<div class="section-title">${label} — ${list.length}</div>` + (list.length ? list.map(x => friendRow(x.u, x.st)).join("")
      : `<div class="empty">${ic(tab === "pending" ? "userCheck" : "users")}<p>${tab === "pending" ? "Nenhum pedido pendente." : tab === "online" ? "Nenhum amigo online agora." : "Você ainda não tem amigos aqui."}</p><button class="btn primary" data-act="friends-tab" data-tab="add">${ic("userPlus", "sm")}Adicionar amigo</button></div>`);
  }
  root.innerHTML = `<div class="page"><div class="tabs-row">${tabs.map(([k, n]) => `<button class="tab${k === tab ? " on" : ""}${k === "add" ? " add" : ""}" data-act="friends-tab" data-tab="${k}">${n}</button>`).join("")}<button class="btn sm" style="margin-left:auto" data-act="new-group">${ic("users", "sm")}Novo grupo</button></div>${body}</div>`;
  const form = $("#addFriendForm");
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const inp = $("#addFriendInput"), name = inp.value.trim();
    if (!name) return;
    if (await addFriend(name)) inp.value = "";
  };
}
function openServer(id) {
  const s = S.servers.get(id);
  if (!s) return;
  const last = store.get("lastChan", {})[id];
  const c = s.channels.find(x => x.id === last && x.type === "text") || s.channels.find(x => x.type === "text");
  if (c) openChannel(c.id);
}
function openChannel(cid, join = true) {
  if (isDm(cid)) { openDM(cid); return; }
  const s = serverOf(cid), c = chan(cid);
  if (!s || !c) return;
  if (S.view === "chat" && S.channelId) S.drafts[S.channelId] = $("#input").value;
  S.serverId = s.id;
  S.channelId = c.id;
  store.set("last", { server: s.id });
  if (c.type === "text") {
    const lc = store.get("lastChan", {}); lc[s.id] = c.id; store.set("lastChan", lc);
    setView("chat");
    cancelReply(); cancelEdit();
    openText(c);
  } else {
    setView("stage");
    if (join && V.channelId !== c.id) joinVoice(c.id);
  }
  renderRail(); renderSide(); renderTop(); renderMembers(); renderStage(); updateMini();
}

/* ------------------------------------------------------------------ */
/* Mensagens                                                           */
/* ------------------------------------------------------------------ */
const box = () => $("#messages");
const atBottom = () => { const b = box(); return b.scrollHeight - b.scrollTop - b.clientHeight < 90; };
function scrollBottom(smooth) {
  const b = box();
  b.scrollTo({ top: b.scrollHeight, behavior: smooth && !S.settings.reduceMotion ? "smooth" : "auto" });
  $("#jumpBtn").classList.add("hidden");
  S.stick = true;
}
const msgNode = id => $("#msgList").querySelector(`.msg[data-id="${CSS.escape(id)}"]`);
function findMsg(id, cid = S.channelId) { const b = S.msgs.get(cid); return b ? b.list.find(m => m.id === id) : null; }

function openText(c) {
  const input = $("#input");
  input.placeholder = c.group ? `Mensagem para ${groupTitle(c)}` : c.dm ? `Mensagem para @${c.name}` : `Conversar em #${c.name}`;
  input.value = S.drafts[c.id] || "";
  autoGrow();
  S.newMarker = isUnread(c) && S.lastRead[c.id] ? { cid: c.id, ts: S.lastRead[c.id] } : null;
  const b = S.msgs.get(c.id);
  if (b && b.loaded) { renderMessages(true); markRead(c.id); }
  else {
    $("#msgList").innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="skeleton"><i style="width:40px;height:40px;border-radius:50%;flex:none"></i><div style="flex:1;display:grid;gap:8px"><i style="width:${90 + (i * 37) % 80}px;height:12px"></i><i style="width:${40 + (i * 23) % 50}%;height:12px"></i></div></div>`).join("");
    loadHistory(c.id);
  }
  renderTyping();
  renderTray();
  if (!matchMedia("(pointer: coarse)").matches) input.focus({ preventScroll: true });
}

async function loadHistory(cid, older = false) {
  let b = S.msgs.get(cid);
  if (!b) S.msgs.set(cid, (b = { list: [], more: true, loaded: false, loading: false }));
  if (b.loading || (older && !b.more)) return;
  b.loading = true;
  const first = b.list.find(m => !m.pending);
  const r = await emit("history", { channelId: cid, before: older && first ? first.id : undefined });
  b.loading = false;
  if (r.error) { toast(r.error, "error"); return; }
  if (older) b.list = [...r.messages, ...b.list];
  else { const ids = new Set(r.messages.map(m => m.id)); b.list = [...r.messages, ...b.list.filter(m => !ids.has(m.id))]; }
  b.more = r.more;
  b.loaded = true;
  if (S.channelId !== cid || S.view !== "chat") return;
  if (older) {
    const el = box(), h = el.scrollHeight, top = el.scrollTop;
    renderMessages(false);
    el.scrollTop = el.scrollHeight - h + top;
  } else {
    renderMessages(true);
    markRead(cid);
  }
}

function msgHTML(m, prev, isNew) {
  if (m.sys) {
    const u = user(m.a);
    return `<div class="msg sys${isNew ? " new" : ""}" data-id="${m.id}">${ic("arrowRight")}<span><b data-act="profile" data-uid="${u.id}" style="color:${esc(u.color)}">${esc(u.username)}</b> ${m.sys === "gname" && m.t ? `mudou o nome do grupo para <b>${esc(m.t)}</b>.` : SYS[m.sys] || ""}<time title="${esc(fmtFull(m.ts))}">${fmtStamp(m.ts)}</time></span></div>`;
  }
  const u = user(m.a), s = srv(), mine = S.me && m.a === S.me.id;
  const cont = prev && !prev.sys && prev.a === m.a && !m.re && m.ts - prev.ts < 420000 && sameDay(prev.ts, m.ts);
  const { html, images, jumbo } = renderText(m.t);
  const cls = ["msg", cont && "cont", isNew && "new", m.pending && "pending", m.failed && "failed", mentionsMe(m) && "mention"].filter(Boolean).join(" ");
  let h = `<div class="${cls}" data-id="${esc(m.id)}">`;
  if (m.re) {
    const ru = user(m.re.a);
    h += `<div class="msg-reply" data-act="jump-to" data-ref="${esc(m.re.id)}">${avatar(ru, 16)}<b style="color:${esc(ru.color)}">@${esc(ru.username)}</b><span>${esc((m.re.t || "📎 Anexo").replace(/\n/g, " "))}</span></div>`;
  }
  h += cont ? `<time class="msg-side-time" title="${esc(fmtFull(m.ts))}">${fmtTime(m.ts)}</time>` : avatar(u, 40, false, `data-act="profile" data-uid="${esc(u.id)}"`);
  h += `<div class="msg-body">`;
  if (!cont) {
    h += `<div class="msg-head"><span class="msg-author" data-act="profile" data-uid="${esc(u.id)}" style="color:${esc(u.color)}">${nameHTML(u)}</span>${s && s.ownerId === u.id ? `<span class="owner-tag" data-tip="Dono do servidor">${ic("crown")}</span>` : ""}<time title="${esc(fmtFull(m.ts))}">${fmtStamp(m.ts)}</time></div>`;
  }
  h += `<div class="msg-text${jumbo ? " jumbo" : ""}">${html}${m.e ? `<span class="edited" title="${esc(fmtFull(m.e))}">(editado)</span>` : ""}</div>`;
  h += filesHTML(m);
  h += images.map(src => `<img class="msg-img" src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-act="lightbox">`).join("");
  if (m.r && Object.keys(m.r).length) {
    h += `<div class="reactions">${Object.entries(m.r).map(([e, ids]) => `<button class="react${ids.includes(S.me.id) ? " on" : ""}" data-act="react-toggle" data-emoji="${esc(e)}" data-tip="${esc(ids.slice(0, 10).map(id => user(id).username).join(", ") + (ids.length > 10 ? "…" : ""))}"><span>${esc(e)}</span><b>${ids.length}</b></button>`).join("")}<button class="react add" data-act="react" data-tip="Adicionar reação">${ic("smile")}</button></div>`;
  }
  h += `</div>`;
  if (!m.pending && !m.failed) {
    h += `<div class="msg-actions">${QUICK.map(e => `<button class="quick" data-act="quick-react" data-emoji="${e}" data-tip="Reagir com ${e}">${e}</button>`).join("")}<button data-act="react" data-tip="Adicionar reação">${ic("smile")}</button><button data-act="reply" data-tip="Responder">${ic("reply")}</button>${mine ? `<button data-act="edit" data-tip="Editar">${ic("edit")}</button>` : `<button data-act="copy" data-tip="Copiar texto">${ic("copy")}</button>`}${mine || isOwner(s) ? `<button class="danger" data-act="delete" data-tip="Apagar (Shift = sem confirmar)">${ic("trash")}</button>` : ""}</div>`;
  }
  return h + "</div>";
}

function renderMessages(toBottom) {
  const c = chan();
  if (!c) return;
  const b = S.msgs.get(c.id), list = b ? b.list : [];
  let h = "";
  if (b && !b.more && c.group) h += `<div class="chan-intro">${groupAvatar(c, 76)}<h2 style="margin-top:12px">${esc(groupTitle(c))}</h2><p>Bem-vindos ao começo do grupo. Só quem está aqui vê estas mensagens.</p></div>`;
  else if (b && !b.more && c.dm) { const u = user(c.userId); h += `<div class="chan-intro">${avatar(u, 76)}<h2 style="margin-top:12px">${esc(u.username)}</h2><p>Este é o começo da sua conversa privada com <b>@${esc(u.username)}</b>. Só vocês dois veem estas mensagens.</p></div>`; }
  else if (b && !b.more) h += `<div class="chan-intro"><div class="big">${ic("hash")}</div><h2>Bem-vindo(a) a #${esc(c.name)}!</h2><p>Este é o começo do canal #${esc(c.name)}.${c.topic ? " " + esc(c.topic) : ""}</p></div>`;
  else if (b && b.more) h += `<div class="skeleton"><i style="width:40px;height:40px;border-radius:50%;flex:none"></i><div style="flex:1;display:grid;gap:8px"><i style="width:120px;height:12px"></i><i style="width:60%;height:12px"></i></div></div>`;
  let prev = null, marked = false;
  const nm = S.newMarker && S.newMarker.cid === c.id ? S.newMarker.ts : 0;
  for (const m of list) {
    if (!prev || !sameDay(prev.ts, m.ts)) h += `<div class="day">${fmtDay(m.ts)}</div>`;
    if (nm && !marked && m.ts > nm && m.a !== S.me.id) { h += `<div class="new-line"><span>NOVO</span></div>`; marked = true; }
    h += msgHTML(m, prev);
    prev = m;
  }
  $("#msgList").innerHTML = h;
  if (toBottom) {
    const line = $("#msgList .new-line");
    if (line && line.offsetTop < box().scrollHeight - box().clientHeight) { line.scrollIntoView({ block: "center" }); S.stick = atBottom(); }
    else scrollBottom(false);
  }
}
function rerenderMsg(m, domId = m.id) {
  const node = msgNode(domId), b = S.msgs.get(S.channelId);
  if (!node || !b) return;
  const i = b.list.indexOf(m);
  node.outerHTML = msgHTML(m, i > 0 ? b.list[i - 1] : null);
}
function appendMsg(m) {
  const b = S.msgs.get(S.channelId);
  const i = b.list.indexOf(m), prev = i > 0 ? b.list[i - 1] : null;
  const stick = atBottom();
  $("#msgList").insertAdjacentHTML("beforeend", (!prev || !sameDay(prev.ts, m.ts) ? `<div class="day">${fmtDay(m.ts)}</div>` : "") + msgHTML(m, prev, true));
  if (stick || (S.me && m.a === S.me.id)) scrollBottom(true);
  else $("#jumpBtn").classList.remove("hidden");
}

function markRead(cid) {
  const c = chan(cid);
  if (!c) return;
  const ts = c.last ? c.last.ts : 0;
  if (S.lastRead[cid] === ts && !S.mentions.has(cid)) return;
  S.lastRead[cid] = ts;
  S.mentions.delete(cid);
  persistRead();
  schedule("rail", "side", "title");
}
const persistRead = debounce(() => { store.set("lastRead", S.lastRead); store.set("mentions", Object.fromEntries(S.mentions)); }, 800);
function maybeRead() {
  if (S.view === "chat" && S.channelId && document.hasFocus() && atBottom()) markRead(S.channelId);
}

/* ---------- anexos (enviar arquivos) ---------- */
const fmtSize = n => (n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB");
S.uploads = [];
function fileHref(f) { return `/f/${f.id}/${encodeURIComponent(f.n).replace(/%20/g, "+")}`; }
function filesHTML(m) {
  if (!m.f || !m.f.length) return "";
  return `<div class="atts">${m.f.map(f => {
    const url = esc(fileHref(f));
    if (/^image\/(png|jpeg|gif|webp|avif)$/.test(f.t)) return `<img class="msg-img" src="${url}" alt="${esc(f.n)}" loading="lazy" decoding="async" data-act="lightbox">`;
    if (/^video\/(mp4|webm|ogg)$/.test(f.t)) return `<video class="msg-video" src="${url}" controls preload="metadata" playsinline></video>`;
    if (/^audio\//.test(f.t)) return `<div class="att-audio">${ic("music")}<div><b>${esc(f.n)}</b><audio src="${url}" controls preload="none"></audio></div></div>`;
    return `<a class="att-file" href="${url}" download="${esc(f.n)}">${ic("file", "lg")}<span><b>${esc(f.n)}</b><small>${fmtSize(f.s)}</small></span>${ic("download")}</a>`;
  }).join("")}</div>`;
}
function addFiles(list) {
  if (LOCAL) { toast("Enviar arquivos funciona na versão online do NEXORA.", "warn"); return; }
  if (S.view !== "chat" || !S.channelId) return;
  for (const f of [...list]) {
    if (S.uploads.filter(u => u.cid === S.channelId).length >= 10) { toast("No máximo 10 arquivos por mensagem.", "warn"); break; }
    if (f.size > 8 * 1024 * 1024) { toast(`"${f.name}" passa de 8 MB.`, "warn"); continue; }
    const up = { key: Math.random().toString(36).slice(2), file: f, name: f.name || "imagem.png", size: f.size, type: f.type || "application/octet-stream", progress: 0, cid: S.channelId };
    if (/^image\//.test(up.type)) up.preview = URL.createObjectURL(f);
    S.uploads.push(up);
    startUpload(up);
  }
  renderTray();
  $("#input").focus();
}
function startUpload(up) {
  const xhr = new XMLHttpRequest();
  up.xhr = xhr;
  xhr.open("POST", "/api/upload");
  xhr.setRequestHeader("authorization", "Bearer " + S.token);
  xhr.setRequestHeader("x-file-name", encodeURIComponent(up.name));
  xhr.setRequestHeader("content-type", up.type);
  xhr.upload.onprogress = e => { if (e.lengthComputable) { up.progress = e.loaded / e.total; updTrayItem(up); } };
  xhr.onload = () => {
    let j = {};
    try { j = JSON.parse(xhr.responseText); } catch {}
    if (xhr.status === 200 && j.id) { up.id = j.id; up.progress = 1; }
    else { up.error = j.error || "Falha no envio"; toast(up.error, "error"); }
    renderTray();
  };
  xhr.onerror = () => { up.error = "Falha na conexão"; renderTray(); };
  xhr.send(up.file);
}
function renderTray() {
  const tray = $("#uploadTray");
  const list = S.uploads.filter(u => u.cid === S.channelId);
  tray.classList.toggle("hidden", !list.length);
  tray.innerHTML = list.map(u => `<div class="up${u.error ? " err" : ""}${u.id ? " done" : ""}" data-key="${u.key}">${u.preview ? `<img src="${u.preview}" alt="">` : `<span class="up-ic">${ic("file")}</span>`}<div class="up-info"><b>${esc(u.name)}</b><small>${u.error ? esc(u.error) : u.id ? fmtSize(u.size) : "Enviando… " + Math.round(u.progress * 100) + "%"}</small><i style="transform:scaleX(${u.progress})"></i></div><button type="button" class="icon-btn" data-act="up-remove" data-key="${u.key}" data-tip="Remover">${ic("x", "sm")}</button></div>`).join("");
}
function updTrayItem(up) {
  const el = $(`#uploadTray [data-key="${up.key}"]`);
  if (!el) return;
  el.querySelector("small").textContent = "Enviando… " + Math.round(up.progress * 100) + "%";
  el.querySelector("i").style.transform = `scaleX(${up.progress})`;
}
function removeUpload(key) {
  const i = S.uploads.findIndex(u => u.key === key);
  if (i < 0) return;
  const u = S.uploads[i];
  try { if (u.xhr && u.xhr.readyState !== 4) u.xhr.abort(); } catch {}
  if (u.preview) setTimeout(() => URL.revokeObjectURL(u.preview), 5000);
  S.uploads.splice(i, 1);
  renderTray();
}

async function sendMessage() {
  const input = $("#input"), text = input.value.trim(), cid = S.channelId;
  const ups = S.uploads.filter(u => u.cid === cid && !u.error);
  if ((!text && !ups.length) || !cid) return;
  if (ups.some(u => !u.id)) { toast("Espere os arquivos terminarem de enviar.", "warn"); return; }
  if (text.length > 2000) { toast("Mensagem muito longa (máximo de 2000 caracteres).", "warn"); return; }
  const b = S.msgs.get(cid);
  if (!b || !b.loaded) return;
  const nonce = Math.random().toString(36).slice(2, 12);
  const re = S.replyTo;
  const m = { id: "tmp-" + nonce, a: S.me.id, t: text, ts: Date.now(), nonce, pending: true };
  if (ups.length) { m.f = ups.map(u => ({ id: u.id, n: u.name, t: u.type, s: u.size })); for (const u of ups) removeUpload(u.key); }
  const fileIds = ups.map(u => u.id);
  if (re) m.re = { id: re.id, a: re.a, t: re.t.slice(0, 140) };
  input.value = ""; S.drafts[cid] = ""; autoGrow(); cancelReply(); closeMention();
  if (S.newMarker) { S.newMarker = null; $("#msgList .new-line")?.remove(); }
  b.list.push(m);
  appendMsg(m);
  const r = await emit("send", { channelId: cid, text, replyTo: re ? re.id : undefined, nonce, files: fileIds });
  if (r.error) {
    const i = b.list.indexOf(m);
    if (i >= 0) b.list.splice(i, 1);
    msgNode(m.id)?.remove();
    if (!input.value && S.channelId === cid) { input.value = text; autoGrow(); }
    toast(r.error, "error");
  }
}

function startEdit(id) {
  const m = findMsg(id);
  if (!m || m.a !== S.me.id || m.pending || m.sys) return;
  cancelEdit();
  const node = msgNode(id), t = node && node.querySelector(".msg-text");
  if (!t) return;
  S.editing = id;
  t.classList.add("hidden");
  t.insertAdjacentHTML("afterend", `<div class="edit-box"><textarea maxlength="2000">${esc(m.t)}</textarea><small>Esc para <a data-act="edit-cancel">cancelar</a> • Enter para <a data-act="edit-save">salvar</a></small></div>`);
  const ta = node.querySelector(".edit-box textarea");
  grow(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener("input", () => grow(ta));
  ta.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelEdit(); $("#input").focus(); }
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
  });
}
function cancelEdit() {
  if (!S.editing) return;
  const node = msgNode(S.editing);
  S.editing = null;
  if (node) { node.querySelector(".edit-box")?.remove(); node.querySelector(".msg-text")?.classList.remove("hidden"); }
}
async function saveEdit() {
  const id = S.editing, node = msgNode(id), ta = node && node.querySelector(".edit-box textarea");
  if (!ta) return;
  const text = ta.value.trim();
  cancelEdit();
  if (!text) { deleteMsg(id); return; }
  const r = await emit("edit", { channelId: S.channelId, id, text });
  if (r.error) toast(r.error, "error");
}
async function deleteMsg(id, skipConfirm) {
  const m = findMsg(id);
  if (!m) return;
  if (!skipConfirm) {
    const ok = await confirmBox({ title: "Apagar mensagem", html: `Tem certeza de que quer apagar esta mensagem?<div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--bg-1);max-height:160px;overflow:auto;white-space:pre-wrap">${esc(m.t)}</div><small style="display:block;margin-top:10px;color:var(--muted)">Dica: segure Shift ao clicar na lixeira para apagar sem confirmar.</small>`, ok: "Apagar" });
    if (!ok) return;
  }
  const r = await emit("delete", { channelId: S.channelId, id });
  if (r.error) toast(r.error, "error");
}
function startReply(id) {
  const m = findMsg(id);
  if (!m || m.pending || m.sys) return;
  S.replyTo = m;
  const u = user(m.a), bar = $("#replyBar");
  bar.innerHTML = `${ic("reply", "sm")}<span>Respondendo a <b style="color:${esc(u.color)}">${esc(u.username)}</b></span><button class="icon-btn" type="button" data-act="reply-cancel" data-tip="Cancelar (Esc)">${ic("x", "sm")}</button>`;
  bar.classList.remove("hidden");
  $("#input").focus();
}
function cancelReply() { S.replyTo = null; $("#replyBar").classList.add("hidden"); }
function react(id, emoji) { emit("react", { channelId: S.channelId, id, emoji }).then(r => r.error && toast(r.error, "error")); }

/* digitação e menções */
function autoGrow() { grow($("#input")); }
function grow(ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, innerHeight * 0.4) + "px"; }
let lastTypingSent = 0, typingTimer = null;
function onTyping({ channelId, userId }) {
  if (!S.me || userId === S.me.id) return;
  let m = S.typing.get(channelId);
  if (!m) S.typing.set(channelId, (m = new Map()));
  m.set(userId, Date.now() + 6000);
  if (channelId === S.channelId) renderTyping();
  if (!typingTimer) typingTimer = setInterval(() => {
    const now = Date.now();
    for (const [cid, mm] of S.typing) { for (const [u, t] of mm) if (t < now) mm.delete(u); if (!mm.size) S.typing.delete(cid); }
    renderTyping();
    if (!S.typing.size) { clearInterval(typingTimer); typingTimer = null; }
  }, 1000);
}
function removeTyping(cid, uid) { const m = S.typing.get(cid); if (m && m.delete(uid) && cid === S.channelId) renderTyping(); }
function renderTyping() {
  const el = $("#typing");
  const m = S.typing.get(S.channelId);
  const names = m ? [...m.keys()].map(id => user(id).username) : [];
  if (!names.length) { el.innerHTML = ""; return; }
  const txt = names.length === 1 ? `<b>${esc(names[0])}</b> está digitando…` : names.length <= 3 ? `<b>${names.map(esc).join("</b>, <b>")}</b> estão digitando…` : "Várias pessoas estão digitando…";
  el.innerHTML = `<span class="dots"><i></i><i></i><i></i></span><span>${txt}</span>`;
}
function computeMention() {
  const ta = $("#input"), s = srv(), c = chan();
  const before = ta.value.slice(0, ta.selectionStart);
  const m = before.match(/(^|\s)@([\p{L}\p{N}_.-]{0,24})$/u);
  const members = s ? s.members : c && c.group ? c.members : c && c.dm ? [S.me.id, c.userId] : null;
  if (!m || !members) { closeMention(); return; }
  const q = m[2].toLowerCase();
  const list = members.map(user).filter(u => u.username.toLowerCase().startsWith(q))
    .sort((a, b) => (a.status === "offline") - (b.status === "offline") || a.username.localeCompare(b.username)).slice(0, 8);
  if (!list.length) { closeMention(); return; }
  S.mention = { start: ta.selectionStart - m[2].length - 1, end: ta.selectionStart, list, i: 0 };
  drawMention();
}
function drawMention() {
  const st = S.mention, pop = $("#mentionPop");
  pop.innerHTML = `<span class="label">Membros — Tab ou Enter para escolher</span>` + st.list.map((u, i) => `<button type="button" class="${i === st.i ? "on" : ""}" data-act="mention-pick" data-i="${i}">${avatar(u, 24, true)}<b>${esc(u.username)}</b><small>${STATUS[u.status]}</small></button>`).join("");
  pop.classList.remove("hidden");
}
function closeMention() { S.mention = null; $("#mentionPop").classList.add("hidden"); }
function pickMention(i) {
  const st = S.mention;
  if (!st) return;
  const u = st.list[i], ta = $("#input");
  ta.value = ta.value.slice(0, st.start) + "@" + u.username + " " + ta.value.slice(st.end);
  const p = st.start + u.username.length + 2;
  ta.setSelectionRange(p, p);
  closeMention(); ta.focus(); autoGrow();
}
function insertAtCaret(text) {
  const ta = $("#input"), a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
  ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
  ta.setSelectionRange(a + text.length, a + text.length);
  ta.focus(); autoGrow();
}

/* ------------------------------------------------------------------ */
/* Início e Explorar                                                   */
/* ------------------------------------------------------------------ */
function cardHTML(s, opt = {}) {
  const members = Array.isArray(s.members) ? s.members.length : s.members;
  const online = Array.isArray(s.members) ? s.members.filter(id => user(id).status !== "offline").length : s.online;
  return `<div class="scard" style="--c:${esc(s.color)}" data-act="${opt.act || "server"}" data-id="${esc(s.id)}" role="button" tabindex="0"><div class="sb"><div class="si">${serverIcon(s)}</div></div><div class="sc"><h3>${esc(s.name)}${s.public ? `<span data-tip="Servidor público" style="display:grid;color:var(--muted)">${ic("globe", "xs")}</span>` : ""}</h3><p>${esc(s.description || "Sem descrição ainda.")}</p><div class="meta"><span><i class="dot st-online"></i>${online} online</span><span><i class="dot st-offline"></i>${members} ${members === 1 ? "membro" : "membros"}</span>${opt.badge || ""}</div></div></div>`;
}
function renderHome() {
  if (!S.me) return;
  const hr = new Date().getHours();
  const greet = hr < 5 ? "Boa madrugada" : hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  const servers = sortedServers();
  const byChan = new Map();
  for (const v of S.voice.values()) { if (!byChan.has(v.channelId)) byChan.set(v.channelId, []); byChan.get(v.channelId).push(v); }
  const live = [...byChan].map(([cid, list]) => {
    const c = chan(cid), s = serverOf(cid);
    if (!c || !s) return "";
    return `<div class="row" data-act="open-ch" data-id="${cid}" role="button" tabindex="0">${serverIcon(s)}<div style="min-width:0"><b>${esc(c.name)}</b><small style="display:block;color:var(--muted)">${esc(s.name)}${list.some(v => v.screen) ? ' · <b class="live-tag">AO VIVO</b>' : ""}</small></div><div class="faces">${list.slice(0, 5).map(v => avatar(user(v.userId), 30)).join("")}</div></div>`;
  }).join("");
  $("#homeView").innerHTML = `<div class="page">
    <div class="hero"><h1>${greet}, ${esc(S.me.username)}! 👋</h1><p>Crie seu espaço, chame a galera e converse por texto, voz e tela — rápido, leve e bonito.</p></div>
    <div class="section-title">Ações rápidas</div>
    <div class="quick">
      <button class="qcard" data-act="create-server" style="--k:var(--accent)"><span class="qi">${ic("plus")}</span><span><b>Criar servidor</b><small>Seu espaço, suas regras</small></span></button>
      <button class="qcard" data-act="join-server" style="--k:#23d18b"><span class="qi">${ic("link")}</span><span><b>Entrar com convite</b><small>Cole um link ou código</small></span></button>
      <button class="qcard" data-act="discover" style="--k:#0ea5c6"><span class="qi">${ic("compass")}</span><span><b>Explorar</b><small>Comunidades públicas</small></span></button>
      ${DESKTOP || isStandalone() ? "" : `<button class="qcard" data-act="get-app" style="--k:#f472b6"><span class="qi">${ic("arrowDown")}</span><span><b>Baixar o app</b><small>Windows, Android e iPhone</small></span></button>`}
    </div>
    ${live ? `<div class="section-title">${ic("volume", "sm")} Acontecendo agora</div><div class="vc-live">${live}</div>` : ""}
    <div class="section-title">Seus servidores — ${servers.length}</div>
    ${servers.length ? `<div class="cards">${servers.map(s => cardHTML(s)).join("")}</div>` : `<div class="empty">${ic("users")}<p>Você ainda não está em nenhum servidor.<br>Crie um ou entre com um convite!</p></div>`}
  </div>`;
}
let discoverQ = "";
async function loadDiscover() {
  const root = $("#discoverView");
  if (!root.querySelector(".page")) {
    root.innerHTML = `<div class="page"><div class="hero"><h1>Encontre sua comunidade</h1><p>De games a estudos — sempre tem alguém online para conversar.</p><label class="search">${ic("search")}<input id="discQ" placeholder="Buscar comunidades" autocomplete="off"></label></div><div class="section-title">Comunidades em destaque</div><div class="cards" id="discGrid"></div></div>`;
    $("#discQ").addEventListener("input", debounce(e => { discoverQ = e.target.value; loadDiscover(); }, 300));
  }
  const grid = $("#discGrid");
  if (!grid.children.length) grid.innerHTML = Array.from({ length: 6 }, () => `<div class="scard"><div class="sb" style="--c:var(--bg-4)"></div><div class="sc skeleton" style="display:grid"><i style="width:60%;height:14px"></i><i style="width:90%;height:10px"></i></div></div>`).join("");
  const r = await emit("discover", { q: discoverQ });
  if (S.view !== "discover") return;
  if (r.error) { grid.innerHTML = `<div class="empty">${esc(r.error)}</div>`; return; }
  grid.innerHTML = r.servers.length
    ? r.servers.map(s => cardHTML(s, { act: s.joined ? "server" : "discover-join", badge: s.joined ? `<span style="margin-left:auto;color:var(--green);font-weight:600">✓ Membro</span>` : `<span style="margin-left:auto;color:var(--accent);font-weight:600">Entrar →</span>` })).join("")
    : `<div class="empty" style="grid-column:1/-1">${ic("compass")}<p>${discoverQ ? "Nada encontrado para essa busca." : "Nenhuma comunidade pública ainda."}<br>Que tal criar a primeira?</p><button class="btn primary" data-act="create-server">Criar servidor</button></div>`;
}

/* ------------------------------------------------------------------ */
/* Modo local: quando o arquivo é aberto sem servidor, tudo fica       */
/* salvo neste navegador (contas, servidores, canais e mensagens).     */
/* ------------------------------------------------------------------ */
const LOCAL = typeof io === "undefined";
let ldb = null;
function ldbLoad() { if (!ldb) ldb = Object.assign({ users: {}, servers: {}, invites: {}, messages: {} }, store.get("localdb", {})); return ldb; }
const ldbSave = debounce(() => store.set("localdb", ldb), 300);
const lid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
async function hashPw(pw, salt) {
  const data = new TextEncoder().encode(salt + ":" + pw);
  if (window.crypto && crypto.subtle) {
    const h = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 2166136261;
  for (const b of data) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h.toString(16);
}
async function localAuth(mode, username, password) {
  const db = ldbLoad();
  if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(username)) throw new Error("O usuário deve ter de 3 a 24 caracteres (letras, números, _ . -).");
  const found = Object.values(db.users).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (mode === "register") {
    if (found) throw new Error("Esse nome de usuário já está em uso.");
    const salt = lid();
    const u = { id: lid(), username, color: pick(COLORS), avatar: "", about: "", status: "online", salt, hash: await hashPw(password, salt), created: Date.now() };
    db.users[u.id] = u;
    store.set("localdb", db);
    return "local:" + u.id;
  }
  if (!found || found.hash !== (await hashPw(password, found.salt))) throw new Error("Usuário ou senha incorretos.");
  return "local:" + found.id;
}
const L_TEMPLATES = {
  friends: [["boas-vindas", "text", "Diga oi para todo mundo! 👋"], ["geral", "text"], ["memes", "text"], ["fotos-e-clipes", "text"], ["Lounge", "voice"], ["Cinema", "voice"]],
  gaming: [["boas-vindas", "text", "Regras e avisos do clã"], ["geral", "text"], ["clipes", "text", "Mande suas melhores jogadas 🎮"], ["procurando-grupo", "text", "Ache gente para jogar"], ["Lobby", "voice"], ["Squad 1", "voice"], ["Squad 2", "voice"]],
  study: [["boas-vindas", "text"], ["geral", "text"], ["duvidas", "text", "Pergunte sem medo"], ["materiais", "text", "Links, resumos e arquivos"], ["Sala de estudos", "voice"], ["Foco total", "voice"]],
  community: [["avisos", "text", "Novidades da comunidade"], ["boas-vindas", "text"], ["geral", "text"], ["sugestoes", "text"], ["Palco", "voice"], ["Bate-papo", "voice"]]
};
function localSocket(token) {
  const db = ldbLoad();
  const uid = String(token || "").replace(/^local:/, "");
  const handlers = {};
  const fire = (ev, d) => (handlers[ev] || []).forEach(f => f(d));
  const fail = m => { throw new Error(m); };
  const sock = {
    id: "local-" + lid(), connected: true,
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return sock; },
    emit() {},
    disconnect() { sock.connected = false; },
    timeout() {
      return { emit: (ev, data, cb) => setTimeout(() => { let r; try { r = api(ev, data || {}) || { ok: true }; } catch (e) { r = { error: e.message }; } cb(null, r); }, 0) };
    }
  };
  const me = () => db.users[uid];
  if (!me()) { setTimeout(() => fire("connect_error", new Error("auth")), 0); return sock; }
  const pub = u => ({ id: u.id, username: u.username, color: u.color, avatar: u.avatar || "", about: u.about || "", status: u.id === uid ? (u.status === "invisible" ? "offline" : u.status || "online") : "offline", created: u.created });
  const chanView = c => { const l = db.messages[c.id]; const last = l && l.length ? l[l.length - 1] : null; return { id: c.id, name: c.name, type: c.type, topic: c.topic || "", last: last ? { id: last.id, ts: last.ts, a: last.a } : null }; };
  const meta = s => ({ id: s.id, name: s.name, icon: s.icon || "", color: s.color, description: s.description || "", public: !!s.public, ownerId: s.ownerId, created: s.created });
  const view = s => ({ ...meta(s), channels: s.channels.map(chanView), members: s.members.slice() });
  const mine = () => Object.values(db.servers).filter(s => s.members.includes(uid));
  const usersOf = list => { const m = new Map([[uid, pub(me())]]); for (const s of list) for (const id of s.members) if (db.users[id]) m.set(id, pub(db.users[id])); return [...m.values()]; };
  const getS = (id, owner) => { const s = db.servers[id]; if (!s || !s.members.includes(uid)) fail("Servidor não encontrado."); if (owner && s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso."); return s; };
  const getC = (cid, type) => {
    const s = Object.values(db.servers).find(x => x.channels.some(c => c.id === cid));
    if (!s || !s.members.includes(uid)) fail("Canal não encontrado.");
    const c = s.channels.find(x => x.id === cid);
    if (type && c.type !== type) fail("Canal não encontrado.");
    return { s, c };
  };
  const findM = (cid, id) => { const { s, c } = getC(cid, "text"); const m = (db.messages[c.id] || []).find(x => x.id === id); if (!m || m.sys) fail("Mensagem não encontrada."); return { s, c, m }; };
  const txt = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const cleanName = (n, t) => (t === "voice" ? txt(n, 32) : txt(n, 32).toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, ""));
  const pic = v => (typeof v === "string" ? (v.startsWith("data:image/") ? v.slice(0, 60000) : txt(v, 16)) : "");
  const sysJoin = s => {
    const ch = s.channels.find(c => c.type === "text");
    if (!ch) return;
    const m = { id: lid(), a: uid, t: "", ts: Date.now(), sys: "join" };
    (db.messages[ch.id] = db.messages[ch.id] || []).push(m);
    fire("msg", { channelId: ch.id, serverId: s.id, m });
  };
  const addMember = s => {
    if (s.members.includes(uid)) return;
    s.members.push(uid);
    fire("server:add", { server: view(s), users: usersOf([s]), voice: [] });
    sysJoin(s);
    ldbSave();
  };
  let vs = null;
  const vView = () => ({ sock: sock.id, userId: uid, serverId: vs.sid, channelId: vs.cid, muted: vs.muted, deaf: vs.deaf, screen: vs.screen, cam: vs.cam, at: vs.at });
  function api(ev, d) {
    switch (ev) {
      case "history": {
        const { c } = getC(d.channelId, "text");
        const list = db.messages[c.id] || [];
        let end = list.length;
        if (d.before) { const i = list.findIndex(m => m.id === d.before); if (i >= 0) end = i; }
        const start = Math.max(0, end - 50);
        return { messages: list.slice(start, end), more: start > 0 };
      }
      case "send": {
        const { s, c } = getC(d.channelId, "text");
        const t = txt(d.text, 2000);
        if (!t) fail("A mensagem está vazia.");
        const list = db.messages[c.id] || (db.messages[c.id] = []);
        const m = { id: lid(), a: uid, t, ts: Date.now() };
        if (d.replyTo) { const r = list.find(x => x.id === d.replyTo && !x.sys); if (r) m.re = { id: r.id, a: r.a, t: r.t.slice(0, 140) }; }
        list.push(m);
        if (list.length > 500) list.splice(0, list.length - 500);
        ldbSave();
        fire("msg", { channelId: c.id, serverId: s.id, m, nonce: d.nonce });
        return { id: m.id };
      }
      case "edit": {
        const { c, m } = findM(d.channelId, d.id);
        if (m.a !== uid) fail("Você só pode editar suas mensagens.");
        const t = txt(d.text, 2000);
        if (!t) fail("A mensagem está vazia.");
        m.t = t; m.e = Date.now();
        ldbSave();
        fire("msg:update", { channelId: c.id, m });
        return;
      }
      case "delete": {
        const { s, c, m } = findM(d.channelId, d.id);
        if (m.a !== uid && s.ownerId !== uid) fail("Sem permissão para apagar esta mensagem.");
        db.messages[c.id].splice(db.messages[c.id].indexOf(m), 1);
        ldbSave();
        fire("msg:delete", { channelId: c.id, id: m.id });
        return;
      }
      case "react": {
        const { c, m } = findM(d.channelId, d.id);
        const e = txt(d.emoji, 32);
        if (!e) fail("Reação inválida.");
        m.r = m.r || {};
        const ids = m.r[e] || [];
        m.r[e] = ids.includes(uid) ? ids.filter(x => x !== uid) : [...ids, uid];
        if (!m.r[e].length) delete m.r[e];
        if (!Object.keys(m.r).length) delete m.r;
        ldbSave();
        fire("msg:update", { channelId: c.id, m });
        return;
      }
      case "server:create": {
        const name = txt(d.name, 40);
        if (name.length < 2) fail("Dê ao servidor um nome com pelo menos 2 caracteres.");
        const tpl = L_TEMPLATES[d.template] || L_TEMPLATES.friends;
        const s = { id: lid(), name, icon: pic(d.icon), color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : pick(COLORS), description: txt(d.description, 200), public: !!d.isPublic, ownerId: uid, created: Date.now(), members: [uid],
          channels: tpl.map(([n, type, topic]) => ({ id: lid(), name: n, type, topic: topic || "" })) };
        db.servers[s.id] = s;
        ldbSave();
        fire("server:add", { server: view(s), users: [pub(me())], voice: [] });
        return { id: s.id };
      }
      case "server:update": {
        const s = getS(d.serverId, true);
        if (d.name !== undefined) { const n = txt(d.name, 40); if (n.length < 2) fail("Nome muito curto."); s.name = n; }
        if (d.icon !== undefined) s.icon = pic(d.icon);
        if (d.color && /^#[0-9a-f]{6}$/i.test(d.color)) s.color = d.color;
        if (d.description !== undefined) s.description = txt(d.description, 200);
        if (d.isPublic !== undefined) s.public = !!d.isPublic;
        ldbSave();
        fire("server:update", { server: meta(s) });
        return;
      }
      case "server:delete": {
        const s = getS(d.serverId, true);
        for (const c of s.channels) delete db.messages[c.id];
        for (const [k, v] of Object.entries(db.invites)) if (v.serverId === s.id) delete db.invites[k];
        delete db.servers[s.id];
        ldbSave();
        fire("server:remove", { serverId: s.id, reason: `O servidor "${s.name}" foi excluído.` });
        return;
      }
      case "server:leave": {
        const s = getS(d.serverId);
        if (s.ownerId === uid) fail("Você é o dono. Transfira ou exclua o servidor.");
        s.members = s.members.filter(x => x !== uid);
        ldbSave();
        fire("server:remove", { serverId: s.id });
        return;
      }
      case "server:kick": {
        const s = getS(d.serverId, true);
        if (d.userId === uid || !s.members.includes(d.userId)) fail("Membro inválido.");
        s.members = s.members.filter(x => x !== d.userId);
        ldbSave();
        fire("member:remove", { serverId: s.id, userId: d.userId });
        return;
      }
      case "server:transfer": {
        const s = getS(d.serverId, true);
        if (d.userId === uid || !s.members.includes(d.userId)) fail("Membro inválido.");
        s.ownerId = d.userId;
        ldbSave();
        fire("server:update", { server: meta(s) });
        return;
      }
      case "invite:create": {
        const s = getS(d.serverId);
        let code = Object.keys(db.invites).find(k => db.invites[k].serverId === s.id && db.invites[k].by === uid);
        if (!code) { code = Math.random().toString(36).slice(2, 10); db.invites[code] = { serverId: s.id, by: uid, created: Date.now(), uses: 0 }; ldbSave(); }
        return { code };
      }
      case "invite:info":
      case "invite:join": {
        const code = String(d.code || "").split(/[/?=#]/).filter(Boolean).pop() || "";
        const inv = db.invites[code.replace(/[^A-Za-z0-9]/g, "")];
        const s = inv && db.servers[inv.serverId];
        if (!s) fail("Convite inválido ou expirado.");
        if (ev === "invite:info") return { server: { ...meta(s), members: s.members.length, online: 1 }, inviter: db.users[inv.by] ? db.users[inv.by].username : null, joined: s.members.includes(uid) };
        addMember(s);
        return { serverId: s.id };
      }
      case "discover": {
        const q = txt(d.q, 40).toLowerCase();
        return { servers: Object.values(db.servers).filter(s => s.public && (!q || s.name.toLowerCase().includes(q))).map(s => ({ ...meta(s), members: s.members.length, online: s.members.includes(uid) ? 1 : 0, joined: s.members.includes(uid) })) };
      }
      case "discover:join": {
        const s = db.servers[d.serverId];
        if (!s || !s.public) fail("Servidor não encontrado.");
        addMember(s);
        return { serverId: s.id };
      }
      case "channel:create": {
        const s = getS(d.serverId, true);
        const type = d.type === "voice" ? "voice" : "text";
        const name = cleanName(d.name, type);
        if (!name) fail("Dê um nome ao canal.");
        const c = { id: lid(), name, type, topic: type === "text" ? txt(d.topic, 160) : "" };
        s.channels.push(c);
        ldbSave();
        fire("channel:add", { serverId: s.id, channel: chanView(c) });
        return { id: c.id };
      }
      case "channel:update": {
        const { s, c } = getC(d.channelId);
        if (s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
        if (d.name !== undefined) { const n = cleanName(d.name, c.type); if (!n) fail("Nome inválido."); c.name = n; }
        if (d.topic !== undefined && c.type === "text") c.topic = txt(d.topic, 160);
        ldbSave();
        fire("channel:update", { serverId: s.id, channel: chanView(c) });
        return;
      }
      case "channel:delete": {
        const { s, c } = getC(d.channelId);
        if (s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
        if (c.type === "text" && s.channels.filter(x => x.type === "text").length <= 1) fail("O servidor precisa de pelo menos um canal de texto.");
        s.channels = s.channels.filter(x => x.id !== c.id);
        delete db.messages[c.id];
        ldbSave();
        fire("channel:remove", { serverId: s.id, channelId: c.id });
        return;
      }
      case "channel:move": {
        const { s, c } = getC(d.channelId);
        if (s.ownerId !== uid) fail("Apenas o dono do servidor pode fazer isso.");
        const same = s.channels.filter(x => x.type === c.type), i = same.indexOf(c), j = i + (d.dir < 0 ? -1 : 1);
        if (j < 0 || j >= same.length) return;
        const a = s.channels.indexOf(c), b = s.channels.indexOf(same[j]);
        [s.channels[a], s.channels[b]] = [s.channels[b], s.channels[a]];
        ldbSave();
        fire("channels:order", { serverId: s.id, order: s.channels.map(x => x.id) });
        return;
      }
      case "profile:update": {
        const u = me();
        if (d.color && /^#[0-9a-f]{6}$/i.test(d.color)) u.color = d.color;
        if (d.avatar !== undefined) u.avatar = pic(d.avatar);
        if (d.about !== undefined) u.about = txt(d.about, 190);
        if (["online", "idle", "dnd", "invisible"].includes(d.status)) u.status = d.status;
        ldbSave();
        fire("user:update", { user: pub(u), statusPref: u.status });
        return;
      }
      case "voice:join": {
        const { s, c } = getC(d.channelId, "voice");
        if (vs) fire("voice:leave", { sock: sock.id, userId: uid, channelId: vs.cid, serverId: vs.sid });
        vs = { sid: s.id, cid: c.id, muted: !!d.muted, deaf: !!d.deaf, screen: null, cam: null, at: Date.now() };
        fire("voice:state", vView());
        return { peers: [], iceServers: [] };
      }
      case "voice:update": {
        if (!vs) return;
        for (const k of ["muted", "deaf", "screen", "cam"]) if (d[k] !== undefined) vs[k] = d[k] || (k === "muted" || k === "deaf" ? false : null);
        fire("voice:state", vView());
        return;
      }
      case "voice:leave": {
        if (vs) { fire("voice:leave", { sock: sock.id, userId: uid, channelId: vs.cid, serverId: vs.sid }); vs = null; }
        return;
      }
      case "friend:request": case "friend:accept": case "friend:remove": case "dm:open":
        fail("Amigos e mensagens privadas funcionam na versão online do NEXORA.");
        return;
      default: return { ok: true };
    }
  }
  setTimeout(() => {
    fire("connect");
    const list = mine();
    fire("ready", { me: { ...pub(me()), statusPref: me().status || "online" }, servers: list.map(view), users: usersOf(list), voice: [], iceServers: [], limits: { voice: 12 } });
  }, 50);
  return sock;
}

/* ------------------------------------------------------------------ */
/* Socket                                                              */
/* ------------------------------------------------------------------ */
function emit(ev, data) {
  return new Promise(res => {
    if (!S.socket || !S.socket.connected) return res({ error: "Sem conexão com o servidor." });
    S.socket.timeout(12000).emit(ev, data || {}, (err, r) => res(err ? { error: "O servidor demorou para responder." } : r || {}));
  });
}
function connect() {
  const sock = LOCAL ? localSocket(S.token) : io({ auth: { token: S.token }, transports: ["websocket", "polling"], reconnectionDelayMax: 6000 });
  S.socket = sock;
  sock.on("connect_error", err => {
    if (err && err.message === "auth") { store.del("token"); S.token = null; sock.disconnect(); showAuth("Sua sessão expirou. Entre novamente."); return; }
    if (S.ready) $("#connBar").classList.remove("hidden");
  });
  sock.on("connect", () => $("#connBar").classList.add("hidden"));
  sock.on("disconnect", reason => { if (reason !== "io client disconnect") $("#connBar").classList.remove("hidden"); });

  sock.on("ready", onReady);
  sock.on("presence", ({ userId, status }) => {
    const u = S.users.get(userId);
    if (!u) return;
    u.status = status;
    schedule("members", "side", "home");
  });
  sock.on("friend:update", ({ userId, state, user: u }) => {
    if (u) S.users.set(u.id, u);
    const prev = S.friends.get(userId);
    if (state) S.friends.set(userId, state); else S.friends.delete(userId);
    if (state === "in" && prev !== "in") { sfx("mention"); toast(`${user(userId).username} quer ser seu amigo!`, "info", 4500); }
    if (state === "friend" && prev === "out") toast(`${user(userId).username} aceitou seu pedido! 🎉`, "ok");
    schedule("rail", "side", "home", "top", "title");
  });
  sock.on("dm:add", ({ dm, user: u, users }) => {
    if (u) S.users.set(u.id, u);
    for (const x of users || []) if (!S.me || x.id !== S.me.id) S.users.set(x.id, x);
    const old = S.dms.get(dm.id);
    if (old) Object.assign(old, dm); else S.dms.set(dm.id, dm);
    schedule("side", "top", "members");
    if (S.view === "chat" && S.channelId === dm.id) $("#input").placeholder = `Mensagem para ${dmTitle(chan(dm.id))}`;
  });
  sock.on("dm:remove", ({ id }) => {
    S.dms.delete(id); S.msgs.delete(id); S.mentions.delete(id);
    if (S.channelId === id) goFriends(); else schedule("side", "rail");
  });
  sock.on("user:update", ({ user: u, statusPref }) => {
    S.users.set(u.id, u);
    if (S.me && u.id === S.me.id) { S.me = { ...u, statusPref: statusPref || S.me.statusPref }; schedule("user"); }
    schedule("members", "side", "home", "stage");
    if (S.view === "chat") rerenderVisible();
  });
  sock.on("server:add", ({ server, users, voice }) => {
    S.servers.set(server.id, server);
    for (const u of users || []) if (!S.me || u.id !== S.me.id) S.users.set(u.id, u);
    for (const v of voice || []) S.voice.set(v.userId, v);
    renderAll();
  });
  sock.on("server:update", ({ server }) => {
    const s = S.servers.get(server.id);
    if (!s) return;
    Object.assign(s, server);
    renderAll();
    if (S.view === "chat" && S.serverId === s.id) rerenderVisible();
  });
  sock.on("server:remove", ({ serverId, reason }) => {
    const s = S.servers.get(serverId);
    if (!s) return;
    if (V.serverId === serverId) teardownVoice();
    for (const c of s.channels) { S.msgs.delete(c.id); S.mentions.delete(c.id); }
    S.servers.delete(serverId);
    if (S.serverId === serverId) goHome(); else renderAll();
    if (reason) toast(reason, "warn", 5000);
  });
  sock.on("member:add", ({ serverId, user: u }) => {
    const s = S.servers.get(serverId);
    if (!s) return;
    S.users.set(u.id, u);
    if (!s.members.includes(u.id)) s.members.push(u.id);
    schedule("members", "home", "side");
  });
  sock.on("member:remove", ({ serverId, userId }) => {
    const s = S.servers.get(serverId);
    if (!s || (S.me && userId === S.me.id)) return;
    s.members = s.members.filter(id => id !== userId);
    schedule("members", "home");
  });
  sock.on("channel:add", ({ serverId, channel }) => { const s = S.servers.get(serverId); if (s) { s.channels.push(channel); schedule("side"); } });
  sock.on("channel:update", ({ serverId, channel }) => {
    const s = S.servers.get(serverId), c = s && s.channels.find(x => x.id === channel.id);
    if (!c) return;
    Object.assign(c, { name: channel.name, topic: channel.topic });
    schedule("side", "top");
    if (S.channelId === c.id && S.view === "chat") $("#input").placeholder = `Conversar em #${c.name}`;
  });
  sock.on("channel:remove", ({ serverId, channelId }) => {
    const s = S.servers.get(serverId);
    if (!s) return;
    s.channels = s.channels.filter(c => c.id !== channelId);
    S.msgs.delete(channelId); S.mentions.delete(channelId);
    if (S.channelId === channelId) openServer(serverId); else schedule("side", "rail");
  });
  sock.on("channels:order", ({ serverId, order }) => {
    const s = S.servers.get(serverId);
    if (!s) return;
    s.channels.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    schedule("side");
  });
  sock.on("msg", onMsg);
  sock.on("msg:update", ({ channelId, m }) => {
    const b = S.msgs.get(channelId);
    if (!b) return;
    const i = b.list.findIndex(x => x.id === m.id);
    if (i < 0) return;
    b.list[i] = m;
    if (S.view === "chat" && S.channelId === channelId && S.editing !== m.id) rerenderMsg(m);
  });
  sock.on("msg:delete", ({ channelId, id }) => {
    const b = S.msgs.get(channelId);
    if (!b) return;
    const i = b.list.findIndex(x => x.id === id);
    if (i < 0) return;
    b.list.splice(i, 1);
    if (S.view === "chat" && S.channelId === channelId) {
      const el = box(), top = el.scrollTop, stick = atBottom();
      renderMessages(false);
      if (stick) scrollBottom(); else el.scrollTop = top;
    }
  });
  sock.on("typing", onTyping);
  sock.on("voice:state", onVoiceState);
  sock.on("voice:leave", onVoiceLeave);
  sock.on("voice:signal", onSignal);
  sock.on("act", onAct);
  sock.on("act:sum", ({ channelId, type }) => { if (type) S.acts.set(channelId, type); else S.acts.delete(channelId); schedule("side"); });
  sock.on("act:ev", ev => { if (V.actEl && V.actEl._onEv) V.actEl._onEv(ev); });
  sock.on("call:fx", onCallFx);
  sock.on("voice:kicked", ({ reason } = {}) => { teardownVoice(); if (reason) toast(reason, "warn", 5000); renderAll(); });
}

function onReady(d) {
  const rejoin = V.channelId;
  if (rejoin) teardownVoice(true);
  S.me = d.me;
  S.users = new Map(d.users.map(u => [u.id, u]));
  S.servers = new Map(d.servers.map(s => [s.id, s]));
  S.voice = new Map(d.voice.map(v => [v.userId, v]));
  S.ice = d.iceServers || [];
  S.voiceLimit = (d.limits && d.limits.voice) || 12;
  S.friends = new Map(Object.entries(d.friends || {}));
  S.dms = new Map((d.dms || []).map(x => [x.id, x]));
  S.steamAuto = !!d.steamAuto;
  S.acts = new Map((d.acts || []).map(a => [a.channelId, a.type]));
  if (d.now) S.clockOff = d.now - Date.now();
  S.msgs.clear();
  for (const id of S.mentions.keys()) if (!chan(id)) S.mentions.delete(id);
  const first = !S.ready;
  S.ready = true;
  showApp();
  if (S.channelId && chan(S.channelId) && (isDm(S.channelId) || S.servers.has(S.serverId))) openChannel(S.channelId, false);
  else if (!first && S.view === "friends") goFriends();
  else if (first) {
    const last = store.get("last", {});
    if (last.server && S.servers.has(last.server)) openServer(last.server); else goHome();
  } else goHome();
  renderAll();
  if (rejoin && chan(rejoin)) joinVoice(rejoin);
  if (S.openFriends) { S.openFriends = false; goFriends(); }
  if (S.pendingInvite) { const code = S.pendingInvite; S.pendingInvite = null; try { sessionStorage.removeItem("nx:invite"); } catch {} joinModal(code); }
}

function onMsg({ channelId, serverId, m, nonce }) {
  const dm = isDm(channelId) ? S.dms.get(channelId) : null;
  const s = dm ? { id: null, name: "Mensagem privada" } : S.servers.get(serverId);
  const c = dm ? chan(channelId) : s && s.channels.find(x => x.id === channelId);
  if (!c) return;
  c.last = { id: m.id, ts: m.ts, a: m.a };
  removeTyping(channelId, m.a);
  const b = S.msgs.get(channelId);
  const visible = S.view === "chat" && S.channelId === channelId;
  let replaced = false;
  if (b) {
    if (nonce && m.a === S.me.id) {
      const i = b.list.findIndex(x => x.nonce === nonce);
      if (i >= 0) { b.list[i] = m; replaced = true; if (visible) rerenderMsg(m, "tmp-" + nonce); }
    }
    if (!replaced && !b.list.some(x => x.id === m.id)) {
      b.list.push(m);
      if (b.list.length > 800 && !visible) { b.list.splice(0, b.list.length - 600); b.more = true; }
      if (visible && b.loaded) appendMsg(m);
    }
  }
  if (m.a === S.me.id || (visible && document.hasFocus() && atBottom())) markRead(channelId);
  else if (dm || mentionsMe(m)) {
    S.mentions.set(channelId, (S.mentions.get(channelId) || 0) + 1);
    persistRead();
    if (S.me.statusPref !== "dnd") { sfx("mention"); notify(m, s, c); }
  }
  schedule("rail", "side", "title");
}
function rerenderVisible() {
  const el = box(), top = el.scrollTop, stick = atBottom();
  renderMessages(false);
  if (stick) scrollBottom(); else el.scrollTop = top;
}
function notify(m, s, c) {
  if (!S.settings.notify || !("Notification" in window) || Notification.permission !== "granted") return;
  if (document.hasFocus() && S.channelId === c.id) return;
  const u = user(m.a);
  try {
    const n = new Notification(c.group ? `${u.username} em ${groupTitle(c)}` : c.dm ? `${u.username} (privado)` : `${u.username} em #${c.name} (${s.name})`, { body: m.t.slice(0, 160), tag: c.id, silent: true });
    n.onclick = () => { window.focus(); openChannel(c.id); n.close(); };
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Sons (gerados na hora — nenhum arquivo para baixar)                 */
/* ------------------------------------------------------------------ */
const SFX = {
  join: [[523, .09], [784, .15]], leave: [[659, .09], [440, .15]], mute: [[392, .08]], unmute: [[587, .08]],
  deaf: [[330, .08], [262, .12]], undeaf: [[392, .08], [523, .12]], mention: [[880, .07], [1175, .13]],
  live: [[523, .07], [659, .07], [880, .16]], unlive: [[880, .07], [523, .14]]
};
let sfxCtx = null, sfxIdle = null;
function sfx(kind) {
  if (!S.settings.sounds || !SFX[kind]) return;
  try {
    sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" });
    if (sfxCtx.state === "suspended") sfxCtx.resume();
    let t = sfxCtx.currentTime + 0.02;
    for (const [f, d] of SFX[kind]) {
      const o = sfxCtx.createOscillator(), g = sfxCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(sfxCtx.destination);
      o.start(t); o.stop(t + d + 0.03);
      t += d * 0.8;
    }
    clearTimeout(sfxIdle);
    sfxIdle = setTimeout(() => sfxCtx && sfxCtx.suspend(), 3000);  // economiza CPU
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Voz, câmera e tela (WebRTC)                                         */
/* ------------------------------------------------------------------ */
function sig(to, data) { if (S.socket) S.socket.emit("voice:signal", { to, data }); }

// Supressão de ruído: "ai" (RNNoise + portão inteligente), "browser" (a do navegador) ou "off"
const nsMode = () => (S.settings.nsMode || (S.settings.noise === false ? "off" : "ai"));
async function getRawMic() {
  const st = S.settings;
  const base = { echoCancellation: st.echo, noiseSuppression: nsMode() === "browser", autoGainControl: st.agc, channelCount: 1, sampleRate: 48000 };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: st.inputId ? { ...base, deviceId: { exact: st.inputId } } : base, video: false });
  } catch (e) {
    if (st.inputId && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) return navigator.mediaDevices.getUserMedia({ audio: base, video: false });
    throw e;
  }
}
let nsWasm = null, nsWarned = false;
async function buildNoiseChain(raw) {
  if (!window.AudioWorkletNode || location.protocol === "file:") throw new Error("sem AudioWorklet");
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000, latencyHint: "interactive" });
  try {
    if (!nsWasm) nsWasm = await fetch("/vendor/rnnoise/rnnoise.wasm").then(r => { if (!r.ok) throw new Error("wasm"); return r.arrayBuffer(); });
    await ctx.audioWorklet.addModule("/noise-worklet.js");
    const src = ctx.createMediaStreamSource(raw);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 80;           // corta ronco e vibração da mesa
    const node = new AudioWorkletNode(ctx, "nexora-noise", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { wasm: nsWasm.slice(0), gate: S.settings.nsGate !== false } });
    const dest = ctx.createMediaStreamDestination();
    src.connect(hp).connect(node).connect(dest);
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const out = dest.stream;
    out._raw = raw; out._ctx = ctx; out._node = node;
    return out;
  } catch (e) { ctx.close().catch(() => {}); throw e; }
}
async function getMic() {
  const raw = await getRawMic();
  if (nsMode() !== "ai") return raw;
  try { return await buildNoiseChain(raw); }
  catch (e) {
    console.warn("[ruído] IA indisponível, usando o microfone normal:", e);
    if (!nsWarned) { nsWarned = true; toast("Supressão de ruído com IA indisponível neste navegador — usando a padrão.", "warn"); }
    return raw;
  }
}
function stopMic(s) {
  if (!s) return;
  s.getTracks().forEach(t => t.stop());
  if (s._raw) s._raw.getTracks().forEach(t => t.stop());
  if (s._ctx) s._ctx.close().catch(() => {});
}
function ensureCtx() {
  if (!V.ctx) {
    V.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" });
    V.sink = V.ctx.createGain(); V.sink.gain.value = 0; V.sink.connect(V.ctx.destination);
  }
  if (V.ctx.state === "suspended") V.ctx.resume();
}
function attachMeter(uid, stream) {
  if (!V.ctx || !stream || !stream.getAudioTracks().length) return;
  const old = V.meters.get(uid);
  if (old && old.stream === stream) return;
  if (old) try { old.src.disconnect(); } catch {}
  const src = V.ctx.createMediaStreamSource(stream);
  const an = V.ctx.createAnalyser();
  an.fftSize = 256; an.smoothingTimeConstant = 0.2;
  src.connect(an); an.connect(V.sink);
  V.meters.set(uid, { stream, src, an, buf: new Uint8Array(an.fftSize), hold: 0 });
}
function setSpeaking(uid, on) {
  if (V.speaking.has(uid) === on) return;
  if (on) V.speaking.add(uid); else V.speaking.delete(uid);
  for (const el of document.querySelectorAll(`[data-voice-user="${uid}"]`)) el.classList.toggle("speaking", on);
}
function meterTick() {
  const now = performance.now(), th = S.settings.sensitivity;
  for (const [uid, m] of V.meters) {
    const st = S.voice.get(uid);
    const muted = uid === S.me.id ? S.muted || S.deaf : st ? st.muted : false;
    let level = 0;
    if (!muted) {
      m.an.getByteTimeDomainData(m.buf);
      for (let i = 0; i < m.buf.length; i++) { const v = Math.abs(m.buf[i] - 128); if (v > level) level = v; }
      level /= 128;
    }
    if (level > th) m.hold = now + 280;
    setSpeaking(uid, m.hold > now);
  }
}

async function joinVoice(cid) {
  if (V.joining) return;
  const s = serverOf(cid), c = chan(cid);
  if (!s || !c || c.type !== "voice") return;
  if (V.channelId === cid) return;
  if (!window.RTCPeerConnection || !navigator.mediaDevices) { toast("Seu navegador não suporta chamadas de voz.", "error"); return; }
  V.joining = true;
  schedule("vpanel");
  try {
    if (V.channelId) teardownVoice(true, true);
    ensureCtx();
    if (!V.mic) {
      try { V.mic = await getMic(); }
      catch { V.mic = null; toast("Microfone indisponível — você entrou só para ouvir.", "warn", 4500); }
    }
    const r = await emit("voice:join", { channelId: cid, muted: S.muted || S.deaf || !V.mic, deaf: S.deaf });
    if (r.error) throw new Error(r.error);
    V.channelId = cid; V.serverId = s.id;
    S.ice = r.iceServers || S.ice;
    if (r.now) S.clockOff = r.now - Date.now();
    destroyAct();
    V.act = r.act && r.act.type ? r.act : null;
    applyMic();
    if (V.mic) attachMeter(S.me.id, V.mic);
    for (const p of r.peers) createPeer(p.sock, p.userId, true);
    if (!V.loop) V.loop = setInterval(meterTick, 90);
    if (!V.statsTimer) V.statsTimer = setInterval(statsTick, 2000);
    sfx("join");
  } catch (e) {
    toast(e.message || "Não foi possível entrar na sala.", "error");
    if (!V.channelId && V.mic) { stopMic(V.mic); V.mic = null; }
  } finally {
    V.joining = false;
    renderAll();
  }
}
function leaveVoice() {
  if (!V.channelId) return;
  emit("voice:leave", {});
  if (S.me) S.voice.delete(S.me.id);
  teardownVoice();
  sfx("leave");
}
function teardownVoice(silent, keepMic) {
  V.act = null;
  destroyAct();
  if (V.controlling) stopControlling();
  for (const sock of [...V.granted.keys()]) endGrant(sock);
  for (const p of [...V.peers.values()]) closePeer(p);
  V.peers.clear();
  stopScreen(true); stopCam(true);
  for (const m of V.meters.values()) try { m.src.disconnect(); } catch {}
  V.meters.clear();
  for (const uid of [...V.speaking]) setSpeaking(uid, false);
  clearInterval(V.loop); V.loop = null;
  clearInterval(V.statsTimer); V.statsTimer = null;
  if (!keepMic && V.mic) { stopMic(V.mic); V.mic = null; }
  if (!keepMic && V.ctx && V.ctx.state === "running") V.ctx.suspend();
  V.watching.clear(); V.viewers.clear(); V.focus = null; V.ping = null;
  if (S.me && V.channelId) { const st = S.voice.get(S.me.id); if (st && st.channelId === V.channelId) S.voice.delete(S.me.id); }
  V.channelId = null; V.serverId = null;
  if (!silent) renderAll();
  updateMini();
}

function createPeer(sock, userId, initiator) {
  const old = V.peers.get(sock);
  if (old) closePeer(old);
  const pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
  const p = { sock, userId, pc, polite: S.socket.id < sock, makingOffer: false, ignoreOffer: false, tracksAdded: false, streams: new Map(), audios: new Map(), senders: {}, chain: Promise.resolve() };
  V.peers.set(sock, p);
  pc.onnegotiationneeded = async () => {
    try {
      p.makingOffer = true;
      await pc.setLocalDescription();
      sig(sock, { desc: pc.localDescription });
    } catch (e) { console.warn("[voz] oferta", e); }
    finally { p.makingOffer = false; }
  };
  pc.onicecandidate = e => { if (e.candidate) sig(sock, { cand: e.candidate }); };
  pc.ontrack = e => onTrack(p, e);
  pc.ondatachannel = e => setupDc(p, e.channel);
  if (initiator) setupDc(p, pc.createDataChannel("nx", { ordered: true }));
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") { try { pc.restartIce(); } catch {} }
    schedule("vpanel");
  };
  if (initiator) addBaseTracks(p);
  return p;
}
function addBaseTracks(p) {
  if (p.tracksAdded) return;
  p.tracksAdded = true;
  const t = V.mic && V.mic.getAudioTracks()[0];
  if (t) p.senders.mic = p.pc.addTrack(t, V.mic);
  else if (!p.pc.getTransceivers().some(x => x.receiver.track.kind === "audio")) p.pc.addTransceiver("audio", { direction: "recvonly" });
  if (V.cam) addCamTo(p);
}
function closePeer(p) {
  endGrant(p.sock, true);
  if (V.controlling && V.controlling.sock === p.sock) stopControlling(true);
  try { p.pc.close(); } catch {}
  for (const a of p.audios.values()) { a.pause(); a.srcObject = null; }
  p.audios.clear();
  const m = V.meters.get(p.userId);
  if (m && [...p.streams.values()].includes(m.stream)) { try { m.src.disconnect(); } catch {} V.meters.delete(p.userId); setSpeaking(p.userId, false); }
  V.peers.delete(p.sock);
  if (V.viewers.delete(p.sock)) rebalance();
}
function tuneSdp(desc) {
  if (!desc || !desc.sdp) return desc;
  const m = desc.sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!m) return desc;
  const sdp = desc.sdp.replace(new RegExp(`a=fmtp:${m[1]} ([^\\r\\n]*)`, "g"), (line, params) => {
    const add = ["useinbandfec=1", "usedtx=1", "maxaveragebitrate=64000"].filter(x => !params.includes(x.split("=")[0]));
    return add.length ? `${line};${add.join(";")}` : line;
  });
  return { type: desc.type, sdp };
}
function onSignal({ from, userId, data }) {
  if (!V.channelId || !data) return;
  let p = V.peers.get(from);
  if (!p) {
    if (!data.desc || data.desc.type !== "offer") return;
    p = createPeer(from, userId, false);
  }
  p.chain = p.chain.then(() => handleSignal(p, data)).catch(e => console.warn("[voz] sinal", e));
}
async function handleSignal(p, data) {
  const pc = p.pc;
  if (pc.signalingState === "closed") return;
  if (data.watch) { V.viewers.add(p.sock); addScreenTo(p); return; }
  if (data.unwatch) { V.viewers.delete(p.sock); removeScreenFrom(p); rebalance(); endGrant(p.sock, true); return; }
  if (data.ctrlReq) { askControl(p); return; }
  if (data.ctrlGrant) { onGranted(p, data.ctrlGrant); return; }
  if (data.ctrlDeny) { toast(typeof data.ctrlDeny === "string" ? data.ctrlDeny : `${user(p.userId).username} recusou o pedido de controle.`, "warn", 4500); return; }
  if (data.ctrlEnd) { if (V.controlling && V.controlling.sock === p.sock) stopControlling(true, `${user(p.userId).username} encerrou o controle.`); endGrant(p.sock, true); return; }
  if (data.desc) {
    const desc = data.desc;
    const collision = desc.type === "offer" && (p.makingOffer || pc.signalingState !== "stable");
    p.ignoreOffer = !p.polite && collision;
    if (p.ignoreOffer) return;
    await pc.setRemoteDescription(tuneSdp(desc));
    if (desc.type === "offer") {
      if (!p.tracksAdded) addBaseTracks(p);
      await pc.setLocalDescription();
      sig(p.sock, { desc: pc.localDescription });
    }
  } else if (data.cand) {
    try { await pc.addIceCandidate(data.cand); } catch (e) { if (!p.ignoreOffer) console.warn("[voz] ICE", e); }
  }
}
function onTrack(p, e) {
  const stream = e.streams[0] || new MediaStream([e.track]);
  p.streams.set(stream.id, stream);
  if (e.track.kind === "video") {
    // Baixa latência: o navegador mostra o quadro assim que chega (ideal para jogo e controle remoto).
    try {
      if ("jitterBufferTarget" in e.receiver) e.receiver.jitterBufferTarget = 0;
      else if ("playoutDelayHint" in e.receiver) e.receiver.playoutDelayHint = 0;
    } catch {}
  }
  if (e.track.kind === "audio" && !p.audios.has(stream.id)) {
    const a = new Audio();
    a.autoplay = true;
    a.srcObject = stream;
    p.audios.set(stream.id, a);
    if (S.settings.outputId && a.setSinkId) a.setSinkId(S.settings.outputId).catch(() => {});
    applyVolumes();
    a.play().catch(() => {});
    const st = S.voice.get(p.userId);
    if (!st || st.screen !== stream.id) attachMeter(p.userId, stream);
  }
  e.track.addEventListener("unmute", () => schedule("stage"));
  e.track.addEventListener("ended", () => schedule("stage"));
  stream.onremovetrack = () => schedule("stage");
  schedule("stage");
}
function applyMic() { const en = !(S.muted || S.deaf); if (V.mic) V.mic.getAudioTracks().forEach(t => (t.enabled = en)); }
function applyVolumes() {
  for (const p of V.peers.values()) for (const a of p.audios.values()) {
    a.muted = S.deaf || !!S.localMute[p.userId];
    a.volume = clamp(S.volumes[p.userId] ?? 1, 0, 1);
  }
}
function afterAudioChange() {
  store.set("muted", S.muted); store.set("deaf", S.deaf);
  applyMic(); applyVolumes();
  if (V.channelId) emit("voice:update", { muted: S.muted || S.deaf || !V.mic, deaf: S.deaf });
  schedule("user", "stage");
}
function toggleMute() {
  if (S.deaf) { S.deaf = false; S.muted = false; } else S.muted = !S.muted;
  afterAudioChange(); sfx(S.muted ? "mute" : "unmute");
}
function toggleDeaf() { S.deaf = !S.deaf; afterAudioChange(); sfx(S.deaf ? "deaf" : "undeaf"); }
async function refreshMic() {
  if (!V.channelId) return;
  let s;
  try { s = await getMic(); } catch { toast("Não foi possível acessar o microfone.", "error"); return; }
  const old = V.mic;
  V.mic = s;
  applyMic();
  const t = s.getAudioTracks()[0];
  for (const p of V.peers.values()) {
    if (p.senders.mic) await p.senders.mic.replaceTrack(t).catch(() => {});
    else p.senders.mic = p.pc.addTrack(t, s);
  }
  if (old) stopMic(old);
  attachMeter(S.me.id, s);
  emit("voice:update", { muted: S.muted || S.deaf });
}

/* --- transmissão de tela: só é codificada para quem assiste --- */
function preferCodec(tv, order) {
  try {
    if (!tv.setCodecPreferences || !window.RTCRtpReceiver || !RTCRtpReceiver.getCapabilities) return;
    const codecs = RTCRtpReceiver.getCapabilities("video").codecs;
    const rank = c => { const i = order.indexOf(c.mimeType); return i < 0 ? order.length : i; };
    tv.setCodecPreferences([...codecs].sort((a, b) => rank(a) - rank(b)));
  } catch {}
}
function screenBitrate() {
  const q = QUALITY[V.screenCfg.quality] || QUALITY["1080"];
  return Math.max(900000, Math.round(q.br / Math.sqrt(Math.max(1, V.viewers.size))));
}
function addScreenTo(p) {
  if (!V.screen || p.senders.screen) return;
  const q = QUALITY[V.screenCfg.quality] || QUALITY["1080"], detail = V.screenCfg.mode === "detail";
  const vt = V.screen.getVideoTracks()[0];
  if (!vt) return;
  const tv = p.pc.addTransceiver(vt, { direction: "sendonly", streams: [V.screen], sendEncodings: [{ maxBitrate: screenBitrate(), maxFramerate: q.fps, priority: "high", networkPriority: "high" }] });
  preferCodec(tv, detail ? ["video/VP9", "video/H264", "video/VP8", "video/AV1"] : ["video/H264", "video/VP8", "video/VP9", "video/AV1"]);
  try {
    const prm = tv.sender.getParameters();
    prm.degradationPreference = detail ? "maintain-resolution" : "maintain-framerate";
    tv.sender.setParameters(prm).catch(() => {});
  } catch {}
  p.senders.screen = [tv];
  const at = V.screen.getAudioTracks()[0];
  if (at) p.senders.screen.push(p.pc.addTransceiver(at, { direction: "sendonly", streams: [V.screen] }));
  rebalance();
}
function removeScreenFrom(p) {
  for (const tv of p.senders.screen || []) {
    try { if (tv.stop) tv.stop(); else p.pc.removeTrack(tv.sender); } catch {}
  }
  delete p.senders.screen;
}
function rebalance() {
  if (!V.screen) return;
  const q = QUALITY[V.screenCfg.quality] || QUALITY["1080"], br = screenBitrate();
  for (const p of V.peers.values()) {
    const tv = p.senders.screen && p.senders.screen[0];
    if (!tv) continue;
    try {
      const prm = tv.sender.getParameters();
      if (!prm.encodings || !prm.encodings.length) continue;
      prm.encodings[0].maxBitrate = br;
      prm.encodings[0].maxFramerate = q.fps;
      tv.sender.setParameters(prm).catch(() => {});
    } catch {}
  }
}
async function startScreen(cfg) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast("Seu navegador não permite compartilhar a tela.", "error"); return; }
  if (!V.channelId) { toast("Entre em uma sala de voz para transmitir.", "warn"); return; }
  const q = QUALITY[cfg.quality] || QUALITY["1080"];
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: q.w, max: q.w }, height: { ideal: q.h, max: q.h }, frameRate: { ideal: q.fps, max: q.fps } },
      audio: cfg.audio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
      selfBrowserSurface: "exclude", surfaceSwitching: "include", systemAudio: cfg.audio ? "include" : "exclude"
    });
  } catch (e) {
    if (e.name !== "NotAllowedError" && e.name !== "AbortError") toast("Não foi possível compartilhar a tela.", "error");
    return;
  }
  if (!V.channelId) { stream.getTracks().forEach(t => t.stop()); return; }
  const vt = stream.getVideoTracks()[0];
  if ("contentHint" in vt) vt.contentHint = cfg.mode === "detail" ? "detail" : "motion";
  stream.getAudioTracks().forEach(t => { if ("contentHint" in t) t.contentHint = "music"; });
  vt.addEventListener("ended", () => stopScreen());
  if (V.screen) stopScreen(true);
  V.screen = stream;
  V.screenCfg = cfg;
  await emit("voice:update", { screen: stream.id });
  sfx("live");
  toast("Você está ao vivo! A transmissão só é enviada para quem assiste.", "ok", 4000);
  if (S.view !== "stage" || S.channelId !== V.channelId) openChannel(V.channelId, false);
  renderAll();
}
function stopScreen(silent) {
  if (!V.screen) return;
  for (const sock of [...V.granted.keys()]) endGrant(sock);
  for (const p of V.peers.values()) removeScreenFrom(p);
  V.screen.getTracks().forEach(t => t.stop());
  V.screen = null;
  V.viewers.clear();
  if (!silent) { emit("voice:update", { screen: null }); sfx("unlive"); renderAll(); }
}
async function applyScreenQuality() {
  const vt = V.screen && V.screen.getVideoTracks()[0];
  if (!vt) return;
  const q = QUALITY[V.screenCfg.quality] || QUALITY["1080"];
  if ("contentHint" in vt) vt.contentHint = V.screenCfg.mode === "detail" ? "detail" : "motion";
  try { await vt.applyConstraints({ width: { max: q.w }, height: { max: q.h }, frameRate: { max: q.fps } }); } catch {}
  for (const p of V.peers.values()) {
    const tv = p.senders.screen && p.senders.screen[0];
    if (!tv) continue;
    try { const prm = tv.sender.getParameters(); prm.degradationPreference = V.screenCfg.mode === "detail" ? "maintain-resolution" : "maintain-framerate"; await tv.sender.setParameters(prm); } catch {}
  }
  rebalance();
  toast(`Qualidade: ${q.label} · ${q.fps} FPS`, "ok");
  schedule("stage");
}
function watch(uid) {
  const st = S.voice.get(uid), p = peerByUser(uid);
  if (!st || !st.screen || !p) { toast("Ainda conectando com essa pessoa — tente de novo em instantes.", "warn"); return; }
  V.watching.add(uid);
  sig(p.sock, { watch: true });
  V.focus = uid + ":screen";
  schedule("stage");
}
function unwatch(uid) {
  if (V.controlling && V.controlling.uid === uid) stopControlling();
  V.watching.delete(uid);
  const p = peerByUser(uid);
  if (p) sig(p.sock, { unwatch: true });
  if (V.focus === uid + ":screen") V.focus = null;
  schedule("stage");
  updateMini();
}

/* --- câmera --- */
function addCamTo(p) {
  if (!V.cam || p.senders.cam) return;
  const t = V.cam.getVideoTracks()[0];
  if (!t) return;
  p.senders.cam = p.pc.addTransceiver(t, { direction: "sendonly", streams: [V.cam], sendEncodings: [{ maxBitrate: 600000, maxFramerate: 24 }] });
  preferCodec(p.senders.cam, ["video/H264", "video/VP8", "video/VP9"]);
}
async function toggleCam() {
  if (!V.channelId) { toast("Entre em uma sala de voz para ligar a câmera.", "warn"); return; }
  if (V.cam) { stopCam(); return; }
  try { V.cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } }, audio: false }); }
  catch { toast("Câmera indisponível.", "error"); return; }
  const t = V.cam.getVideoTracks()[0];
  if ("contentHint" in t) t.contentHint = "motion";
  t.addEventListener("ended", () => stopCam());
  await emit("voice:update", { cam: V.cam.id });
  for (const p of V.peers.values()) addCamTo(p);
  renderAll();
}
function stopCam(silent) {
  if (!V.cam) return;
  for (const p of V.peers.values()) if (p.senders.cam) { try { p.senders.cam.stop ? p.senders.cam.stop() : p.pc.removeTrack(p.senders.cam.sender); } catch {} delete p.senders.cam; }
  V.cam.getTracks().forEach(t => t.stop());
  V.cam = null;
  if (!silent) { emit("voice:update", { cam: null }); renderAll(); }
}

/* ------------------------------------------------------------------ */
/* Controle remoto e co-op pela tela                                   */
/* O vídeo vai pelo WebRTC; mouse/teclado/controle vão por um canal de */
/* dados direto entre os dois PCs. Quem transmite precisa do NEXORA    */
/* Agente aberto e aceitar o pedido — nada acontece sem permissão.     */
/* ------------------------------------------------------------------ */
const AG = { ws: null };
const agentOk = () => !!(AG.ws && AG.ws.readyState === 1);
// No app de PC o agente já vem embutido: o app abre ele sozinho, escondido.
async function agentConnect(code) {
  if (agentOk()) return;
  if (DESKTOP && DESKTOP.startAgent) {
    const c = await DESKTOP.startAgent();
    for (let i = 0; i < 16; i++) {
      try { await agentConnectRaw(c); return; } catch { await new Promise(r => setTimeout(r, 600)); }
    }
    throw new Error("Não foi possível iniciar o controle remoto do app.");
  }
  return agentConnectRaw(code || S.settings.agentCode);
}
function agentConnectRaw(code) {
  return new Promise((res, rej) => {
    if (agentOk()) return res();
    if (!code) return rej(new Error("Abra o NEXORA Agente e digite o código em Configurações › Controle remoto."));
    let ws;
    try { ws = new WebSocket(`ws://127.0.0.1:47800/?t=${encodeURIComponent(code)}`); }
    catch { return rej(new Error("O navegador bloqueou a conexão com o NEXORA Agente.")); }
    const t = setTimeout(() => { try { ws.close(); } catch {} rej(new Error("NEXORA Agente não respondeu. Ele está aberto?")); }, 4000);
    ws.onopen = () => { clearTimeout(t); AG.ws = ws; res(); renderCtrlBar(); };
    ws.onerror = () => { clearTimeout(t); rej(new Error("NEXORA Agente não encontrado ou código errado.")); };
    ws.onclose = () => {
      if (AG.ws !== ws) return;
      AG.ws = null;
      if (V.granted.size) { for (const sock of [...V.granted.keys()]) endGrant(sock); toast("O NEXORA Agente foi fechado — controle encerrado.", "warn"); }
    };
  });
}
const agentSend = line => { if (agentOk()) AG.ws.send(line); };

// KeyboardEvent.code -> [código virtual do Windows, tecla estendida]
const VK = (() => {
  const m = {
    Enter: [13], Escape: [27], Backspace: [8], Tab: [9], Space: [32], CapsLock: [20],
    ShiftLeft: [160], ShiftRight: [161], ControlLeft: [162], ControlRight: [163, 1], AltLeft: [164], AltRight: [165, 1],
    MetaLeft: [91, 1], MetaRight: [92, 1], ContextMenu: [93, 1],
    ArrowLeft: [37, 1], ArrowUp: [38, 1], ArrowRight: [39, 1], ArrowDown: [40, 1],
    Insert: [45, 1], Delete: [46, 1], Home: [36, 1], End: [35, 1], PageUp: [33, 1], PageDown: [34, 1],
    Minus: [189], Equal: [187], BracketLeft: [219], BracketRight: [221], Backslash: [220], Semicolon: [186], Quote: [222],
    Backquote: [192], Comma: [188], Period: [190], Slash: [191], IntlBackslash: [226], IntlRo: [193],
    NumpadAdd: [107], NumpadSubtract: [109], NumpadMultiply: [106], NumpadDivide: [111, 1], NumpadDecimal: [110], NumpadEnter: [13, 1], NumpadComma: [194],
    PrintScreen: [44, 1], ScrollLock: [145], Pause: [19], NumLock: [144, 1]
  };
  for (let i = 0; i < 26; i++) m["Key" + String.fromCharCode(65 + i)] = [65 + i];
  for (let i = 0; i < 10; i++) { m["Digit" + i] = [48 + i]; m["Numpad" + i] = [96 + i]; }
  for (let i = 1; i <= 12; i++) m["F" + i] = [111 + i];
  return m;
})();
const PAD_PRESETS = {
  wasd: { name: "WASD + Espaço", dir: [87, 83, 65, 68], btn: { 0: 32, 1: 69, 2: 81, 3: 82, 4: 160, 5: 162, 6: 70, 7: 71, 8: 9, 9: 27 } },
  setas: { name: "Setas + J K L", dir: [38, 40, 37, 39], btn: { 0: 75, 1: 76, 2: 74, 3: 73, 4: 85, 5: 79, 6: 89, 7: 80, 8: 8, 9: 13 } }
};
const EXT_VK = new Set([33, 34, 35, 36, 37, 38, 39, 40, 45, 46, 91, 92, 93, 163, 165]);

function setupDc(p, dc) {
  p.dc = dc;
  dc.onmessage = e => onRemoteInput(p, e.data);
  dc.onclose = () => { if (p.dc === dc) p.dc = null; };
}

/* --- lado de quem transmite --- */
function askControl(p) {
  const u = user(p.userId);
  if (!V.screen) { sig(p.sock, { ctrlDeny: "Essa pessoa não está transmitindo a tela agora." }); return; }
  if (V.granted.has(p.sock)) { sig(p.sock, { ctrlGrant: V.granted.get(p.sock).mode }); return; }
  const surface = (V.screen.getVideoTracks()[0]?.getSettings() || {}).displaySurface;
  sfx("mention");
  let mode = "coop", answered = false;
  modal({
    title: `${esc(u.username)} quer controlar`, sub: "Escolha o que essa pessoa pode fazer no seu PC.",
    body: `<div class="invite-card" style="--c:${esc(u.color)}">${avatar(u, 48)}<div><b>${esc(u.username)}</b><small>está assistindo sua transmissão</small></div></div>
      <label class="radio-card on">${ic("gamepad", "lg")}<span><b>Co-op (jogar junto)</b><small>Só teclado e controle — ideal para co-op local. Mouse bloqueado.</small></span><input type="radio" name="cm" value="coop" checked></label>
      <label class="radio-card">${ic("pointer", "lg")}<span><b>Controle total</b><small>Mouse e teclado, como AnyDesk.${surface && surface !== "monitor" ? " <b style='color:var(--yellow)'>Transmita a tela inteira para o mouse cair no lugar certo.</b>" : ""}</small></span><input type="radio" name="cm" value="full"></label>
      <div class="hint" style="margin:10px 0 0">${DESKTOP || agentOk() ? "✅ Controle remoto pronto." : "⚠️ O NEXORA Agente precisa estar aberto neste PC (Configurações › Controle remoto) — ou use o app de PC, que já vem com ele."} Você pode encerrar a qualquer momento.</div>
      <div class="modal-foot"><button class="btn ghost" data-no>Recusar</button><button class="btn primary" data-yes>Permitir</button></div>`,
    onMount(m, close) {
      m.addEventListener("change", e => { if (e.target.name === "cm") { mode = e.target.value; $$(".radio-card", m).forEach(r => r.classList.toggle("on", r.querySelector("input").checked)); } });
      m.querySelector("[data-no]").onclick = () => { answered = true; close(); sig(p.sock, { ctrlDeny: true }); };
      m.querySelector("[data-yes]").onclick = async () => {
        const b = m.querySelector("[data-yes]");
        b.classList.add("loading");
        try { await agentConnect(); }
        catch (err) {
          b.classList.remove("loading");
          toast(err.message, "error", 6000);
          return;
        }
        answered = true;
        close();
        if (!V.peers.has(p.sock) || !V.screen) return;
        V.granted.set(p.sock, { uid: p.userId, mode, alt: false });
        sig(p.sock, { ctrlGrant: mode });
        toast(`${u.username} agora pode ${mode === "full" ? "controlar seu PC" : "jogar com você"}.`, "ok");
        renderCtrlBar();
      };
    },
    onClose() { if (!answered) sig(p.sock, { ctrlDeny: true }); }
  });
}
function endGrant(sock, silent) {
  const g = V.granted.get(sock);
  if (!g) return;
  V.granted.delete(sock);
  agentSend("u 0\nu 1\nu 2");
  if (!silent) sig(sock, { ctrlEnd: true });
  renderCtrlBar();
}
function onRemoteInput(p, data) {
  const g = V.granted.get(p.sock);
  if (!g || !agentOk() || typeof data !== "string" || data.length > 2000) return;
  const out = [];
  for (const line of data.split("\n")) {
    const a = line.split(" ");
    if (a[0] === "m" && g.mode === "full") {
      const x = +a[1], y = +a[2];
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) out.push(`m ${x.toFixed(5)} ${y.toFixed(5)}`);
    } else if ((a[0] === "d" || a[0] === "u") && g.mode === "full") {
      const b = +a[1];
      if (b === 0 || b === 1 || b === 2) out.push(`${a[0]} ${b}`);
    } else if (a[0] === "w" && g.mode === "full") {
      const d = Math.round(clamp(+a[1] || 0, -1200, 1200));
      if (d) out.push(`w ${d}`);
    } else if (a[0] === "k") {
      const down = a[1] === "1", vk = Math.round(+a[2]);
      if (!(vk > 0 && vk < 255)) continue;
      if (vk === 164 || vk === 165) g.alt = down;
      if (g.mode !== "full" && (vk === 91 || vk === 92 || vk === 93)) continue;           // tecla Windows bloqueada no co-op
      if (g.mode !== "full" && vk === 115 && g.alt) continue;                              // Alt+F4 bloqueado no co-op
      out.push(`k ${down ? 1 : 0} ${vk} ${EXT_VK.has(vk) || a[3] === "1" ? 1 : 0}`);
    }
  }
  if (out.length) agentSend(out.join("\n"));
}

/* --- lado de quem controla --- */
function requestControl(uid) {
  const p = peerByUser(uid), st = S.voice.get(uid);
  if (!p || !st || !st.screen) { toast("Essa pessoa não está transmitindo.", "warn"); return; }
  if (!V.watching.has(uid)) watch(uid);
  sig(p.sock, { ctrlReq: true });
  toast(`Pedido enviado para ${user(uid).username}. Aguarde a resposta…`, "info");
}
function onGranted(p, mode) {
  V.controlling = { uid: p.userId, sock: p.sock, mode: mode === "full" ? "full" : "coop", kb: false, keys: new Set(), padKeys: new Set(), preset: store.get("padPreset", "wasd") };
  V.focus = p.userId + ":screen";
  sfx("live");
  toast(mode === "full" ? `Você está controlando o PC de ${user(p.userId).username}. Clique na transmissão para usar mouse e teclado.` : `Co-op liberado! Clique na transmissão e jogue com teclado ou controle.`, "ok", 6000);
  if (S.view !== "stage" && V.channelId) openChannel(V.channelId, false);
  schedule("stage");
  renderCtrlBar();
  padLoop();
}
function dcSend(line) {
  const c = V.controlling, p = c && V.peers.get(c.sock);
  if (p && p.dc && p.dc.readyState === "open") p.dc.send(line);
}
function stopControlling(silent, msg) {
  const c = V.controlling;
  if (!c) return;
  const ups = [...c.keys, ...c.padKeys].map(vk => `k 0 ${vk} 0`);
  if (ups.length) dcSend(ups.join("\n"));
  if (c.mode === "full") dcSend("u 0\nu 1\nu 2");
  if (!silent) { const p = V.peers.get(c.sock); if (p) sig(p.sock, { ctrlEnd: true }); }
  V.controlling = null;
  if (msg) toast(msg, "info");
  schedule("stage");
  renderCtrlBar();
}
function ctrlVideo() {
  const c = V.controlling;
  return c ? $(`#stageGrid .tile[data-key="${c.uid}:screen"] video`) : null;
}
function videoPoint(video, e) {
  const r = video.getBoundingClientRect(), vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sc = Math.min(r.width / vw, r.height / vh), w = vw * sc, h = vh * sc;
  const x = (e.clientX - (r.left + (r.width - w) / 2)) / w, y = (e.clientY - (r.top + (r.height - h) / 2)) / h;
  return x < 0 || y < 0 || x > 1 || y > 1 ? null : { x, y };
}
let pendingMove = null, moveRaf = 0;
function wireControlInput() {
  const grid = () => $("#stageGrid");
  const onTarget = e => { const v = ctrlVideo(); return v && (e.target === v || (e.target.closest && e.target.closest(".tile") === v.closest(".tile") && !e.target.closest("button"))) ? v : null; };
  document.addEventListener("pointermove", e => {
    const c = V.controlling;
    if (!c || c.mode !== "full") return;
    const v = onTarget(e); if (!v) return;
    const pt = videoPoint(v, e); if (!pt) return;
    pendingMove = pt;
    if (!moveRaf) moveRaf = requestAnimationFrame(() => { moveRaf = 0; if (pendingMove) dcSend(`m ${pendingMove.x.toFixed(5)} ${pendingMove.y.toFixed(5)}`); pendingMove = null; });
  }, { passive: true });
  document.addEventListener("pointerdown", e => {
    const c = V.controlling;
    if (!c) return;
    const v = onTarget(e);
    c.kb = !!v;
    v && v.closest(".tile").classList.add("kb");
    if (!v) { $$(".tile.kb").forEach(t => t.classList.remove("kb")); releaseKeys(); return; }
    if (c.mode !== "full") return;
    const pt = videoPoint(v, e);
    if (!pt) return;
    e.preventDefault();
    dcSend(`m ${pt.x.toFixed(5)} ${pt.y.toFixed(5)}\nd ${e.button === 2 ? 2 : e.button === 1 ? 1 : 0}`);
  }, true);
  document.addEventListener("pointerup", e => {
    const c = V.controlling;
    if (!c || c.mode !== "full" || !onTarget(e)) return;
    dcSend(`u ${e.button === 2 ? 2 : e.button === 1 ? 1 : 0}`);
  }, true);
  document.addEventListener("contextmenu", e => { if (V.controlling && onTarget(e)) e.preventDefault(); }, true);
  document.addEventListener("wheel", e => {
    const c = V.controlling;
    if (!c || c.mode !== "full" || !onTarget(e)) return;
    e.preventDefault();
    dcSend(`w ${-Math.sign(e.deltaY) * 120}`);
  }, { passive: false, capture: true });
  const key = down => e => {
    const c = V.controlling;
    if (!c || !c.kb) return;
    const k = VK[e.code];
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (down) c.keys.add(k[0]); else c.keys.delete(k[0]);
    dcSend(`k ${down ? 1 : 0} ${k[0]} ${k[1] ? 1 : 0}`);
  };
  window.addEventListener("keydown", key(true), true);
  window.addEventListener("keyup", key(false), true);
  window.addEventListener("blur", () => releaseKeys());
  void grid;
}
function releaseKeys() {
  const c = V.controlling;
  if (!c) return;
  c.kb = false;
  if (c.keys.size) dcSend([...c.keys].map(vk => `k 0 ${vk} 0`).join("\n"));
  c.keys.clear();
}
// Controle (gamepad) de quem controla -> teclas no PC de quem transmite
function padLoop(ref) {
  const c = V.controlling;
  if (!c || (ref && ref !== c) || (!ref && c.looping)) return;
  c.looping = true;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[0];
  if (gp) {
    const pr = PAD_PRESETS[c.preset] || PAD_PRESETS.wasd;
    const want = new Set();
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, b = i => gp.buttons[i] && gp.buttons[i].pressed;
    if (ay < -0.5 || b(12)) want.add(pr.dir[0]);
    if (ay > 0.5 || b(13)) want.add(pr.dir[1]);
    if (ax < -0.5 || b(14)) want.add(pr.dir[2]);
    if (ax > 0.5 || b(15)) want.add(pr.dir[3]);
    for (const [i, vk] of Object.entries(pr.btn)) if (b(+i)) want.add(vk);
    const lines = [];
    for (const vk of want) if (!c.padKeys.has(vk)) lines.push(`k 1 ${vk} ${EXT_VK.has(vk) ? 1 : 0}`);
    for (const vk of c.padKeys) if (!want.has(vk)) lines.push(`k 0 ${vk} ${EXT_VK.has(vk) ? 1 : 0}`);
    if (lines.length) dcSend(lines.join("\n"));
    c.padKeys = want;
    if (!c.padSeen) { c.padSeen = true; renderCtrlBar(); }
    requestAnimationFrame(() => padLoop(c));     // controle ligado: lê a cada quadro
  } else setTimeout(() => padLoop(c), 500);      // sem controle: verifica de vez em quando (economiza CPU)
}
function renderCtrlBar() {
  const el = $("#ctrlBar");
  const c = V.controlling;
  let h = "";
  for (const [sock, g] of V.granted) {
    h += `<div class="cb-row host">${ic(g.mode === "full" ? "pointer" : "gamepad", "sm")}<span><b>${esc(user(g.uid).username)}</b> ${g.mode === "full" ? "está controlando seu PC" : "está jogando com você (co-op)"}</span><button class="btn danger sm" data-act="ctrl-revoke" data-sock="${esc(sock)}">Encerrar</button></div>`;
  }
  if (c) {
    const pr = PAD_PRESETS[c.preset] || PAD_PRESETS.wasd;
    h += `<div class="cb-row">${ic(c.mode === "full" ? "pointer" : "gamepad", "sm")}<span>${c.mode === "full" ? "Controlando" : "Co-op com"} <b>${esc(user(c.uid).username)}</b> · clique na tela para usar o teclado${c.padSeen ? ` · 🎮 ${pr.name}` : ""}</span><button class="btn sm" data-act="pad-preset" data-tip="Teclas do controle">${ic("gamepad", "sm")}</button><button class="btn sm" data-act="ctrl-stop">Parar</button></div>`;
  }
  el.innerHTML = h;
  el.classList.toggle("hidden", !h);
}
function onVoiceState(st) {
  const prev = S.voice.get(st.userId);
  S.voice.set(st.userId, st);
  const me = S.me && st.userId === S.me.id;
  if (!me && V.channelId) {
    if (st.channelId === V.channelId && (!prev || prev.channelId !== st.channelId)) sfx("join");
    if (prev && prev.sock !== st.sock) { const p = V.peers.get(prev.sock); if (p) closePeer(p); }
  }
  if (prev && prev.screen && prev.screen !== st.screen && V.watching.has(st.userId)) {
    V.watching.delete(st.userId);
    if (st.screen) setTimeout(() => watch(st.userId), 400);
  }
  if (!me && prev && st.screen && !prev.screen && st.channelId === V.channelId) toast(`${user(st.userId).username} está ao vivo! Clique em Assistir na sala.`, "info", 3500);
  schedule("side", "stage", "members", "rail", "home", "top");
}
function onVoiceLeave({ sock, userId, channelId }) {
  const cur = S.voice.get(userId);
  if (cur && cur.sock === sock) S.voice.delete(userId);
  const p = V.peers.get(sock);
  if (p) closePeer(p);
  if (S.me && userId !== S.me.id) {
    V.watching.delete(userId);
    if (V.channelId && channelId === V.channelId) sfx("leave");
  }
  schedule("side", "stage", "members", "rail", "home", "top", "vpanel");
}

async function statsTick() {
  if (!V.channelId || document.hidden) return;
  const first = [...V.peers.values()].find(p => p.pc.connectionState === "connected");
  if (first) {
    try {
      const r = await first.pc.getStats();
      r.forEach(x => { if (x.type === "candidate-pair" && x.nominated && x.state === "succeeded" && x.currentRoundTripTime != null) V.ping = Math.round(x.currentRoundTripTime * 1000); });
      const el = $("#voicePanel [data-ping]");
      if (el) el.dataset.tip = `Latência: ${V.ping ?? "?"} ms`;
    } catch {}
  }
  if (S.view !== "stage") return;
  for (const tile of $$("#stageGrid .tile")) {
    const out = tile.querySelector("[data-stats]"), vid = tile.querySelector("video");
    if (!out) continue;
    if (!vid || !vid.srcObject) { out.textContent = ""; continue; }
    const uid = tile.dataset.key.split(":")[0];
    let fps = null;
    const track = vid.srcObject.getVideoTracks()[0];
    if (uid === S.me.id) { const st = track && track.getSettings(); fps = st && st.frameRate ? Math.round(st.frameRate) : null; }
    else {
      const p = peerByUser(uid);
      if (p && track) try { (await p.pc.getStats()).forEach(x => { if (x.type === "inbound-rtp" && x.kind === "video" && x.trackIdentifier === track.id && x.framesPerSecond) fps = Math.round(x.framesPerSecond); }); } catch {}
    }
    out.textContent = vid.videoHeight ? `${vid.videoHeight}p${fps ? " · " + fps + " FPS" : ""}` : "";
  }
}

/* --- palco (grade de participantes) --- */
function stageTiles(cid) {
  const people = [...S.voice.values()].filter(v => v.channelId === cid).sort((a, b) => a.at - b.at);
  const tiles = [];
  for (const v of people) {
    const mine = v.userId === S.me.id, p = mine ? null : peerByUser(v.userId);
    if (v.screen) {
      const watching = mine || V.watching.has(v.userId);
      const stream = mine ? V.screen : watching && p ? p.streams.get(v.screen) || null : null;
      tiles.push({ key: v.userId + ":screen", kind: "screen", v, stream, watching });
    }
    const cam = v.cam ? (mine ? V.cam : p ? p.streams.get(v.cam) || null : null) : null;
    tiles.push({ key: v.userId + ":user", kind: "user", v, stream: cam });
  }
  return tiles;
}
function updateTile(el, t) {
  const u = user(t.v.userId), mine = t.v.userId === S.me.id;
  const vt = t.stream && t.stream.getVideoTracks().find(x => x.readyState === "live");
  const hasVideo = !!vt;
  el.style.setProperty("--c", u.color);
  el.className = "tile" + (t.kind === "user" && hasVideo ? " cam" : "") + (mine && t.kind === "user" ? " mirror" : "") + (t.kind === "screen" && !hasVideo ? " screen-off" : "") + (V.focus === t.key ? " big" : "") + (t.kind === "user" && V.speaking.has(u.id) ? " speaking" : "");
  if (t.kind === "user") el.dataset.voiceUser = u.id; else delete el.dataset.voiceUser;
  let video = el.querySelector("video");
  if (hasVideo) {
    if (!video) { video = document.createElement("video"); video.autoplay = true; video.playsInline = true; video.muted = true; el.prepend(video); }
    if (video.srcObject !== t.stream) { video.srcObject = t.stream; video.play().catch(() => {}); }
  } else if (video) { video.srcObject = null; video.remove(); }
  const ctrl = t.kind === "screen" && V.controlling && V.controlling.uid === u.id;
  el.classList.toggle("controlling", !!ctrl);
  const sig = [t.kind, hasVideo, t.v.muted, t.v.deaf, u.username, u.avatar, u.color, t.watching, V.focus === t.key, ctrl && V.controlling.mode].join("|");
  if (el._sig === sig) return;
  el._sig = sig;
  for (const n of [...el.children]) if (n.tagName !== "VIDEO") n.remove();
  const btn = (act, icon, tip) => `<button data-act="${act}" data-uid="${u.id}" data-tip="${tip}">${ic(icon)}</button>`;
  let h = "";
  if (t.kind === "screen") {
    h += `<div class="tile-top"><b class="live-tag">AO VIVO</b><span class="tile-stats" data-stats></span></div>`;
    if (!hasVideo) {
      h += mine ? `<div class="tile-watch">${ic("monitor", "lg")}<b>Você está transmitindo</b><small>Ninguém recebe vídeo até clicar em Assistir</small></div>`
        : t.watching ? `<div class="tile-watch">${avatar(u, 56)}<b>Carregando transmissão…</b><button class="btn sm" data-act="unwatch" data-uid="${u.id}">Cancelar</button></div>`
        : `<div class="tile-watch">${avatar(u, 56)}<button class="btn primary sm" data-act="watch" data-uid="${u.id}">${ic("eye", "sm")}Assistir transmissão</button><small>A transmissão só é enviada quando você assiste</small></div>`;
    }
    h += `<div class="tile-name">${ic("monitor", "scr")}<span>${esc(u.username)}${mine ? " (você)" : ""}</span></div>`;
    if (ctrl) h += `<div class="tile-ctrl">${ic(V.controlling.mode === "full" ? "pointer" : "gamepad", "xs")}${V.controlling.mode === "full" ? "Controlando" : "Co-op"}</div>`;
    h += `<div class="tile-btns">${!mine && hasVideo ? (ctrl ? btn("ctrl-stop", "x", "Parar de controlar") : btn("ctrl-request", "gamepad", "Pedir controle / jogar junto")) : ""}${hasVideo ? btn("tile-focus", "focus", V.focus === t.key ? "Sair do foco" : "Focar") + btn("fullscreen", "maximize", "Tela cheia") : ""}${mine ? btn("share-stop", "stop", "Parar transmissão") : hasVideo ? btn("unwatch", "eyeOff", "Parar de assistir") : ""}</div>`;
  } else {
    if (!hasVideo) h += `<div class="tile-av">${avatar(u, 84)}</div>`;
    h += `<div class="tile-name">${t.v.deaf ? ic("headOff") : t.v.muted ? ic("micOff") : ""}<span>${esc(u.username)}${mine ? " (você)" : ""}</span></div>`;
    h += `<div class="tile-btns">${btn("tile-focus", "focus", V.focus === t.key ? "Sair do foco" : "Focar")}${hasVideo ? btn("fullscreen", "maximize", "Tela cheia") : ""}</div>`;
  }
  el.insertAdjacentHTML("beforeend", h);
}
function renderStage() {
  updateMini();
  if (S.view !== "stage") return;
  const root = $("#stageView"), c = chan();
  if (!c) return;
  if (V.channelId !== c.id) {
    const people = [...S.voice.values()].filter(v => v.channelId === c.id);
    const names = people.slice(0, 3).map(v => esc(user(v.userId).username)).join(", ");
    const full = people.length >= S.voiceLimit;
    root.innerHTML = `<div class="stage-empty">${people.length ? `<div class="faces">${people.slice(0, 6).map(v => avatar(user(v.userId), 56)).join("")}</div>` : `<div style="width:76px;height:76px;border-radius:50%;background:#1a1e30;display:grid;place-items:center">${ic("volume", "lg")}</div>`}<h2>${esc(c.name)}</h2><p>${people.length ? `${names}${people.length > 3 ? ` e mais ${people.length - 3}` : ""} ${people.length === 1 ? "está" : "estão"} na sala` : "Ninguém por aqui ainda. Que tal começar a conversa?"}</p><button class="btn green big" style="width:auto;padding:0 28px" data-act="join-voice" data-id="${c.id}" ${full || V.joining ? "disabled" : ""}>${V.joining ? "Conectando…" : full ? "Sala cheia" : "Entrar na sala"}</button></div>`;
    return;
  }
  if (!root.querySelector(".stage")) root.innerHTML = `<div class="stage"><div class="stage-grid" id="stageGrid"></div><div class="stage-bar" id="stageBar"></div></div>`;
  const grid = $("#stageGrid");
  const tiles = stageTiles(c.id);
  if (V.focus && V.focus !== "__act" && !tiles.some(t => t.key === V.focus)) V.focus = null;
  if (V.act && !V.focus) V.focus = "__act";
  if (!V.act && V.focus === "__act") V.focus = null;
  grid.classList.toggle("focus", !!V.focus);
  const existing = new Map($$(".tile", grid).map(el => [el.dataset.key, el]));
  existing.delete("__act");
  const els = tiles.map(t => {
    let el = existing.get(t.key);
    existing.delete(t.key);
    if (!el) { el = document.createElement("div"); el.dataset.key = t.key; el.tabIndex = 0; }
    updateTile(el, t);
    return el;
  });
  if (V.act) els.unshift(actElement());
  existing.forEach(el => { const v = el.querySelector("video"); if (v) v.srcObject = null; el.remove(); });
  let strip = grid.querySelector(":scope > .strip");
  if (V.focus) {
    if (!strip) { strip = document.createElement("div"); strip.className = "strip"; }
    const big = els.find(e => e.dataset.key === V.focus);
    if (grid.firstElementChild !== big) grid.prepend(big);
    const rest = els.filter(e => e !== big);
    rest.forEach((e, i) => { if (strip.children[i] !== e) strip.insertBefore(e, strip.children[i] || null); });
    if (strip.parentNode !== grid || grid.lastElementChild !== strip) grid.append(strip);
    strip.classList.toggle("hidden", !rest.length);
  } else {
    if (strip) { [...strip.children].forEach(e => grid.append(e)); strip.remove(); }
    els.forEach((e, i) => { if (grid.children[i] !== e) grid.insertBefore(e, grid.children[i] || null); });
  }
  const micOff = S.muted || S.deaf;
  $("#stageBar").innerHTML = `<button class="ctl${micOff ? " off" : ""}" data-act="mute" data-tip="${micOff ? "Ativar microfone" : "Silenciar"}">${ic(micOff ? "micOff" : "mic")}</button><button class="ctl${S.deaf ? " off" : ""}" data-act="deafen" data-tip="${S.deaf ? "Ativar áudio" : "Desativar áudio"}">${ic(S.deaf ? "headOff" : "headphones")}</button><button class="ctl${V.cam ? " on" : ""}" data-act="cam" data-tip="${V.cam ? "Desligar câmera" : "Ligar câmera"}">${ic(V.cam ? "camera" : "cameraOff")}</button><button class="ctl${V.screen ? " on" : ""}" data-act="share" data-tip="${V.screen ? "Opções da transmissão" : "Transmitir tela"}">${ic("monitorUp")}</button><span class="ctl-sep"></span><button class="ctl${V.act ? " on" : ""}" data-act="act-menu" data-tip="Atividades: música, lousa, jogos">${ic("rocket")}</button><button class="ctl" data-act="sound-menu" data-tip="Sons para todos">${ic("speaker")}</button><button class="ctl" data-act="react-menu" data-tip="Reações">${ic("smile")}</button><span class="ctl-sep"></span><button class="ctl red" data-act="voice-leave" data-tip="Desconectar">${ic("phoneOff")}</button>`;
}

/* ------------------------------------------------------------------ */
/* Atividades na call: Ouvir juntos (YouTube), Lousa, Jogo da velha,   */
/* sons para todos e reações voando na tela                            */
/* ------------------------------------------------------------------ */
const ACT_NAMES = { yt: "🎵 Ouvir juntos", board: "🎨 a Lousa", ttt: "❌⭕ Jogo da velha" };
const nowServer = () => Date.now() + (S.clockOff || 0);
function startActivity(type) {
  if (!V.channelId) { toast("Entre numa sala de voz primeiro.", "warn"); return; }
  emit("act:start", { type }).then(r => r.error && toast(r.error, "error"));
}
function actMenu(at) {
  menu(at, [
    { label: "Ouvir juntos (YouTube)", icon: "music", hint: "música e vídeo", run: () => startActivity("yt") },
    { label: "Lousa", icon: "brush", hint: "desenhar junto", run: () => startActivity("board") },
    { label: "Jogo da velha", icon: "grid3", hint: "2 jogadores", run: () => startActivity("ttt") },
    V.act && "-",
    V.act && { label: "Encerrar atividade", icon: "x", danger: true, run: () => emit("act:stop", {}) }
  ]);
}
function actElement() {
  const a = V.act;
  let el = V.actEl;
  if (!el || el._type !== a.type) {
    destroyAct();
    el = document.createElement("div");
    el.className = "tile act-panel";
    el.dataset.key = "__act";
    el._type = a.type;
    V.actEl = el;
    ({ yt: mountYT, board: mountBoard, ttt: mountTTT })[a.type](el);
  }
  el.classList.toggle("big", V.focus === "__act");
  return el;
}
function destroyAct() {
  if (!V.actEl) return;
  try { V.actEl._destroy && V.actEl._destroy(); } catch {}
  V.actEl.remove();
  V.actEl = null;
}
function onAct(a) {
  if (!V.channelId || a.channelId !== V.channelId) return;
  const prev = V.act && V.act.type;
  V.act = a.type ? a : null;
  if (!V.act) destroyAct();
  else if (V.actEl && V.actEl._type === a.type && V.actEl._update) V.actEl._update(a);
  if (a.type && a.type !== prev) { V.focus = "__act"; if (a.by !== S.me.id) toast(`${user(a.by).username} abriu ${ACT_NAMES[a.type]} na call!`, "info"); }
  schedule("stage");
}
const isLeader = () => { const ids = [...S.voice.values()].filter(v => v.channelId === V.channelId).map(v => v.userId).sort(); return ids[0] === S.me.id; };
const fmtSec = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/* --- Ouvir juntos (YouTube sincronizado) --- */
let ytApi = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApi) return ytApi;
  ytApi = new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch {} res(); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => { ytApi = null; rej(new Error("Não foi possível carregar o YouTube.")); };
    document.head.append(s);
  });
  return ytApi;
}
function ytId(url) {
  const s = String(url || "").trim();
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || s.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : "";
}
const ytPos = st => (st.pos || 0) + (st.playing ? (nowServer() - st.at) / 1000 : 0);
function mountYT(el) {
  el.innerHTML = `<div class="yt-wrap"><div class="yt-player"><div class="yt-frame"></div><div class="yt-empty">${ic("music", "lg")}<b>Ouvir juntos</b><small>Cole um link do YouTube aqui embaixo — música, clipe ou vídeo. Todo mundo na call ouve sincronizado.</small></div></div>
    <div class="yt-bar"><button class="icon-btn" data-yt="toggle" data-tip="Tocar / pausar">${ic("play")}</button><button class="icon-btn" data-yt="skip" data-tip="Próxima">${ic("skip")}</button><span class="yt-time">0:00</span><input type="range" class="yt-seek" min="0" max="100" value="0" step="0.5"><span class="yt-dur">0:00</span><span data-tip="Volume (só para você)" style="display:grid">${ic("volume", "sm")}</span><input type="range" class="yt-vol" min="0" max="100" value="${store.get("ytVol", 70)}"></div>
    <form class="yt-add"><input placeholder="Cole um link do YouTube para tocar ou pôr na fila…" spellcheck="false"><button class="btn sm primary">${ic("plus", "sm")}Adicionar</button></form>
    <div class="yt-queue"></div></div>`;
  let player = null, ready = false, lastVid = "", seeking = false;
  const st = () => (V.act && V.act.type === "yt" ? V.act.state : null);
  const push = s => emit("act:state", { state: s }).then(r => r.error && toast(r.error, "error"));
  const next = () => { const s = st(); if (!s) return; const q = (s.queue || []).slice(); const vid = q.shift() || ""; push({ ...s, vid, queue: q, playing: !!vid, pos: 0 }); };
  loadYT().then(() => {
    player = new YT.Player(el.querySelector(".yt-frame"), {
      width: "100%", height: "100%",
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, origin: location.origin },
      events: {
        onReady: () => { ready = true; player.setVolume(+el.querySelector(".yt-vol").value); sync(); },
        onStateChange: e => { if (e.data === 0 && isLeader()) next(); },
        onError: () => { toast("Esse vídeo não pode tocar fora do YouTube. Pulando…", "warn"); if (isLeader()) next(); }
      }
    });
  }).catch(e => toast(e.message, "error"));
  function sync() {
    const s = st();
    if (!s) return;
    el.querySelector(".yt-empty").classList.toggle("hidden", !!s.vid);
    el.querySelector('[data-yt="toggle"]').innerHTML = ic(s.playing ? "pause" : "play");
    const q = s.queue || [];
    el.querySelector(".yt-queue").innerHTML = q.length ? `<span class="label">Na fila — ${q.length}</span><div class="yt-qs">${q.map((v, i) => `<div class="yt-q"><img src="https://i.ytimg.com/vi/${esc(v)}/mqdefault.jpg" alt="" referrerpolicy="no-referrer"><button class="icon-btn" data-yt-del="${i}" data-tip="Tirar da fila">${ic("x", "xs")}</button></div>`).join("")}</div>` : "";
    if (!ready || !player) return;
    if (!s.vid) { if (lastVid) { player.stopVideo(); lastVid = ""; } return; }
    const want = ytPos(s);
    if (s.vid !== lastVid) {
      lastVid = s.vid;
      player.loadVideoById({ videoId: s.vid, startSeconds: want });
      if (!s.playing) setTimeout(() => player.pauseVideo(), 400);
      return;
    }
    if (Math.abs((player.getCurrentTime() || 0) - want) > 1.5) player.seekTo(want, true);
    const ps = player.getPlayerState();
    if (s.playing && ps !== 1 && ps !== 3) player.playVideo();
    if (!s.playing && ps === 1) player.pauseVideo();
  }
  const timer = setInterval(() => {
    if (!player || !ready) return;
    if (S.deaf) player.mute(); else player.unMute();
    const s = st();
    const dur = player.getDuration ? player.getDuration() || 0 : 0, cur = s && s.vid ? ytPos(s) : 0;
    const seek = el.querySelector(".yt-seek");
    if (!seeking) { seek.max = Math.max(1, dur); seek.value = Math.min(cur, dur || cur); }
    el.querySelector(".yt-time").textContent = fmtSec(cur);
    el.querySelector(".yt-dur").textContent = fmtSec(dur);
  }, 500);
  const drift = setInterval(sync, 4000);
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-yt]"), del = e.target.closest("[data-yt-del]");
    const s = st();
    if (!s) return;
    if (del) { const q = (s.queue || []).slice(); q.splice(+del.dataset.ytDel, 1); push({ ...s, pos: ytPos(s), queue: q }); return; }
    if (!b) return;
    if (b.dataset.yt === "toggle" && s.vid) push({ ...s, playing: !s.playing, pos: ytPos(s) });
    if (b.dataset.yt === "skip") next();
  });
  const seek = el.querySelector(".yt-seek");
  seek.addEventListener("input", () => { seeking = true; });
  seek.addEventListener("change", () => { seeking = false; const s = st(); if (s && s.vid) push({ ...s, pos: +seek.value }); });
  el.querySelector(".yt-vol").addEventListener("input", e => { store.set("ytVol", +e.target.value); if (player && ready) player.setVolume(+e.target.value); });
  el.querySelector(".yt-add").addEventListener("submit", e => {
    e.preventDefault();
    const inp = e.target.querySelector("input"), id = ytId(inp.value), s = st();
    if (!id) { toast("Cole um link válido do YouTube.", "warn"); return; }
    if (!s) return;
    inp.value = "";
    if (!s.vid) push({ ...s, vid: id, pos: 0, playing: true });
    else { push({ ...s, pos: ytPos(s), queue: [...(s.queue || []), id].slice(0, 50) }); toast("Adicionado à fila. 🎵", "ok"); }
  });
  el._update = () => sync();
  el._destroy = () => { clearInterval(timer); clearInterval(drift); try { if (player) player.destroy(); } catch {} };
}

/* --- Lousa para desenhar junto --- */
const BOARD_COLORS = ["#ffffff", "#f87171", "#fbbf24", "#34d399", "#22d3ee", "#7c5cff", "#f472b6", "#111111"];
const BOARD_BG = "#151826";
function mountBoard(el) {
  let color = store.get("boardColor", "#ffffff"), size = store.get("boardSize", 6), eraser = false;
  el.innerHTML = `<div class="board"><div class="board-area"><canvas width="1600" height="900"></canvas></div><div class="board-tools">${BOARD_COLORS.map(c => `<button class="bcol" style="--c:${c}" data-col="${c}" data-tip="Cor"></button>`).join("")}<input type="range" min="2" max="40" value="${size}" class="bsize" data-tip="Espessura"><button class="icon-btn" data-bt="eraser" data-tip="Borracha">${ic("x")}</button><span class="ctl-sep"></span><button class="btn sm" data-bt="clear">Limpar</button><button class="btn sm" data-bt="save">${ic("download", "sm")}Salvar</button></div></div>`;
  const cv = el.querySelector("canvas"), g = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const clear = () => { g.fillStyle = BOARD_BG; g.fillRect(0, 0, W, H); };
  const drawSeg = s => {
    const p = s.p;
    if (!p || p.length < 2) return;
    g.strokeStyle = s.e ? BOARD_BG : s.c;
    g.lineWidth = s.w * (W / 1000);
    g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath();
    g.moveTo(p[0] * W, p[1] * H);
    if (p.length === 2) g.lineTo(p[0] * W + 0.1, p[1] * H);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * W, p[i + 1] * H);
    g.stroke();
  };
  const tools = () => {
    $$(".bcol", el).forEach(b => b.classList.toggle("on", !eraser && b.dataset.col === color));
    el.querySelector('[data-bt="eraser"]').classList.toggle("on", eraser);
  };
  clear();
  for (const s of (V.act && V.act.strokes) || []) drawSeg(s);
  tools();
  let drawing = null, buf = [], last = null, flushT = 0;
  const pt = e => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const flush = () => {
    flushT = 0;
    if (buf.length < 2) return;
    const seg = { k: "seg", id: drawing, c: color, w: size, e: eraser, p: buf.map(v => Math.round(v * 10000) / 10000) };
    if (S.socket) S.socket.emit("act:ev", seg);
    buf = buf.slice(-2);
  };
  cv.addEventListener("pointerdown", e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    drawing = Math.random().toString(36).slice(2, 10);
    last = pt(e);
    buf = [...last];
    drawSeg({ c: color, w: size, e: eraser, p: buf });
  });
  cv.addEventListener("pointermove", e => {
    if (!drawing) return;
    const p = pt(e);
    drawSeg({ c: color, w: size, e: eraser, p: [...last, ...p] });
    last = p;
    buf.push(...p);
    if (buf.length > 380) flush();
    else if (!flushT) flushT = setTimeout(flush, 45);
  });
  const end = () => { if (!drawing) return; clearTimeout(flushT); flush(); drawing = null; buf = []; };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  el.addEventListener("click", e => {
    const c = e.target.closest("[data-col]");
    if (c) { color = c.dataset.col; eraser = false; store.set("boardColor", color); tools(); return; }
    const b = e.target.closest("[data-bt]");
    if (!b) return;
    if (b.dataset.bt === "eraser") { eraser = !eraser; tools(); }
    if (b.dataset.bt === "clear") { clear(); if (S.socket) S.socket.emit("act:ev", { k: "clear" }); }
    if (b.dataset.bt === "save") { const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = "lousa-nexora.png"; a.click(); }
  });
  el.querySelector(".bsize").addEventListener("input", e => { size = +e.target.value; store.set("boardSize", size); });
  el._onEv = ev => { if (ev.k === "clear") clear(); else drawSeg(ev); };
}

/* --- Jogo da velha --- */
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(b) {
  for (const [a, c, d] of TTT_LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { w: b[a], line: [a, c, d] };
  return b.every(Boolean) ? { w: "draw", line: [] } : null;
}
function mountTTT(el) {
  const st = () => (V.act && V.act.type === "ttt" ? V.act.state : null);
  const push = s => emit("act:state", { state: s }).then(r => r.error && toast(r.error, "error"));
  let lastWin = "";
  const draw = () => {
    const s = st();
    if (!s) return;
    const mine = s.x === S.me.id ? "X" : s.o === S.me.id ? "O" : "";
    const res = tttWinner(s.b);
    const who = m => (m === "X" ? s.x : s.o);
    const pl = m => who(m) ? `${avatar(user(who(m)), 26)}<b>${esc(user(who(m)).username)}</b>` : `<button class="btn sm" data-join="${m}">Jogar como ${m}</button>`;
    const status = res ? (res.w === "draw" ? "Deu velha! 🤝" : `${esc(user(who(res.w)).username || res.w)} venceu! 🏆`) : !s.x || !s.o ? "Esperando jogadores…" : `Vez de ${esc(user(who(s.turn)).username)} (${s.turn})`;
    el.innerHTML = `<div class="ttt"><div class="ttt-players"><div class="tp${s.turn === "X" && !res ? " on" : ""}"><span class="mark x">X</span>${pl("X")}<em>${s.score.X}</em></div><div class="tp${s.turn === "O" && !res ? " on" : ""}"><span class="mark o">O</span>${pl("O")}<em>${s.score.O}</em></div></div>
      <div class="ttt-board">${s.b.map((v, i) => `<button class="cell${v ? " " + v.toLowerCase() : ""}${res && res.line.includes(i) ? " win" : ""}" data-cell="${i}" ${v || res || mine !== s.turn || !s.x || !s.o ? "disabled" : ""}>${v}</button>`).join("")}</div>
      <div class="ttt-status">${status}</div>${res ? `<button class="btn primary sm" data-again>Nova rodada</button>` : ""}${mine ? `<button class="btn ghost sm" data-quit>Sair do jogo</button>` : ""}</div>`;
    const key = res ? res.w + s.b.join("") : "";
    if (res && key !== lastWin) { lastWin = key; if (res.w !== "draw" && who(res.w) === S.me.id) confetti(); sfx(res.w === "draw" ? "unlive" : "live"); }
  };
  el.addEventListener("click", e => {
    const s = st();
    if (!s) return;
    const j = e.target.closest("[data-join]");
    if (j) { const k = j.dataset.join.toLowerCase(); if (s.x === S.me.id || s.o === S.me.id) return; push({ ...s, [k]: S.me.id }); return; }
    const c = e.target.closest("[data-cell]");
    if (c) {
      const mine = s.x === S.me.id ? "X" : s.o === S.me.id ? "O" : "";
      const i = +c.dataset.cell;
      if (!mine || s.turn !== mine || !s.x || !s.o || s.b[i] || tttWinner(s.b)) return;
      const b = s.b.slice(); b[i] = mine;
      const res = tttWinner(b), score = { ...s.score };
      if (res && res.w !== "draw") score[res.w]++;
      push({ ...s, b, turn: mine === "X" ? "O" : "X", score });
      return;
    }
    if (e.target.closest("[data-again]")) push({ ...s, b: Array(9).fill(""), turn: tttWinner(s.b)?.w === "X" ? "O" : "X" });
    if (e.target.closest("[data-quit]")) push({ ...s, x: s.x === S.me.id ? "" : s.x, o: s.o === S.me.id ? "" : s.o, b: Array(9).fill(""), turn: "X" });
  });
  draw();
  el._update = draw;
}

/* --- sons para todos (gerados na hora, sem baixar nada) --- */
const SOUNDS = { buzina: "📯 Buzina", palmas: "👏 Palmas", tada: "🎉 Tadã", badum: "🥁 Ba-dum-tss", erro: "❌ Errou!", grilo: "🦗 Grilos", suspense: "😱 Suspense", vitoria: "🏆 Vitória", sino: "🔔 Sino", boing: "🤪 Boing" };
function synth() {
  sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
  if (sfxCtx.state === "suspended") sfxCtx.resume();
  clearTimeout(sfxIdle);
  sfxIdle = setTimeout(() => sfxCtx && sfxCtx.suspend(), 8000);
  return sfxCtx;
}
function playSound(k) {
  if (S.deaf || !SOUNDS[k]) return;
  const c = synth(), t0 = c.currentTime + 0.02, out = c.createGain();
  out.gain.value = 0.35;
  out.connect(c.destination);
  const tone = (f, t, d, type = "sine", v = 0.5, f2) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
  };
  const noise = (t, d, v = 0.5, fType = "highpass", freq = 1000) => {
    const len = Math.ceil(c.sampleRate * d), b = c.createBuffer(1, len, c.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = fType; f.frequency.value = freq;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(out); s.start(t);
  };
  switch (k) {
    case "buzina": for (const f of [415, 523, 622]) for (let i = 0; i < 3; i++) tone(f, t0 + i * 0.32, 0.28 + (i === 2 ? 0.5 : 0), "sawtooth", 0.18); break;
    case "palmas": for (let i = 0; i < 18; i++) noise(t0 + i * 0.07 + Math.random() * 0.04, 0.09, 0.6, "bandpass", 1400 + Math.random() * 800); break;
    case "tada": [523, 659, 784, 1047].forEach((f, i) => tone(f, t0 + i * 0.09, i === 3 ? 0.9 : 0.25, "triangle", 0.4)); break;
    case "badum": tone(150, t0, 0.25, "sine", 0.9, 50); noise(t0 + 0.28, 0.18, 0.5, "bandpass", 1800); tone(120, t0 + 0.28, 0.2, "sine", 0.6, 60); noise(t0 + 0.62, 1.1, 0.35, "highpass", 6000); break;
    case "erro": tone(300, t0, 0.25, "square", 0.25, 280); tone(220, t0 + 0.28, 0.5, "square", 0.25, 150); break;
    case "grilo": for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) tone(4200, t0 + i * 0.22 + j * 0.035, 0.03, "sine", 0.15); break;
    case "suspense": tone(220, t0, 1.6, "sawtooth", 0.25, 110); tone(233, t0, 1.6, "sawtooth", 0.2, 116); break;
    case "vitoria": [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.75], [659, 1.05], [784, 1.2]].forEach(([f, d], i) => tone(f, t0 + d, i === 6 ? 0.8 : 0.2, "square", 0.18)); break;
    case "sino": for (const [f, v] of [[880, 0.4], [1760, 0.15], [2640, 0.08]]) tone(f, t0, 1.8, "sine", v); break;
    case "boing": tone(180, t0, 0.5, "sine", 0.6, 600); tone(600, t0 + 0.5, 0.3, "sine", 0.4, 300); break;
  }
}
function sendSound(k) {
  playSound(k);
  if (S.socket) S.socket.emit("call:fx", { k: "sound", v: k });
  floatFx(SOUNDS[k].split(" ")[0], S.me.id);
}
function soundMenu(at) {
  popover(at, `<span class="label">Sons para todos da call</span><div class="sound-grid">${Object.entries(SOUNDS).map(([k, n]) => `<button data-snd="${k}">${n}</button>`).join("")}</div>`, "emoji-pop", el => {
    el.addEventListener("click", e => { const b = e.target.closest("[data-snd]"); if (b) sendSound(b.dataset.snd); });
  });
}
/* --- reações voando na tela --- */
const CALL_REACTS = ["😂", "❤️", "🔥", "👏", "😮", "😢", "🎉", "💀", "👀", "🤯", "🫡", "💯"];
function sendReaction(e) {
  floatFx(e, S.me.id);
  if (S.socket) S.socket.emit("call:fx", { k: "emoji", v: e });
}
function reactMenu(at) {
  popover(at, `<span class="label">Reagir na call</span><div class="emoji-row big">${CALL_REACTS.map(e => `<button data-e="${e}">${e}</button>`).join("")}</div>`, "emoji-pop", el => {
    el.addEventListener("click", ev => { const b = ev.target.closest("[data-e]"); if (b) sendReaction(b.dataset.e); });
  });
}
function floatFx(emoji, uid) {
  if (S.settings.reduceMotion) return;
  const layer = S.view === "stage" ? $("#stageView") : document.body;
  const el = document.createElement("div");
  el.className = "float-fx";
  el.style.left = (10 + Math.random() * 80) + "%";
  el.style.setProperty("--dx", (Math.random() * 80 - 40).toFixed(0) + "px");
  el.innerHTML = `<span>${esc(emoji)}</span><small>${esc(user(uid).username)}</small>`;
  layer.append(el);
  setTimeout(() => el.remove(), 3000);
}
function onCallFx({ k, v, userId }) {
  if (k === "sound") { playSound(v); floatFx((SOUNDS[v] || "🔊").split(" ")[0], userId); }
  else if (k === "emoji") floatFx(v, userId);
}

/* --- confete (comemorações) --- */
function confetti() {
  if (S.settings.reduceMotion) return;
  const cv = document.createElement("canvas");
  cv.className = "confetti";
  cv.width = innerWidth; cv.height = innerHeight;
  document.body.append(cv);
  const g = cv.getContext("2d"), cols = ["#7c5cff", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#f87171"];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 }));
  const t0 = performance.now();
  const step = t => {
    const el = t - t0;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, 1 - el / 2600);
      g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore();
    }
    if (el < 2600) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}
function updateMini() {
  const el = $("#miniPlayer");
  const uid = S.view !== "stage" && V.channelId ? [...V.watching][0] : null;
  const st = uid && S.voice.get(uid), p = uid && peerByUser(uid);
  const stream = st && st.screen && p ? p.streams.get(st.screen) : null;
  if (!stream || !stream.getVideoTracks().some(t => t.readyState === "live")) {
    if (!el.classList.contains("hidden")) { const v = el.querySelector("video"); if (v) v.srcObject = null; el.innerHTML = ""; el.classList.add("hidden"); }
    return;
  }
  if (el._uid !== uid || !el.querySelector("video")) {
    el._uid = uid;
    el.innerHTML = `<video autoplay playsinline muted></video><div class="mini-bar">${ic("monitor", "sm")}<span>${esc(user(uid).username)}</span><button data-act="mini-close" data-uid="${uid}" data-tip="Parar de assistir">${ic("x", "sm")}</button></div>`;
  }
  const v = el.querySelector("video");
  if (v.srcObject !== stream) { v.srcObject = stream; v.play().catch(() => {}); }
  el.classList.remove("hidden");
}

/* ------------------------------------------------------------------ */
/* Camadas: modal, menus, popovers, toasts, dicas                      */
/* ------------------------------------------------------------------ */
function modal({ title = "", sub = "", body = "", cls = "", onMount, onClose }) {
  closeMenus();
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${title ? `<header class="modal-head"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}<button class="icon-btn modal-x" type="button" data-close aria-label="Fechar">${ic("x")}</button></header>` : ""}<div class="modal-body">${body}</div></div>`;
  $("#layer").append(wrap);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add("out");
    setTimeout(() => wrap.remove(), 180);
    if (onClose) onClose();
  };
  wrap._close = close;
  wrap.addEventListener("mousedown", e => { if (e.target === wrap) close(); });
  wrap.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  const m = wrap.querySelector(".modal");
  if (onMount) onMount(m, close);
  requestAnimationFrame(() => { const f = m.querySelector("[autofocus], input:not([type=hidden]):not([readonly]), textarea"); if (f) f.focus(); });
  return close;
}
function confirmBox({ title, html, ok = "Confirmar", danger = true }) {
  return new Promise(res => {
    let done = false;
    modal({
      title: esc(title),
      body: `<div style="color:var(--text-2)">${html}</div><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(ok)}</button></div>`,
      onMount(m, close) { const b = m.querySelector("[data-ok]"); b.onclick = () => { done = true; close(); res(true); }; setTimeout(() => b.focus(), 50); },
      onClose() { if (!done) res(false); }
    });
  });
}
function closeMenus() { $$("body > .menu, body > .popover").forEach(e => e.remove()); const h = $("#sideHead"); if (h) h.classList.remove("open"); }
function closeTop() {
  const pops = $$("body > .menu, body > .popover");
  if (pops.length) { closeMenus(); return true; }
  const lb = $(".lightbox");
  if (lb) { lb.remove(); return true; }
  const layers = $$("#layer > *").filter(e => e._close && !e.classList.contains("out"));
  if (layers.length) { layers[layers.length - 1]._close(); return true; }
  return false;
}
function placeAt(el, x, y) {
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = clamp(x, 8, innerWidth - w - 8) + "px";
  el.style.top = (y + h > innerHeight - 8 ? Math.max(8, y - h) : y) + "px";
}
function placeNear(el, anchor) {
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let x = r.right + 8, y = r.top;
  if (x + w > innerWidth - 8) x = r.left - w - 8;
  if (x < 8) { x = clamp(r.left, 8, innerWidth - w - 8); y = r.bottom + 8; if (y + h > innerHeight - 8) y = r.top - h - 8; }
  el.style.left = x + "px";
  el.style.top = clamp(y, 8, innerHeight - h - 8) + "px";
}
function menu(at, items) {
  closeMenus();
  items = items.filter(Boolean);
  const el = document.createElement("div");
  el.className = "menu";
  el.innerHTML = items.map((it, i) => it === "-" ? "<hr>" : it.html ? `<div class="menu-custom" data-i="${i}">${it.html}</div>` : `<button type="button" data-i="${i}" class="${it.danger ? "danger" : ""}">${it.icon ? ic(it.icon) : ""}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ""}</button>`).join("");
  document.body.append(el);
  if (at instanceof Element) placeNear(el, at); else placeAt(el, at.x, at.y);
  el.addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    const it = items[+b.dataset.i];
    closeMenus();
    if (it && it.run) it.run(e);
  });
  items.forEach((it, i) => { if (it.mount) it.mount(el.querySelector(`[data-i="${i}"]`)); });
  return el;
}
function popover(anchor, html, cls, onMount) {
  closeMenus();
  const el = document.createElement("div");
  el.className = "popover " + cls;
  el.innerHTML = html;
  document.body.append(el);
  if (anchor instanceof Element) placeNear(el, anchor); else placeAt(el, anchor.x, anchor.y);
  const close = () => el.remove();
  if (onMount) onMount(el, close);
  return close;
}
function toast(text, type = "info", ms = 3200) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${ic(type === "error" ? "x" : type === "ok" ? "check" : type === "warn" ? "info" : "bell")}<span>${esc(text)}</span>`;
  $("#toasts").append(el);
  while ($("#toasts").children.length > 4) $("#toasts").firstElementChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, ms);
}
function emojiPicker(anchor, onPick) {
  const recent = store.get("recentEmoji", []).slice(0, 9);
  const b = e => `<button type="button" data-e="${e}">${e}</button>`;
  popover(anchor, `${recent.length ? `<span class="label">Recentes</span><div class="emoji-row">${recent.map(b).join("")}</div>` : ""}<span class="label" style="margin-top:8px">Emojis</span><div class="emoji-row">${EMOJIS.map(b).join("")}</div><small style="display:block;color:var(--dim);font-size:11.5px;margin-top:8px">Shift + clique para escolher vários</small>`, "emoji-pop", (el, close) => {
    el.addEventListener("click", e => {
      const t = e.target.closest("[data-e]");
      if (!t) return;
      const em = t.dataset.e;
      store.set("recentEmoji", [em, ...store.get("recentEmoji", []).filter(x => x !== em)].slice(0, 18));
      onPick(em);
      if (!e.shiftKey) close();
    });
  });
}
function profilePop(uid, anchor) {
  const u = user(uid), v = S.voice.get(uid), mine = S.me && uid === S.me.id, f = S.friends.get(uid);
  const steamId = /^\d{17}$/.test(u.steam || "") ? u.steam : "";
  const appid = u.game && /^\d+$/.test(u.game.appid || "") ? u.game.appid : "";
  const game = u.game ? `<div class="sec game-card"><span class="label">Jogando agora</span><div class="gc">${appid ? `<img src="https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_184x69.jpg" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="gi">${ic("gamepad")}</span>`}<b>${esc(u.game.name)}</b></div>${appid ? `<div class="gl"><a href="steam://run/${appid}">${ic("play", "xs")} Jogar também</a><a href="https://store.steampowered.com/app/${appid}" target="_blank" rel="noopener">Ver na loja</a></div>` : ""}</div>` : "";
  const steam = steamId ? `<div class="sec"><span class="label">Steam</span><div class="gl"><a href="https://steamcommunity.com/profiles/${steamId}" target="_blank" rel="noopener">${ic("steam", "xs")} Perfil Steam</a>${mine ? "" : `<a href="steam://friends/message/${steamId}">Conversar na Steam</a>`}</div></div>` : "";
  const acts = mine ? `<button class="btn sm" data-edit-profile>Editar perfil</button>`
    : `<button class="btn sm primary" data-dm>${ic("message", "sm")}Mensagem</button>${f === "friend" ? "" : f === "out" ? `<button class="btn sm" disabled>Pedido enviado</button>` : f === "in" ? `<button class="btn sm green" data-accept>Aceitar amizade</button>` : `<button class="btn sm" data-addf>${ic("userPlus", "sm")}Adicionar</button>`}${S.view === "chat" && !isDm(S.channelId) ? `<button class="btn sm ghost" data-mention>@</button>` : ""}`;
  popover(anchor, `<div class="pb" style="${bannerStyle(u)}"></div><div class="pc">${avatar(u, 76, true)}${badges(u)}<h3>${nameHTML(u)}${u.pron ? `<small class="pron">${esc(u.pron)}</small>` : ""}</h3><div class="status-line"><i class="dot st-${esc(u.status)}"></i>${STATUS[u.status] || ""}${f === "friend" ? " · Amigo" : ""}</div>${u.cs ? `<div class="cs-bubble">${csText(u)}</div>` : ""}${game}${u.about ? `<div class="sec"><span class="label">Sobre mim</span>${esc(u.about)}</div>` : ""}${steam}<div class="sec"><span class="label">No NEXORA desde</span>${u.created ? new Date(u.created).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>${v ? `<div class="sec"><span class="label">Em chamada</span><a data-go-voice="${v.channelId}" style="cursor:pointer">${esc(chan(v.channelId)?.name || "Sala de voz")}</a>${v.screen ? ' <b class="live-tag">AO VIVO</b>' : ""}</div>` : ""}<div class="sec" style="display:flex;gap:8px;flex-wrap:wrap">${acts}</div></div>`, "profile-pop" + (u.pfx ? " pfx-" + u.pfx : ""), (el, close) => {
    el.addEventListener("click", e => {
      if (e.target.closest("[data-mention]")) { close(); insertAtCaret(`@${u.username} `); }
      if (e.target.closest("[data-edit-profile]")) { close(); userSettings("account"); }
      if (e.target.closest("[data-dm]")) { close(); startDM(uid); }
      if (e.target.closest("[data-addf]")) { close(); addFriend(u.username); }
      if (e.target.closest("[data-accept]")) { close(); emit("friend:accept", { userId: uid }).then(r => r.error && toast(r.error, "error")); }
      const g = e.target.closest("[data-go-voice]");
      if (g) { close(); openChannel(g.dataset.goVoice); }
    });
  });
}
const tipEl = () => $("#tip");
let tipTarget = null;
function showTip(t) {
  const tip = tipEl();
  if (!t || !t.dataset.tip || matchMedia("(pointer: coarse)").matches) { tip.classList.remove("show"); return; }
  tip.textContent = t.dataset.tip;
  tip.classList.add("show");
  const r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x, y;
  if (t.closest(".rail")) { x = r.right + 12; y = r.top + r.height / 2 - h / 2; }
  else { x = r.left + r.width / 2 - w / 2; y = r.top - h - 8; if (y < 6) y = r.bottom + 8; }
  tip.style.left = clamp(x, 6, innerWidth - w - 6) + "px";
  tip.style.top = clamp(y, 6, innerHeight - h - 6) + "px";
}

/* ------------------------------------------------------------------ */
/* Imagens (avatar / ícone) — reduzidas no navegador antes de enviar   */
/* ------------------------------------------------------------------ */
async function resizeImage(file, size = 128) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem muito grande (máximo 15 MB).");
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const s = Math.min(bmp.width, bmp.height);
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  if (bmp.close) bmp.close();
  let url = c.toDataURL("image/webp", 0.86);
  if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", 0.86);
  if (url.length > 55000) url = c.toDataURL("image/jpeg", 0.6);
  return url;
}
function pickImage(cb) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif";
  inp.onchange = async () => { try { cb(await resizeImage(inp.files[0])); } catch (e) { toast(e.message || "Imagem inválida.", "error"); } };
  inp.click();
}
function iconMenu(anchor, onPick, allowClear = true) {
  popover(anchor, `<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn sm primary" data-img>${ic("image", "sm")}Enviar imagem</button>${allowClear ? `<button class="btn sm" data-clear>Usar iniciais</button>` : ""}</div><span class="label">Ou escolha um emoji</span><div class="emoji-row">${EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>`, "emoji-pop", (el, close) => {
    el.addEventListener("click", e => {
      if (e.target.closest("[data-img]")) { close(); pickImage(onPick); return; }
      if (e.target.closest("[data-clear]")) { close(); onPick(""); return; }
      const t = e.target.closest("[data-e]");
      if (t) { close(); onPick(t.dataset.e); }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Modais de servidor, convite e canal                                 */
/* ------------------------------------------------------------------ */
function addServerModal() {
  modal({
    title: "Adicionar um servidor", sub: "Crie seu próprio espaço ou entre em um que já existe.",
    body: `<button class="choice" data-c="create" style="--k:var(--accent)"><span class="qi">${ic("plus")}</span><span><b>Criar meu servidor</b><small>Para amigos, clã, estudos ou comunidade</small></span>${ic("chevron", "chev")}</button>
      <button class="choice" data-c="join" style="--k:#23d18b"><span class="qi">${ic("link")}</span><span><b>Entrar com convite</b><small>Cole um link ou código de convite</small></span>${ic("chevron", "chev")}</button>
      <button class="choice" data-c="discover" style="--k:#0ea5c6"><span class="qi">${ic("compass")}</span><span><b>Explorar comunidades</b><small>Encontre servidores públicos</small></span>${ic("chevron", "chev")}</button>`,
    onMount(m, close) {
      m.addEventListener("click", e => {
        const b = e.target.closest("[data-c]");
        if (!b) return;
        close();
        setTimeout(() => ({ create: createServerModal, join: () => joinModal(), discover: goDiscover })[b.dataset.c](), 120);
      });
    }
  });
}
function createServerModal() {
  const st = { icon: "🎉", color: pick(COLORS), template: "friends", isPublic: false };
  modal({
    title: "Crie seu servidor", sub: "Dê uma cara ao seu servidor. Dá para mudar tudo depois.", cls: "wide",
    body: `<div class="icon-pick"><div data-icon-prev></div><div style="flex:1"><label class="field" style="margin:0"><span>Nome do servidor</span><input id="sName" maxlength="40" value="Servidor de ${esc(S.me.username)}" autofocus></label></div></div>
      <span class="label">Modelo</span>
      <div class="qgrid" style="margin-top:8px">${Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="qopt${k === st.template ? " on" : ""}" data-tpl="${k}"><b>${t.icon} ${t.name}</b><small>${t.desc}</small></button>`).join("")}</div>
      <span class="label">Cor</span>
      <div class="swatches" style="margin:8px 0 18px">${COLORS.map(c => `<button type="button" class="swatch${c === st.color ? " on" : ""}" style="--c:${c}" data-color="${c}" aria-label="Cor ${c}"></button>`).join("")}</div>
      <label class="field"><span>Descrição (opcional)</span><input id="sDesc" maxlength="200" placeholder="Sobre o que é o seu servidor?"></label>
      <div class="toggle-row"><span><b>Servidor público</b><small>Aparece em Explorar e qualquer pessoa pode entrar</small></span><label class="switch"><input type="checkbox" id="sPublic"><i></i></label></div>
      <div class="modal-foot"><button class="btn ghost" data-back>Voltar</button><button class="btn primary" data-go>Criar servidor</button></div>`,
    onMount(m, close) {
      const prev = m.querySelector("[data-icon-prev]");
      const draw = () => { prev.innerHTML = serverIcon({ name: m.querySelector("#sName").value || "?", icon: st.icon, color: st.color }); };
      draw();
      m.querySelector("#sName").addEventListener("input", draw);
      prev.addEventListener("click", () => iconMenu(prev, v => { st.icon = v; draw(); }));
      m.addEventListener("click", e => {
        const tpl = e.target.closest("[data-tpl]");
        if (tpl) { st.template = tpl.dataset.tpl; $$("[data-tpl]", m).forEach(b => b.classList.toggle("on", b === tpl)); if (!IS_IMG(st.icon)) { st.icon = TEMPLATES[st.template].icon; draw(); } }
        const col = e.target.closest("[data-color]");
        if (col) { st.color = col.dataset.color; $$("[data-color]", m).forEach(b => b.classList.toggle("on", b === col)); draw(); }
        if (e.target.closest("[data-back]")) { close(); setTimeout(addServerModal, 120); }
      });
      const go = m.querySelector("[data-go]");
      const submit = async () => {
        const name = m.querySelector("#sName").value.trim();
        if (name.length < 2) { toast("Dê um nome com pelo menos 2 caracteres.", "warn"); return; }
        go.classList.add("loading");
        const r = await emit("server:create", { name, icon: st.icon, color: st.color, template: st.template, description: m.querySelector("#sDesc").value, isPublic: m.querySelector("#sPublic").checked });
        go.classList.remove("loading");
        if (r.error) { toast(r.error, "error"); return; }
        close();
        openServer(r.id);
        toast("Servidor criado! Chame a galera pelo botão de convite. 🎉", "ok", 4000);
        setTimeout(() => inviteModal(r.id), 600);
      };
      go.onclick = submit;
      m.querySelector("#sName").addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    }
  });
}
function joinModal(code = "") {
  modal({
    title: "Entrar em um servidor", sub: "Cole o convite abaixo para entrar em um servidor existente.",
    body: `<label class="field"><span>Link ou código do convite</span><input id="invCode" placeholder="${esc(location.host)}/convite/hTKzmak2" value="${esc(code)}" autocomplete="off" spellcheck="false"></label>
      <div id="invPrev"></div>
      <div class="hint">Os convites são assim: <span class="kbd">hTKzmak2</span> ou <span class="kbd">${esc(location.host)}/convite/hTKzmak2</span></div>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Entrar no servidor</button></div>`,
    onMount(m, close) {
      const inp = m.querySelector("#invCode"), prev = m.querySelector("#invPrev"), go = m.querySelector("[data-go]");
      let info = null;
      const look = async () => {
        const v = inp.value.trim();
        info = null;
        if (v.length < 4) { prev.innerHTML = ""; return; }
        const r = await emit("invite:info", { code: v });
        if (inp.value.trim() !== v) return;
        if (r.error) { prev.innerHTML = `<p style="color:var(--red);margin:-6px 0 12px;font-size:13.5px">${esc(r.error)}</p>`; return; }
        info = r;
        const s = r.server;
        prev.innerHTML = `<div class="invite-card" style="--c:${esc(s.color)}">${serverIcon(s)}<div style="min-width:0"><small style="display:block;margin-bottom:2px">${r.inviter ? `${esc(r.inviter)} convidou você para` : "Você foi convidado para"}</small><b>${esc(s.name)}</b><small><span><i class="dot st-online"></i> ${s.online} online</span><span><i class="dot st-offline"></i> ${s.members} membros</span></small></div></div>`;
        go.textContent = r.joined ? "Abrir servidor" : "Aceitar convite";
      };
      inp.addEventListener("input", debounce(look, 350));
      if (code) look();
      const submit = async () => {
        const v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        go.classList.add("loading");
        const r = await emit("invite:join", { code: v });
        go.classList.remove("loading");
        if (r.error) { toast(r.error, "error"); return; }
        close();
        openServer(r.serverId);
        if (!(info && info.joined)) toast(`Bem-vindo(a) a ${S.servers.get(r.serverId)?.name || "servidor"}! 🎉`, "ok");
      };
      go.onclick = submit;
      inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    }
  });
}
async function inviteModal(sid = S.serverId) {
  const s = S.servers.get(sid);
  if (!s) return;
  const r = await emit("invite:create", { serverId: sid });
  if (r.error) { toast(r.error, "error"); return; }
  const link = LOCAL ? r.code : `${location.origin}/convite/${r.code}`;
  const online = s.members.filter(id => user(id).status !== "offline").length;
  modal({
    title: `Convidar amigos para ${esc(s.name)}`, sub: "Quem abrir o link entra direto no servidor.",
    body: `<div class="invite-card" style="--c:${esc(s.color)}">${serverIcon(s)}<div><b>${esc(s.name)}</b><small><span><i class="dot st-online"></i> ${online} online</span><span><i class="dot st-offline"></i> ${s.members.length} membros</span></small></div></div>
      <span class="label">Link de convite</span>
      <div class="invite-box" style="margin-top:8px"><input readonly value="${esc(link)}"><button class="btn primary sm" type="button" data-copy>Copiar</button></div>
      <div class="hint" style="margin:10px 0 0">Código: <span class="kbd">${esc(r.code)}</span> · não expira · funciona na sua rede e na internet, se o NEXORA estiver acessível.</div>
      ${navigator.share ? `<button class="btn ghost" style="margin-top:12px" type="button" data-share>${ic("link", "sm")}Compartilhar…</button>` : ""}`,
    onMount(m) {
      const b = m.querySelector("[data-copy]"), inp = m.querySelector(".invite-box input");
      b.onclick = async () => {
        try { await navigator.clipboard.writeText(link); } catch { inp.select(); document.execCommand("copy"); }
        b.textContent = "Copiado!"; b.classList.add("green");
        setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("green"); }, 1800);
      };
      inp.addEventListener("focus", () => inp.select());
      const sh = m.querySelector("[data-share]");
      if (sh) sh.onclick = () => navigator.share({ title: `Entre no ${s.name} no NEXORA`, url: link }).catch(() => {});
    }
  });
}
function channelModal(type = "text", sid = S.serverId) {
  let t = type;
  modal({
    title: "Criar canal", sub: `em ${esc(S.servers.get(sid)?.name || "")}`,
    body: `<span class="label">Tipo de canal</span>
      <div style="margin:8px 0 16px">
        <label class="radio-card${t === "text" ? " on" : ""}">${ic("hash", "lg")}<span><b>Texto</b><small>Mensagens, imagens, opiniões e memes</small></span><input type="radio" name="ct" value="text" ${t === "text" ? "checked" : ""}></label>
        <label class="radio-card${t === "voice" ? " on" : ""}">${ic("volume", "lg")}<span><b>Voz</b><small>Conversem por voz, câmera e tela</small></span><input type="radio" name="ct" value="voice" ${t === "voice" ? "checked" : ""}></label>
      </div>
      <label class="field"><span>Nome do canal</span><input id="cName" maxlength="32" placeholder="${t === "text" ? "novo-canal" : "Nova sala"}" autofocus></label>
      <label class="field" data-topic ${t === "voice" ? 'style="display:none"' : ""}><span>Tópico (opcional)</span><input id="cTopic" maxlength="160" placeholder="Sobre o que se conversa aqui?"></label>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Criar canal</button></div>`,
    onMount(m, close) {
      m.addEventListener("change", e => {
        if (e.target.name !== "ct") return;
        t = e.target.value;
        $$(".radio-card", m).forEach(r => r.classList.toggle("on", r.querySelector("input").checked));
        m.querySelector("[data-topic]").style.display = t === "voice" ? "none" : "";
        m.querySelector("#cName").placeholder = t === "text" ? "novo-canal" : "Nova sala";
      });
      const go = m.querySelector("[data-go]");
      const submit = async () => {
        const name = m.querySelector("#cName").value.trim();
        if (!name) { m.querySelector("#cName").focus(); return; }
        go.classList.add("loading");
        const r = await emit("channel:create", { serverId: sid, name, type: t, topic: m.querySelector("#cTopic").value });
        go.classList.remove("loading");
        if (r.error) { toast(r.error, "error"); return; }
        close();
        if (t === "text") setTimeout(() => openChannel(r.id), 50);
      };
      go.onclick = submit;
      m.querySelector("#cName").addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    }
  });
}
function channelSettings(cid) {
  const c = chan(cid);
  if (!c) return;
  modal({
    title: "Editar canal", sub: `${c.type === "text" ? "#" : "🔊 "}${esc(c.name)}`,
    body: `<label class="field"><span>Nome</span><input id="eName" maxlength="32" value="${esc(c.name)}"></label>
      ${c.type === "text" ? `<label class="field"><span>Tópico</span><textarea id="eTopic" maxlength="160" placeholder="Explique para que serve o canal">${esc(c.topic || "")}</textarea></label>` : ""}
      <div class="danger-zone" style="margin-top:6px"><span><b>Excluir canal</b><small>${c.type === "text" ? "Todas as mensagens serão apagadas." : "Quem estiver na sala será desconectado."}</small></span><button class="btn danger sm" data-del>Excluir</button></div>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Salvar</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = async () => {
        const r = await emit("channel:update", { channelId: cid, name: m.querySelector("#eName").value, topic: m.querySelector("#eTopic")?.value });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast("Canal atualizado.", "ok");
      };
      m.querySelector("[data-del]").onclick = async () => {
        close();
        if (await confirmBox({ title: "Excluir canal", html: `Excluir <b>${esc(c.name)}</b>? Isso não pode ser desfeito.`, ok: "Excluir canal" })) {
          const r = await emit("channel:delete", { channelId: cid });
          if (r.error) toast(r.error, "error");
        }
      };
    }
  });
}
function switcher() {
  if ($(".switcher")) return;
  const items = [];
  for (const s of sortedServers()) {
    items.push({ kind: "server", id: s.id, name: s.name, sub: "servidor", s });
    for (const c of s.channels) items.push({ kind: c.type, id: c.id, name: c.name, sub: s.name, c });
  }
  let res = [], i = 0;
  modal({
    cls: "switcher",
    body: `<input class="input" id="swq" placeholder="Para onde você quer ir?" autocomplete="off" spellcheck="false"><div class="res" id="swr"></div><div class="hint" style="margin:12px 0 0">Use <span class="kbd">↑</span> <span class="kbd">↓</span> e <span class="kbd">Enter</span> · <span class="kbd">Ctrl</span>+<span class="kbd">K</span> abre de qualquer lugar</div>`,
    onMount(m, close) {
      const q = m.querySelector("#swq"), out = m.querySelector("#swr");
      const draw = () => {
        const t = q.value.trim().toLowerCase().replace(/^#/, "");
        res = items.map(it => {
          const n = it.name.toLowerCase();
          let score = !t ? 1 : n.startsWith(t) ? 3 : n.includes(t) ? 2 : it.sub.toLowerCase().includes(t) ? 1 : 0;
          if (score && it.c && isUnread(it.c)) score += 0.5;
          if (score && it.c && it.c.id === S.channelId) score -= 0.8;
          return { it, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12).map(x => x.it);
        i = clamp(i, 0, Math.max(0, res.length - 1));
        out.innerHTML = res.length ? res.map((it, k) => `<button type="button" class="${k === i ? "on" : ""}" data-k="${k}">${it.kind === "server" ? serverIcon(it.s, "mini") : ic(it.kind === "voice" ? "volume" : "hash", "sm")}<span>${esc(it.name)}</span><small>${esc(it.sub)}</small></button>`).join("") : `<p style="color:var(--muted);text-align:center">Nada encontrado.</p>`;
      };
      const go = k => { const it = res[k]; if (!it) return; close(); if (it.kind === "server") openServer(it.id); else openChannel(it.id); };
      q.addEventListener("input", () => { i = 0; draw(); });
      q.addEventListener("keydown", e => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); i = clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, res.length - 1); draw(); }
        if (e.key === "Enter") { e.preventDefault(); go(i); }
      });
      out.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) go(+b.dataset.k); });
      draw();
    }
  });
}
function shareModal() {
  const live = !!V.screen;
  let q = live ? V.screenCfg.quality : S.settings.shareQuality, mode = live ? V.screenCfg.mode : S.settings.shareMode;
  modal({
    title: live ? "Sua transmissão" : "Transmitir tela",
    sub: live ? "Ajuste a qualidade sem parar a transmissão." : "Escolha a qualidade e depois a janela, aba ou tela.",
    body: `<span class="label">Qualidade</span>
      <div class="qgrid" style="margin-top:8px">${Object.entries(QUALITY).map(([k, v]) => `<button type="button" class="qopt${k === q ? " on" : ""}" data-q="${k}">${v.tag ? `<span class="tag">${v.tag}</span>` : ""}<b>${v.label}</b><small>${v.sub}</small></button>`).join("")}</div>
      <span class="label">Otimizar para</span>
      <div style="margin:8px 0 6px">
        <label class="radio-card${mode === "detail" ? " on" : ""}">${ic("monitor")}<span><b>Texto e detalhes</b><small>Código, documentos e slides — prioriza nitidez</small></span><input type="radio" name="sm" value="detail" ${mode === "detail" ? "checked" : ""}></label>
        <label class="radio-card${mode === "motion" ? " on" : ""}">${ic("play")}<span><b>Movimento</b><small>Jogos e vídeos — prioriza fluidez</small></span><input type="radio" name="sm" value="motion" ${mode === "motion" ? "checked" : ""}></label>
      </div>
      ${live ? "" : `<div class="toggle-row" style="border:0"><span><b>Transmitir áudio</b><small>Som da aba ou do sistema, quando o navegador permitir</small></span><label class="switch"><input type="checkbox" id="shAudio" ${S.settings.shareAudio ? "checked" : ""}><i></i></label></div>`}
      <div class="hint" style="margin:6px 0 0">💡 O vídeo só é enviado para quem clicar em <b>Assistir</b> — economiza internet e processador.</div>
      <div class="modal-foot">${live ? `<button class="btn danger" data-stop>${ic("stop", "sm")}Parar transmissão</button>` : `<button class="btn ghost" data-close>Cancelar</button>`}<button class="btn primary" data-go>${live ? "Aplicar" : `${ic("monitorUp", "sm")}Ao vivo`}</button></div>`,
    onMount(m, close) {
      m.addEventListener("click", e => {
        const b = e.target.closest("[data-q]");
        if (b) { q = b.dataset.q; $$("[data-q]", m).forEach(x => x.classList.toggle("on", x === b)); }
      });
      m.addEventListener("change", e => {
        if (e.target.name === "sm") { mode = e.target.value; $$(".radio-card", m).forEach(r => r.classList.toggle("on", r.querySelector("input").checked)); }
      });
      const stop = m.querySelector("[data-stop]");
      if (stop) stop.onclick = () => { close(); stopScreen(); };
      m.querySelector("[data-go]").onclick = () => {
        const audio = live ? false : m.querySelector("#shAudio").checked;
        Object.assign(S.settings, { shareQuality: q, shareMode: mode }, live ? {} : { shareAudio: audio });
        saveSettings();
        close();
        if (live) { V.screenCfg = { ...V.screenCfg, quality: q, mode }; applyScreenQuality(); }
        else startScreen({ quality: q, mode, audio });
      };
    }
  });
}

/* ------------------------------------------------------------------ */
/* Configurações (tela cheia)                                          */
/* ------------------------------------------------------------------ */
function settingsShell(sections, initial) {
  closeMenus();
  const wrap = document.createElement("div");
  wrap.className = "settings-wrap";
  wrap.innerHTML = `<div class="settings-nav"><nav>${sections.map(s => s === "-" ? "<hr>" : s.label ? `<span class="label">${esc(s.label)}</span>` : `<button type="button" data-sec="${s.id}" class="${s.danger ? "danger" : ""}">${esc(s.name)}</button>`).join("")}</nav></div><div class="settings-main"></div><div class="settings-close"><button type="button" data-close aria-label="Fechar">${ic("x")}</button><small>ESC</small></div>`;
  $("#layer").append(wrap);
  const main = wrap.querySelector(".settings-main");
  let cleanup = null;
  const show = id => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    if (sec.action) { sec.action(close); return; }
    if (cleanup) { cleanup(); cleanup = null; }
    $$(".settings-nav button", wrap).forEach(b => b.classList.toggle("on", b.dataset.sec === id));
    main.innerHTML = `<div class="pane"><h2>${esc(sec.name)}</h2>${sec.render()}</div>`;
    main.scrollTop = 0;
    cleanup = sec.mount ? sec.mount(main.querySelector(".pane"), () => show(id)) || null : null;
  };
  function close() {
    if (cleanup) { cleanup(); cleanup = null; }
    wrap.classList.add("out");
    setTimeout(() => wrap.remove(), 200);
  }
  wrap._close = close;
  wrap.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) close();
    const b = e.target.closest("[data-sec]");
    if (b) show(b.dataset.sec);
  });
  show(initial || sections.find(s => s.id).id);
  return close;
}
const toggleRow = (id, title, sub, on) => `<div class="toggle-row"><span><b>${title}</b><small>${sub}</small></span><label class="switch"><input type="checkbox" data-set="${id}" ${on ? "checked" : ""}><i></i></label></div>`;
function saveSettings() { store.set("settings", S.settings); applySettings(); }
function applySettings() {
  const st = S.settings, root = document.documentElement;
  root.dataset.theme = st.theme;
  root.style.setProperty("--accent", st.accent);
  root.classList.toggle("reduce-motion", !!st.reduceMotion);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = st.theme === "light" ? "#e4e6ef" : st.theme === "midnight" ? "#000000" : "#0b0c14";
}
function userSettings(initial) {
  settingsShell([
    { label: "Configurações do usuário" },
    { id: "account", name: "Minha conta", render: renderAccount, mount: mountAccount },
    { id: "turbo", name: "⚡ Perfil Turbo", render: () => `<div id="turboRoot"></div>`, mount: mountTurbo },
    { id: "voice", name: "Voz e vídeo", render: renderVoiceSettings, mount: mountVoiceSettings },
    { id: "stream", name: "Transmissão", render: () => `<p style="color:var(--muted);margin-top:-8px">Padrão usado ao entrar ao vivo. Você pode mudar durante a transmissão.</p><span class="label">Qualidade padrão</span><div class="qgrid" style="margin-top:8px">${Object.entries(QUALITY).map(([k, v]) => `<button type="button" class="qopt${k === S.settings.shareQuality ? " on" : ""}" data-q="${k}">${v.tag ? `<span class="tag">${v.tag}</span>` : ""}<b>${v.label}</b><small>${v.sub}</small></button>`).join("")}</div>${toggleRow("shareAudio", "Transmitir áudio por padrão", "Inclui o som da aba ou do sistema", S.settings.shareAudio)}<div class="hint" style="margin-top:16px">Como o NEXORA economiza recursos: a tela só é codificada para quem está assistindo, a taxa de bits se divide entre os espectadores, o codec é escolhido pelo modo (VP9 para texto nítido, H.264 com aceleração por hardware para movimento) e o áudio usa Opus com supressão de silêncio.</div>`, mount: p => { p.addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) { S.settings.shareQuality = b.dataset.q; saveSettings(); $$("[data-q]", p).forEach(x => x.classList.toggle("on", x === b)); } }); bindToggles(p); } },
    { id: "app", name: "Baixar o app", render: renderAppDl, mount: mountAppDl },
    { id: "games", name: "Jogos e Steam", render: renderGames, mount: mountGames },
    { id: "remote", name: "Controle remoto", render: renderRemote, mount: mountRemote },
    { label: "Aplicativo" },
    { id: "look", name: "Aparência", render: renderLook, mount: mountLook },
    { id: "notif", name: "Notificações", render: () => toggleRow("sounds", "Sons do aplicativo", "Entrar/sair da sala, menções, mutar", S.settings.sounds) + toggleRow("notify", "Notificações na área de trabalho", "Avisa quando alguém menciona você", S.settings.notify && "Notification" in window && Notification.permission === "granted"), mount: p => bindToggles(p, async (k, v, inp) => { if (k === "notify" && v) { if (!("Notification" in window)) { inp.checked = false; S.settings.notify = false; saveSettings(); toast("Seu navegador não suporta notificações.", "warn"); return; } const perm = await Notification.requestPermission(); if (perm !== "granted") { inp.checked = false; S.settings.notify = false; saveSettings(); toast("Permissão de notificação negada.", "warn"); } } }) },
    { id: "keys", name: "Atalhos", render: () => [["Ctrl + K", "Ir para servidor ou canal"], ["Ctrl + Shift + M", "Silenciar / ativar microfone"], ["Ctrl + Shift + D", "Desativar / ativar áudio"], ["↑ (caixa vazia)", "Editar sua última mensagem"], ["Shift + Enter", "Nova linha"], ["Esc", "Fechar janela / cancelar resposta"], ["Shift + clique na lixeira", "Apagar sem confirmar"]].map(([k, d]) => `<div class="toggle-row"><span>${d}</span><span class="kbd">${k}</span></div>`).join("") },
    "-",
    { id: "logout", name: "Sair", danger: true, action: async close => { if (await confirmBox({ title: "Sair", html: "Tem certeza de que quer sair da sua conta?", ok: "Sair" })) { close(); logout(); } } }
  ], initial);
}
/* Perfil Turbo: tudo liberado, com prévia ao vivo */
function mountTurbo(p) {
  const me = S.me;
  const d = { avatar: me.avatar || "", banner: me.banner || "", theme: me.theme || [me.color || "#7c5cff", "#22d3ee"], useTheme: !!me.theme, pron: me.pron || "", cs: { e: (me.cs && me.cs.e) || "", t: (me.cs && me.cs.t) || "" }, fx: me.fx || "", pfx: me.pfx || "" };
  const root = p.querySelector("#turboRoot");
  const FX = [["", "Normal"], ["grad", "Degradê"], ["glow", "Brilho"], ["rainbow", "Arco-íris"]];
  const PFX = [["", "Nenhum"], ["aurora", "Aurora"], ["stars", "Estrelas"], ["fire", "Fogo"], ["neon", "Neon"]];
  const preview = () => {
    const u = { ...me, avatar: d.avatar, banner: d.banner, theme: d.useTheme ? d.theme : null, pron: d.pron, cs: d.cs.t || d.cs.e ? d.cs : null, fx: d.fx, pfx: d.pfx, status: me.statusPref === "invisible" ? "offline" : me.statusPref };
    return `<div class="popover profile-pop turbo-preview${d.pfx ? " pfx-" + d.pfx : ""}"><div class="pb" style="${bannerStyle(u)}"></div><div class="pc">${avatar(u, 76, true)}${badges(u)}<h3>${nameHTML(u)}${u.pron ? `<small class="pron">${esc(u.pron)}</small>` : ""}</h3><div class="status-line"><i class="dot st-${esc(u.status)}"></i>${STATUS[u.status] || ""}</div>${u.cs ? `<div class="cs-bubble">${csText(u)}</div>` : ""}${u.about ? `<div class="sec"><span class="label">Sobre mim</span>${esc(u.about)}</div>` : ""}</div></div>`;
  };
  const draw = () => {
    root.innerHTML = `<p style="color:var(--muted);margin-top:-8px">Deixe seu perfil com a sua cara. Tudo grátis. ✨</p>
      <div class="turbo">
        <div class="turbo-form">
          <span class="label">Avatar animado</span>
          <div class="row-btns"><button class="btn sm" data-up="avatar">${ic("image", "sm")}Enviar imagem ou GIF</button>${d.avatar ? `<button class="btn sm ghost" data-clear="avatar">Remover</button>` : ""}</div>
          <span class="label">Banner</span>
          <div class="row-btns"><button class="btn sm" data-up="banner">${ic("image", "sm")}Enviar banner</button>${d.banner ? `<button class="btn sm ghost" data-clear="banner">Remover</button>` : ""}</div>
          <div class="toggle-row"><span><b>Cores do perfil</b><small>Degradê usado no banner e no efeito do nome</small></span><label class="switch"><input type="checkbox" data-k="useTheme" ${d.useTheme ? "checked" : ""}><i></i></label></div>
          <div class="row-btns" ${d.useTheme ? "" : 'style="opacity:.4;pointer-events:none"'}><label class="color-in">Cor 1<input type="color" data-k="t0" value="${esc(d.theme[0])}"></label><label class="color-in">Cor 2<input type="color" data-k="t1" value="${esc(d.theme[1])}"></label></div>
          <span class="label">Efeito no nome</span>
          <div class="chips">${FX.map(([k, n]) => `<button class="chip${d.fx === k ? " on" : ""}" data-fx="${k}">${k ? `<span class="nm fx-${k}" style="--n1:${esc(d.theme[0])};--n2:${esc(d.theme[1])}">${n}</span>` : n}</button>`).join("")}</div>
          <span class="label">Efeito do perfil</span>
          <div class="chips">${PFX.map(([k, n]) => `<button class="chip${d.pfx === k ? " on" : ""}" data-pfx="${k}">${n}</button>`).join("")}</div>
          <label class="field" style="margin-top:14px"><span>Status personalizado</span><div class="cs-in"><button type="button" class="btn sm" data-cs-emoji>${d.cs.e ? esc(d.cs.e) : "😀"}</button><input data-k="cst" maxlength="60" placeholder="O que está rolando?" value="${esc(d.cs.t)}"></div></label>
          <label class="field"><span>Pronomes</span><input data-k="pron" maxlength="24" placeholder="ex.: ele/dele, ela/dela" value="${esc(d.pron)}"></label>
          <button class="btn primary" data-save>Salvar Perfil Turbo</button>
        </div>
        <div class="turbo-prev"><span class="label">Prévia</span>${preview()}</div>
      </div>`;
  };
  const refreshPrev = () => { const pv = root.querySelector(".turbo-prev"); if (pv) pv.innerHTML = `<span class="label">Prévia</span>${preview()}`; };
  draw();
  root.addEventListener("input", e => {
    const k = e.target.dataset.k;
    if (k === "t0" || k === "t1") d.theme[+k[1]] = e.target.value;
    else if (k === "cst") d.cs.t = e.target.value;
    else if (k === "pron") d.pron = e.target.value;
    else return;
    refreshPrev();
  });
  root.addEventListener("change", e => { if (e.target.dataset.k === "useTheme") { d.useTheme = e.target.checked; draw(); } });
  root.addEventListener("click", async e => {
    const t = e.target;
    const fx = t.closest("[data-fx]"); if (fx) { d.fx = fx.dataset.fx; draw(); return; }
    const pfx = t.closest("[data-pfx]"); if (pfx) { d.pfx = pfx.dataset.pfx; draw(); return; }
    const cl = t.closest("[data-clear]"); if (cl) { d[cl.dataset.clear] = ""; draw(); return; }
    const em = t.closest("[data-cs-emoji]"); if (em) { emojiPicker(em, v => { d.cs.e = v; draw(); }); return; }
    const up = t.closest("[data-up]");
    if (up) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif";
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        up.classList.add("loading");
        try { const r = await uploadBlob(f); d[up.dataset.up] = r.url; draw(); toast(f.type === "image/gif" ? "GIF enviado — seu avatar vai ficar animado! ✨" : "Imagem enviada.", "ok"); }
        catch (err) { toast(err.message, "error"); up.classList.remove("loading"); }
      };
      inp.click();
      return;
    }
    if (t.closest("[data-save]")) {
      const r = await emit("profile:update", { avatar: d.avatar, banner: d.banner, theme: d.useTheme ? d.theme : null, pron: d.pron, cs: d.cs, fx: d.fx, pfx: d.pfx });
      if (r.error) toast(r.error, "error"); else { toast("Perfil Turbo salvo! ⚡", "ok"); confetti(); }
    }
  });
}
function renderGames() {
  const me = S.me, steamId = me.steam || "";
  return `<p style="color:var(--muted);margin-top:-8px">Mostre para os amigos o que você está jogando. Eles podem abrir o mesmo jogo direto pelo seu perfil.</p>
    <div class="profile-card" style="--c:#1b2838"><div class="pb" style="background:linear-gradient(135deg,#1b2838,#2a475e)"></div><div class="pc"><span class="av" style="--c:#171a21;--s:72px">${ic("steam", "lg")}</span><div class="info"><b>Steam</b><small>${steamId ? `Conectada · <a href="https://steamcommunity.com/profiles/${esc(steamId)}" target="_blank" rel="noopener">ver perfil</a>` : "Não conectada"}</small></div></div></div>
    <label class="field"><span>Link do seu perfil Steam</span><input id="steamLink" placeholder="https://steamcommunity.com/profiles/7656119…" value="${steamId ? `https://steamcommunity.com/profiles/${esc(steamId)}` : ""}" spellcheck="false"></label>
    <div class="hint">${S.steamAuto ? "✅ O “Jogando agora” é atualizado sozinho a cada minuto. Seu perfil e os “Detalhes de jogo” na Steam precisam estar <b>públicos</b>." : "Para o “Jogando agora” automático, o dono do servidor precisa configurar a chave <b>STEAM_API_KEY</b> no Render. Enquanto isso, use o campo abaixo."}</div>
    <div style="display:flex;gap:10px;margin-bottom:22px"><button class="btn primary" data-save-steam>Conectar Steam</button>${steamId ? `<button class="btn ghost" data-clear-steam>Desconectar</button>` : ""}</div>
    <label class="field"><span>Jogando agora (manual)</span><input id="gameName" maxlength="64" placeholder="Ex.: Minecraft, Stardew Valley…" value="${esc(me.game && !me.game.steam ? me.game.name : "")}"></label>
    <div style="display:flex;gap:10px"><button class="btn" data-save-game>Mostrar</button><button class="btn ghost" data-clear-game>Limpar</button></div>`;
}
function mountGames(p, rerender) {
  const upd = async (data, ok) => { const r = await emit("profile:update", data); if (r.error) { toast(r.error, "error", 6000); return; } if (ok) toast(ok, "ok"); setTimeout(rerender, 120); };
  p.addEventListener("click", e => {
    if (e.target.closest("[data-save-steam]")) { const v = p.querySelector("#steamLink").value.trim(); if (v) upd({ steam: v }, "Steam conectada!"); }
    if (e.target.closest("[data-clear-steam]")) upd({ steam: "" }, "Steam desconectada.");
    if (e.target.closest("[data-save-game]")) upd({ game: p.querySelector("#gameName").value }, "Atualizado.");
    if (e.target.closest("[data-clear-game]")) upd({ game: "" });
  });
}
async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const r = await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    if (r && r.outcome === "accepted") toast("NEXORA instalado! 🎉", "ok");
    return true;
  }
  return false;
}
function renderAppDl() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent), android = /Android/i.test(navigator.userAgent);
  const pwaState = DESKTOP ? "Você já está usando o app de PC. 😎" : isStandalone() ? "✅ O NEXORA já está instalado neste aparelho." : installPrompt ? "" : ios ? "No iPhone/iPad: toque em <b>Compartilhar</b> ⬆️ e depois em <b>Adicionar à Tela de Início</b>." : android ? "No Android: toque no menu ⋮ do Chrome e em <b>Instalar app</b>." : "No Chrome ou Edge: clique no ícone de instalar ⊕ na barra de endereço (ou menu ⋮ › <b>Instalar NEXORA</b>).";
  return `<p style="color:var(--muted);margin-top:-8px">Use o NEXORA como um app de verdade: janela própria, ícone na área de trabalho e notificações.</p>
    <div class="steps">
      <div class="step"><b>${ic("monitor", "sm")}</b><div><b>App para Windows</b><small>Programa completo: seletor de tela próprio, fica na bandeja e já vem com o controle remoto embutido (não precisa do NEXORA Agente).</small>${DESKTOP ? `<small style="color:var(--green)">✅ Instalado — você está nele agora.</small>` : `<a class="btn primary sm" href="${DESKTOP_URL}" target="_blank" rel="noopener">${ic("arrowDown", "sm")}Baixar NEXORA-Setup.exe</a><small>Se o Windows avisar "O Windows protegeu o computador", clique em <b>Mais informações › Executar assim mesmo</b>.</small>`}</div></div>
      <div class="step"><b>${ic("users", "sm")}</b><div><b>Instalar pelo navegador (PC e celular)</b><small>Leve e sem baixar nada: vira um app com ícone, direto do site.</small>${installPrompt && !DESKTOP ? `<button class="btn primary sm" data-install>${ic("plus", "sm")}Instalar NEXORA</button>` : ""}${pwaState ? `<small>${pwaState}</small>` : ""}</div></div>
    </div>`;
}
function mountAppDl(p, rerender) {
  const b = p.querySelector("[data-install]");
  if (b) b.onclick = async () => { await installApp(); rerender(); };
}
function renderRemote() {
  const local = LOCAL || location.protocol === "file:";
  if (DESKTOP) return `<p style="color:var(--muted);margin-top:-8px">Deixe um amigo controlar seu PC (como AnyDesk) ou jogar com você em co-op local pela transmissão.</p>
    <div class="steps"><div class="step"><b>✓</b><div><b>Já está pronto!</b><small>O app de PC tem o controle remoto embutido. Quando alguém clicar em ${ic("gamepad", "xs")} <b>Pedir controle</b> na sua transmissão, é só escolher <b>Co-op</b> ou <b>Controle total</b>.</small><small>Para jogos que rodam como administrador, abra o NEXORA como administrador também.</small></div></div></div>`;
  return `<p style="color:var(--muted);margin-top:-8px">Deixe um amigo controlar seu PC (como AnyDesk) ou jogar com você em co-op local pela transmissão — como o Remote Play Together da Steam.</p>
    <div class="steps">
      <div class="step"><b>1</b><div><b>Baixe o NEXORA Agente</b><small>Um programinha do Windows que move o mouse e o teclado quando você permite. Não precisa instalar.</small>${local ? `<small style="color:var(--yellow)">Disponível na versão online do NEXORA.</small>` : `<a class="btn sm" href="/agente/NEXORA-Agente.zip" download>${ic("arrowDown", "sm")}Baixar NEXORA-Agente.zip</a>`}</div></div>
      <div class="step"><b>2</b><div><b>Abra o agente</b><small>Descompacte e dê dois cliques em <span class="kbd">NEXORA-Agente.bat</span>. Ele mostra um código de 6 números.</small></div></div>
      <div class="step"><b>3</b><div><b>Conecte aqui</b><div class="invite-box" style="margin-top:8px"><input id="agCode" inputmode="numeric" maxlength="6" placeholder="Código de 6 números" value="${esc(S.settings.agentCode || "")}"><button class="btn primary sm" data-ag>Conectar</button></div><small data-ag-status style="margin-top:6px;display:block">${agentOk() ? "✅ Agente conectado" : "Agente desconectado"}</small></div></div>
      <div class="step"><b>4</b><div><b>Transmita a tela e aceite</b><small>Quando alguém clicar em ${ic("gamepad", "xs")} <b>Pedir controle</b> na sua transmissão, você escolhe: <b>Co-op</b> (só teclado/controle) ou <b>Controle total</b> (mouse e teclado). Fechar a janela do agente corta tudo na hora.</small></div></div>
    </div>
    <div class="hint" style="margin-top:16px">Para jogar co-op: transmita no modo <b>Movimento</b> com <b>720p ou 1080p 60 FPS</b>. Quem joga pode usar teclado ou controle — o controle vira teclas (WASD ou setas) no seu PC.</div>`;
}
function mountRemote(p, rerender) {
  const btn = p.querySelector("[data-ag]");
  if (!btn) return;
  btn.onclick = async () => {
    const code = p.querySelector("#agCode").value.replace(/\D/g, "");
    if (code.length !== 6) { toast("O código tem 6 números.", "warn"); return; }
    S.settings.agentCode = code; saveSettings();
    if (AG.ws) { try { AG.ws.close(); } catch {} AG.ws = null; }
    try { await agentConnect(code); toast("NEXORA Agente conectado!", "ok"); rerender(); }
    catch (e) { toast(e.message, "error", 6000); }
  };
}
function bindToggles(p, extra) {
  p.addEventListener("change", e => {
    const k = e.target.dataset.set;
    if (!k) return;
    S.settings[k] = e.target.checked;
    saveSettings();
    if (extra) extra(k, e.target.checked, e.target);
  });
}
function renderAccount() {
  const me = S.me;
  return `<div class="profile-card" style="--c:${esc(me.color)}"><div class="pb"></div><div class="pc"><span data-pick-avatar data-tip="Trocar avatar">${avatar({ ...me, status: me.statusPref === "invisible" ? "offline" : me.statusPref }, 92, true)}</span><div class="info"><b>${esc(me.username)}</b><small>No NEXORA desde ${new Date(me.created).toLocaleDateString("pt-BR")}</small></div><button class="btn sm" data-pick-avatar>Alterar avatar</button></div></div>
    <span class="label">Cor do perfil</span>
    <div class="swatches" style="margin:8px 0 18px">${COLORS.map(c => `<button type="button" class="swatch${c === me.color ? " on" : ""}" style="--c:${c}" data-color="${c}"></button>`).join("")}</div>
    <span class="label">Status</span>
    <div class="qgrid" style="margin-top:8px">${["online", "idle", "dnd", "invisible"].map(s => `<button type="button" class="qopt${me.statusPref === s ? " on" : ""}" data-status="${s}"><b><i class="dot st-${s === "invisible" ? "offline" : s}"></i> ${STATUS[s]}</b><small>${{ online: "Todos veem que você está online", idle: "Você aparece como ausente", dnd: "Sem sons de menção", invisible: "Aparece offline, mas usa tudo" }[s]}</small></button>`).join("")}</div>
    <label class="field"><span>Sobre mim</span><textarea id="about" maxlength="190" placeholder="Conte algo sobre você">${esc(me.about || "")}</textarea></label>
    <button class="btn primary" data-save-about>Salvar</button>`;
}
function mountAccount(p, rerender) {
  const upd = async data => { const r = await emit("profile:update", data); if (r.error) toast(r.error, "error"); else setTimeout(rerender, 80); };
  p.addEventListener("click", e => {
    const av = e.target.closest("[data-pick-avatar]");
    if (av) iconMenu(av, v => upd({ avatar: v }));
    const col = e.target.closest("[data-color]");
    if (col) upd({ color: col.dataset.color });
    const st = e.target.closest("[data-status]");
    if (st) upd({ status: st.dataset.status });
    if (e.target.closest("[data-save-about]")) upd({ about: p.querySelector("#about").value }).then(() => toast("Perfil salvo.", "ok"));
  });
}
function renderVoiceSettings() {
  const st = S.settings;
  return `<label class="field"><span>Dispositivo de entrada</span><select id="inDev" class="input"><option value="">Padrão do sistema</option></select></label>
    ${"setSinkId" in HTMLMediaElement.prototype ? `<label class="field"><span>Dispositivo de saída</span><select id="outDev" class="input"><option value="">Padrão do sistema</option></select></label>` : ""}
    <span class="label">Sensibilidade de voz</span>
    <input type="range" id="sens" min="0.01" max="0.25" step="0.01" value="${st.sensitivity}" style="width:100%;accent-color:var(--accent);margin:10px 0 4px">
    <div class="meter"><i id="meterBar"></i></div>
    <button class="btn sm" data-test>${ic("mic", "sm")}Testar microfone</button> <button class="btn sm" data-listen>${ic("headphones", "sm")}Ouvir a mim mesmo</button>
    <span class="label" style="display:block;margin-top:22px">Supressão de ruído</span>
    <div style="margin:8px 0 6px">
      ${[["ai", "IA do NEXORA (recomendado)", "RNNoise: tira ventilador, teclado, cachorro, trânsito — deixa só a sua voz"], ["browser", "Padrão do navegador", "Mais leve, remove só ruído constante"], ["off", "Desligada", "Som cru do microfone (bom para música)"]].map(([k, t, d]) => `<label class="radio-card${nsMode() === k ? " on" : ""}"><span><b>${t}</b><small>${d}</small></span><input type="radio" name="nsm" value="${k}" ${nsMode() === k ? "checked" : ""}></label>`).join("")}
    </div>
    <div>
      ${toggleRow("nsGate", "Portão inteligente", "Com a IA ligada: silencia seu microfone quando você não está falando", st.nsGate !== false)}
      ${toggleRow("echo", "Cancelamento de eco", "Evita que os outros ouçam a própria voz", st.echo)}
      ${toggleRow("agc", "Ganho automático", "Mantém o volume da sua voz estável", st.agc)}
    </div>`;
}
function mountVoiceSettings(p) {
  let test = null, raf = 0, listen = false;
  const bar = p.querySelector("#meterBar");
  const fill = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const opt = (d, i, sel) => `<option value="${esc(d.deviceId)}" ${d.deviceId === sel ? "selected" : ""}>${esc(d.label || `Dispositivo ${i + 1}`)}</option>`;
      const ins = devs.filter(d => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications");
      const outs = devs.filter(d => d.kind === "audiooutput" && d.deviceId !== "default" && d.deviceId !== "communications");
      p.querySelector("#inDev").innerHTML = `<option value="">Padrão do sistema</option>` + ins.map((d, i) => opt(d, i, S.settings.inputId)).join("");
      const od = p.querySelector("#outDev");
      if (od) od.innerHTML = `<option value="">Padrão do sistema</option>` + outs.map((d, i) => opt(d, i, S.settings.outputId)).join("");
    } catch {}
  };
  fill();
  const stopTest = () => {
    cancelAnimationFrame(raf);
    if (test) { stopMic(test.stream); test.ctx.close(); test = null; }
    bar.style.transform = "scaleX(0)";
    const b = p.querySelector("[data-test]");
    if (b) b.innerHTML = `${ic("mic", "sm")}Testar microfone`;
  };
  const startTest = async () => {
    try {
      const stream = await getMic();
      const ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      const srcN = ctx.createMediaStreamSource(stream);
      srcN.connect(an);
      // "ouvir a mim mesmo": dá para escutar o efeito do filtro (use fone para não dar microfonia)
      const mon = ctx.createGain();
      mon.gain.value = listen ? 1 : 0;
      srcN.connect(mon).connect(ctx.destination);
      const buf = new Uint8Array(an.fftSize);
      test = { stream, ctx, mon };
      p.querySelector("[data-test]").innerHTML = `${ic("stop", "sm")}Parar teste`;
      fill();
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let pk = 0;
        for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i] - 128));
        const lv = pk / 128;
        bar.style.transform = `scaleX(${Math.min(1, lv * 2.2)})`;
        bar.style.opacity = lv > S.settings.sensitivity ? "1" : ".45";
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { toast("Não foi possível acessar o microfone.", "error"); }
  };
  p.querySelector("[data-test]").onclick = () => (test ? stopTest() : startTest());
  p.querySelector("[data-listen]").onclick = e => {
    listen = !listen;
    e.currentTarget.classList.toggle("on", listen);
    e.currentTarget.innerHTML = `${ic("headphones", "sm")}${listen ? "Parar de me ouvir" : "Ouvir a mim mesmo"}`;
    if (test && test.mon) test.mon.gain.value = listen ? 1 : 0;
    if (listen && !test) startTest();
  };
  p.addEventListener("change", e => {
    if (e.target.name !== "nsm") return;
    S.settings.nsMode = e.target.value;
    saveSettings();
    $$(".radio-card", p).forEach(r => r.classList.toggle("on", r.querySelector("input").checked));
    if (test) { stopTest(); startTest(); }
    refreshMic();
    if (e.target.value === "ai") toast("IA de ruído ligada. Faça um teste e ouça a diferença! 🎧", "ok");
  });
  p.querySelector("#sens").addEventListener("input", e => { S.settings.sensitivity = +e.target.value; saveSettings(); });
  p.querySelector("#inDev").addEventListener("change", e => { S.settings.inputId = e.target.value; saveSettings(); if (test) { stopTest(); startTest(); } refreshMic(); });
  const od = p.querySelector("#outDev");
  if (od) od.addEventListener("change", e => {
    S.settings.outputId = e.target.value; saveSettings();
    for (const pr of V.peers.values()) for (const a of pr.audios.values()) a.setSinkId(e.target.value || "").catch(() => {});
  });
  bindToggles(p, () => { if (test) { stopTest(); startTest(); } refreshMic(); });
  return stopTest;
}
function renderLook() {
  const st = S.settings;
  const th = [["dark", "Escuro", "linear-gradient(135deg,#0e1019 50%,#1a1e30 50%)"], ["midnight", "Meia-noite", "linear-gradient(135deg,#000 50%,#10121b 50%)"], ["light", "Claro", "linear-gradient(135deg,#f9fafc 50%,#dcdfea 50%)"]];
  const accents = ["#7c5cff", "#5b6cff", "#22a6ee", "#14b8a6", "#23d18b", "#f59e0b", "#f43f5e", "#ec4899"];
  return `<span class="label">Tema</span><div class="theme-opts" style="margin-top:8px">${th.map(([k, n, g]) => `<button type="button" class="theme-opt${st.theme === k ? " on" : ""}" data-theme-set="${k}"><i style="background:${g}"></i>${n}</button>`).join("")}</div>
    <span class="label">Cor de destaque</span><div class="swatches" style="margin:8px 0 18px">${accents.map(c => `<button type="button" class="swatch${st.accent === c ? " on" : ""}" style="--c:${c}" data-accent="${c}"></button>`).join("")}</div>
    ${toggleRow("reduceMotion", "Reduzir animações", "Deixa a interface mais estática e ainda mais leve", st.reduceMotion)}`;
}
function mountLook(p, rerender) {
  p.addEventListener("click", e => {
    const t = e.target.closest("[data-theme-set]");
    if (t) { S.settings.theme = t.dataset.themeSet; saveSettings(); rerender(); }
    const a = e.target.closest("[data-accent]");
    if (a) { S.settings.accent = a.dataset.accent; saveSettings(); rerender(); }
  });
  bindToggles(p);
}
function serverSettings(sid, initial) {
  const s = S.servers.get(sid);
  if (!s || !isOwner(s)) return;
  const st = { icon: s.icon, color: s.color };
  settingsShell([
    { label: s.name },
    {
      id: "overview", name: "Visão geral",
      render: () => `<div class="icon-pick"><div data-icon-prev data-tip="Trocar ícone"></div><div style="flex:1"><label class="field" style="margin:0"><span>Nome do servidor</span><input id="ssName" maxlength="40" value="${esc(s.name)}"></label></div></div>
        <span class="label">Cor</span><div class="swatches" style="margin:8px 0 18px">${COLORS.map(c => `<button type="button" class="swatch${c === st.color ? " on" : ""}" style="--c:${c}" data-color="${c}"></button>`).join("")}</div>
        <label class="field"><span>Descrição</span><textarea id="ssDesc" maxlength="200" placeholder="Conte do que se trata o servidor">${esc(s.description || "")}</textarea></label>
        <div class="toggle-row"><span><b>Servidor público</b><small>Aparece em Explorar e qualquer pessoa pode entrar</small></span><label class="switch"><input type="checkbox" id="ssPublic" ${s.public ? "checked" : ""}><i></i></label></div>
        <div style="margin-top:18px;display:flex;gap:10px"><button class="btn primary" data-save>Salvar alterações</button><button class="btn" data-invite>${ic("userPlus", "sm")}Convidar pessoas</button></div>`,
      mount(p) {
        const prev = p.querySelector("[data-icon-prev]");
        const draw = () => { prev.innerHTML = serverIcon({ name: p.querySelector("#ssName").value || s.name, icon: st.icon, color: st.color }); };
        draw();
        p.querySelector("#ssName").addEventListener("input", draw);
        prev.addEventListener("click", () => iconMenu(prev, v => { st.icon = v; draw(); }));
        p.addEventListener("click", async e => {
          const col = e.target.closest("[data-color]");
          if (col) { st.color = col.dataset.color; $$("[data-color]", p).forEach(b => b.classList.toggle("on", b === col)); draw(); }
          if (e.target.closest("[data-invite]")) inviteModal(sid);
          if (e.target.closest("[data-save]")) {
            const r = await emit("server:update", { serverId: sid, name: p.querySelector("#ssName").value, icon: st.icon, color: st.color, description: p.querySelector("#ssDesc").value, isPublic: p.querySelector("#ssPublic").checked });
            if (r.error) toast(r.error, "error"); else toast("Servidor atualizado.", "ok");
          }
        });
      }
    },
    {
      id: "members", name: "Membros",
      render: () => `<p style="color:var(--muted);margin-top:-8px">${s.members.length} ${s.members.length === 1 ? "membro" : "membros"}</p>` + s.members.map(user).sort((a, b) => a.username.localeCompare(b.username)).map(u => `<div class="member-row">${avatar(u, 36, true)}<div class="who"><b>${esc(u.username)}</b>${u.id === s.ownerId ? `<small>${ic("crown", "xs")} Dono</small>` : `<small>${STATUS[u.status]}</small>`}</div>${u.id !== s.ownerId ? `<button class="btn sm ghost" data-transfer="${u.id}">Tornar dono</button><button class="btn sm danger" data-kick="${u.id}">Expulsar</button>` : ""}</div>`).join(""),
      mount(p, rerender) {
        p.addEventListener("click", async e => {
          const k = e.target.closest("[data-kick]"), t = e.target.closest("[data-transfer]");
          if (k) {
            const u = user(k.dataset.kick);
            if (await confirmBox({ title: "Expulsar membro", html: `Expulsar <b>${esc(u.username)}</b> de ${esc(s.name)}? A pessoa pode voltar com um novo convite.`, ok: "Expulsar" })) {
              const r = await emit("server:kick", { serverId: sid, userId: u.id });
              if (r.error) toast(r.error, "error"); else { toast(`${u.username} foi expulso(a).`, "ok"); setTimeout(rerender, 100); }
            }
          }
          if (t) {
            const u = user(t.dataset.transfer);
            if (await confirmBox({ title: "Transferir posse", html: `Tornar <b>${esc(u.username)}</b> dono(a) de ${esc(s.name)}? Você perderá as permissões de dono.`, ok: "Transferir" })) {
              const r = await emit("server:transfer", { serverId: sid, userId: u.id });
              if (r.error) toast(r.error, "error"); else { toast("Posse transferida.", "ok"); closeTop(); }
            }
          }
        });
      }
    },
    "-",
    {
      id: "delete", name: "Excluir servidor", danger: true,
      action: async close => {
        if (await confirmBox({ title: `Excluir "${s.name}"`, html: `Todos os canais e mensagens serão apagados para sempre. Isso não pode ser desfeito.`, ok: "Excluir servidor" })) {
          const r = await emit("server:delete", { serverId: sid });
          if (r.error) toast(r.error, "error"); else close();
        }
      }
    }
  ], initial);
}

/* ------------------------------------------------------------------ */
/* Menus de contexto                                                   */
/* ------------------------------------------------------------------ */
function serverMenu(sid, at) {
  const s = S.servers.get(sid);
  if (!s) return;
  const owner = isOwner(s);
  const anyUnread = s.channels.some(isUnread) || s.channels.some(c => S.mentions.has(c.id));
  menu(at, [
    { label: "Convidar pessoas", icon: "userPlus", run: () => inviteModal(sid) },
    owner && { label: "Configurações do servidor", icon: "settings", run: () => serverSettings(sid) },
    owner && { label: "Criar canal", icon: "plus", run: () => channelModal("text", sid) },
    anyUnread && { label: "Marcar como lido", icon: "check", run: () => s.channels.forEach(c => markRead(c.id)) },
    "-",
    owner ? { label: "Excluir servidor", icon: "trash", danger: true, run: () => serverSettings(sid, "delete") }
      : { label: "Sair do servidor", icon: "logout", danger: true, run: async () => { if (await confirmBox({ title: `Sair de "${s.name}"`, html: "Você só poderá voltar com um novo convite.", ok: "Sair do servidor" })) { const r = await emit("server:leave", { serverId: sid }); if (r.error) toast(r.error, "error"); } } }
  ]);
}
function channelMenu(cid, at) {
  const c = chan(cid), s = serverOf(cid);
  if (!c) return;
  const owner = isOwner(s);
  menu(at, [
    c.type === "text" && isUnread(c) && { label: "Marcar como lido", icon: "check", run: () => markRead(cid) },
    c.type === "voice" && V.channelId !== cid && { label: "Entrar na sala", icon: "volume", run: () => openChannel(cid) },
    c.type === "voice" && V.channelId === cid && { label: "Desconectar", icon: "phoneOff", run: leaveVoice },
    { label: "Convidar pessoas", icon: "userPlus", run: () => inviteModal(s.id) },
    owner && "-",
    owner && { label: "Editar canal", icon: "settings", run: () => channelSettings(cid) },
    owner && { label: "Mover para cima", icon: "arrowUp", run: () => emit("channel:move", { channelId: cid, dir: -1 }) },
    owner && { label: "Mover para baixo", icon: "arrowDown", run: () => emit("channel:move", { channelId: cid, dir: 1 }) },
    owner && { label: "Excluir canal", icon: "trash", danger: true, run: () => channelSettings(cid) }
  ]);
}
function messageMenu(id, at) {
  const m = findMsg(id);
  if (!m || m.pending || m.sys) return;
  const mine = m.a === S.me.id, s = srv();
  menu(at, [
    { label: "Adicionar reação", icon: "smile", run: () => emojiPicker(at, e => react(id, e)) },
    { label: "Responder", icon: "reply", run: () => startReply(id) },
    mine && { label: "Editar mensagem", icon: "edit", run: () => startEdit(id) },
    { label: "Copiar texto", icon: "copy", run: () => navigator.clipboard.writeText(m.t).then(() => toast("Texto copiado.", "ok")).catch(() => {}) },
    (mine || isOwner(s)) && "-",
    (mine || isOwner(s)) && { label: "Apagar mensagem", icon: "trash", danger: true, run: e => deleteMsg(id, e && e.shiftKey) }
  ]);
}
function memberMenu(uid, at) {
  const u = user(uid), s = srv(), mine = uid === S.me.id;
  const inMyVoice = !mine && V.channelId && S.voice.get(uid)?.channelId === V.channelId;
  const vol = Math.round((S.volumes[uid] ?? 1) * 100);
  menu(at, [
    { label: "Perfil", icon: "users", run: () => profilePop(uid, at instanceof Element ? at : { x: at.x, y: at.y }) },
    !mine && { label: "Enviar mensagem", icon: "message", run: () => startDM(uid) },
    !mine && !S.friends.has(uid) && { label: "Adicionar amigo", icon: "userPlus", run: () => addFriend(u.username) },
    !mine && S.friends.get(uid) === "in" && { label: "Aceitar amizade", icon: "userCheck", run: () => emit("friend:accept", { userId: uid }) },
    S.view === "chat" && !isDm(S.channelId) && !mine && { label: "Mencionar", icon: "at", run: () => insertAtCaret(`@${u.username} `) },
    inMyVoice && S.voice.get(uid)?.screen && { label: V.controlling && V.controlling.uid === uid ? "Parar de controlar" : "Pedir controle / jogar junto", icon: "gamepad", run: () => (V.controlling && V.controlling.uid === uid ? stopControlling() : requestControl(uid)) },
    inMyVoice && "-",
    inMyVoice && { html: `<span class="label"><span>Volume</span><span data-v>${vol}%</span></span><input type="range" min="0" max="100" value="${vol}">`, mount: el => { const r = el.querySelector("input"), out = el.querySelector("[data-v]"); r.addEventListener("input", () => { S.volumes[uid] = r.value / 100; out.textContent = r.value + "%"; applyVolumes(); store.set("volumes", S.volumes); }); } },
    inMyVoice && { label: S.localMute[uid] ? "Reativar áudio dessa pessoa" : "Silenciar para mim", icon: S.localMute[uid] ? "volume" : "micOff", run: () => { S.localMute[uid] = !S.localMute[uid]; applyVolumes(); } },
    inMyVoice && S.voice.get(uid)?.screen && { label: V.watching.has(uid) ? "Parar de assistir" : "Assistir transmissão", icon: "eye", run: () => (V.watching.has(uid) ? unwatch(uid) : (openChannel(V.channelId, false), watch(uid))) },
    !mine && S.friends.get(uid) === "friend" && "-",
    !mine && S.friends.get(uid) === "friend" && { label: "Desfazer amizade", icon: "x", danger: true, run: async () => { if (await confirmBox({ title: "Desfazer amizade", html: `Remover <b>${esc(u.username)}</b> dos seus amigos?`, ok: "Remover" })) emit("friend:remove", { userId: uid }); } },
    isOwner(s) && !mine && s.members.includes(uid) && "-",
    isOwner(s) && !mine && s.members.includes(uid) && { label: `Expulsar ${u.username}`, icon: "logout", danger: true, run: async () => { if (await confirmBox({ title: "Expulsar membro", html: `Expulsar <b>${esc(u.username)}</b> de ${esc(s.name)}?`, ok: "Expulsar" })) { const r = await emit("server:kick", { serverId: s.id, userId: uid }); if (r.error) toast(r.error, "error"); } } }
  ]);
}
function statusMenu(at) {
  const set = status => emit("profile:update", { status }).then(r => r.error && toast(r.error, "error"));
  menu(at, [
    ...["online", "idle", "dnd", "invisible"].map(s => ({ label: STATUS[s], icon: S.me.statusPref === s ? "check" : null, hint: "", run: () => set(s) })),
    "-",
    { label: "Editar perfil", icon: "edit", run: () => userSettings("account") },
    { label: "Copiar nome de usuário", icon: "copy", run: () => navigator.clipboard.writeText(S.me.username).then(() => toast("Copiado.", "ok")).catch(() => {}) }
  ]);
}

/* ------------------------------------------------------------------ */
/* Ações (delegação de cliques)                                        */
/* ------------------------------------------------------------------ */
const msgIdOf = a => a.closest(".msg")?.dataset.id;
const ACTIONS = {
  home: goHome,
  friends: () => goFriends(),
  "get-app": () => userSettings("app"),
  attach: () => $("#fileInput").click(),
  "new-group": () => groupModal(),
  "act-menu": a => actMenu(a),
  "sound-menu": a => soundMenu(a),
  "react-menu": a => reactMenu(a),
  "group-add": a => groupModal(a.dataset.id),
  "group-menu": a => groupMenu(a.dataset.id, a),
  "up-remove": a => removeUpload(a.dataset.key),
  "friends-tab": a => goFriends(a.dataset.tab),
  "new-dm": () => goFriends(S.friends.size ? "all" : "add"),
  "open-dm": a => openDM(a.dataset.id),
  "dm-user": a => startDM(a.dataset.uid),
  "add-friend": async a => { if (await addFriend(user(a.dataset.uid).username)) schedule("home", "top"); },
  "friend-accept": async a => { const r = await emit("friend:accept", { userId: a.dataset.uid }); if (r.error) toast(r.error, "error"); else toast(`Agora você e ${user(a.dataset.uid).username} são amigos! 🎉`, "ok"); },
  "friend-remove": a => emit("friend:remove", { userId: a.dataset.uid }).then(r => r.error && toast(r.error, "error")),
  "friend-more": a => memberMenu(a.dataset.uid, a),
  "ctrl-request": a => requestControl(a.dataset.uid),
  "ctrl-stop": () => stopControlling(false, "Você parou de controlar."),
  "ctrl-revoke": a => { const g = V.granted.get(a.dataset.sock); endGrant(a.dataset.sock); if (g) toast(`Controle de ${user(g.uid).username} encerrado.`, "ok"); },
  "pad-preset": a => menu(a, Object.entries(PAD_PRESETS).map(([k, p]) => ({ label: p.name, icon: V.controlling && V.controlling.preset === k ? "check" : null, run: () => { if (V.controlling) { V.controlling.preset = k; store.set("padPreset", k); renderCtrlBar(); } } }))),
  discover: goDiscover,
  "add-server": addServerModal,
  "create-server": createServerModal,
  "join-server": () => joinModal(),
  server: a => { openServer(a.dataset.id); if (innerWidth <= 760 && a.closest(".rail")) $("#app").classList.add("drawer"); },
  "discover-join": async a => {
    const r = await emit("discover:join", { serverId: a.dataset.id });
    if (r.error) { toast(r.error, "error"); return; }
    openServer(r.serverId);
    toast("Você entrou no servidor! 🎉", "ok");
  },
  "server-menu": a => { const r = a.getBoundingClientRect(); serverMenu(S.serverId, { x: r.left + 10, y: r.bottom + 6 }); a.classList.add("open"); },
  "open-ch": a => openChannel(a.dataset.id),
  "ch-settings": a => channelSettings(a.dataset.id),
  "new-channel": a => channelModal(a.dataset.type),
  "join-voice": a => joinVoice(a.dataset.id),
  invite: () => inviteModal(),
  "toggle-members": () => {
    if (innerWidth <= 1100) { $("#app").classList.toggle("show-members"); return; }
    S.showMembers = !S.showMembers; store.set("showMembers", S.showMembers); renderMembers(); renderTop();
  },
  switcher,
  drawer: () => $("#app").classList.toggle("drawer"),
  scrim: () => $("#app").classList.remove("drawer", "show-members"),
  mute: toggleMute,
  deafen: toggleDeaf,
  settings: () => userSettings(),
  "status-menu": a => statusMenu(a),
  "voice-leave": leaveVoice,
  cam: toggleCam,
  share: () => { if (!V.channelId) { toast("Entre em uma sala de voz para transmitir.", "warn"); return; } shareModal(); },
  "share-stop": () => stopScreen(),
  watch: a => watch(a.dataset.uid),
  unwatch: a => unwatch(a.dataset.uid),
  "mini-close": a => unwatch(a.dataset.uid),
  "tile-focus": a => { const k = a.closest(".tile").dataset.key; V.focus = V.focus === k ? null : k; renderStage(); },
  fullscreen: a => { const t = a.closest(".tile"); if (document.fullscreenElement) document.exitFullscreen(); else t.requestFullscreen?.().catch(() => {}); },
  profile: (a, e) => { e.stopPropagation(); profilePop(a.dataset.uid, a); },
  reply: a => startReply(msgIdOf(a)),
  edit: a => startEdit(msgIdOf(a)),
  "edit-save": () => saveEdit(),
  "edit-cancel": () => cancelEdit(),
  delete: (a, e) => deleteMsg(msgIdOf(a), e.shiftKey),
  copy: a => { const m = findMsg(msgIdOf(a)); if (m) navigator.clipboard.writeText(m.t).then(() => toast("Texto copiado.", "ok")).catch(() => {}); },
  react: a => { const id = msgIdOf(a); emojiPicker(a, e => react(id, e)); },
  "quick-react": a => react(msgIdOf(a), a.dataset.emoji),
  "react-toggle": a => { a.classList.add("bump"); react(msgIdOf(a), a.dataset.emoji); },
  "reply-cancel": cancelReply,
  "jump-to": a => {
    const n = msgNode(a.dataset.ref);
    if (!n) { toast("Essa mensagem é antiga demais para aparecer aqui.", "info"); return; }
    n.scrollIntoView({ behavior: S.settings.reduceMotion ? "auto" : "smooth", block: "center" });
    n.classList.remove("highlight"); void n.offsetWidth; n.classList.add("highlight");
  },
  lightbox: a => {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `<img src="${esc(a.src)}" alt="" referrerpolicy="no-referrer">`;
    lb.onclick = () => lb.remove();
    document.body.append(lb);
  },
  "emoji-composer": a => emojiPicker(a, e => insertAtCaret(e)),
  "mention-pick": a => pickMention(+a.dataset.i)
};

function wire() {
  wireControlInput();
  document.addEventListener("click", e => {
    const sp = e.target.closest(".spoiler");
    if (sp) { sp.classList.toggle("show"); return; }
    const a = e.target.closest("[data-act]");
    if (a) {
      const fn = ACTIONS[a.dataset.act];
      if (fn) { fn(a, e); return; }
    }
    const tile = e.target.closest(".tile");
    if (tile && !e.target.closest("button")) {
      if (tile.querySelector("video")) { V.focus = V.focus === tile.dataset.key ? null : tile.dataset.key; renderStage(); }
    }
    const mini = e.target.closest("#miniPlayer");
    if (mini && !e.target.closest("button") && V.channelId) openChannel(V.channelId, false);
  });
  document.addEventListener("dblclick", e => {
    const tile = e.target.closest(".tile");
    if (tile && tile.querySelector("video") && !e.target.closest("button")) {
      if (document.fullscreenElement) document.exitFullscreen(); else tile.requestFullscreen?.().catch(() => {});
    }
  });
  document.addEventListener("mousedown", e => {
    if (!e.target.closest(".menu, .popover")) {
      if ($("body > .menu, body > .popover")) closeMenus();
      $("#sideHead").classList.remove("open");
    }
    tipEl().classList.remove("show");
  });
  document.addEventListener("contextmenu", e => {
    if (e.target.closest("input, textarea, a") || String(getSelection()).length) return;
    const at = { x: e.clientX, y: e.clientY };
    const grp = e.target.closest("[data-group]");
    if (grp) { e.preventDefault(); groupMenu(grp.dataset.group, at); return; }
    const rail = e.target.closest(".rail-item[data-id]");
    const ch = e.target.closest(".ch[data-id]");
    const msg = e.target.closest(".msg[data-id]:not(.sys)");
    const who = e.target.closest("[data-uid]");
    if (rail) { e.preventDefault(); serverMenu(rail.dataset.id, at); }
    else if (who && !e.target.closest(".msg-text")) { e.preventDefault(); memberMenu(who.dataset.uid, at); }
    else if (ch) { e.preventDefault(); channelMenu(ch.dataset.id, at); }
    else if (msg) { e.preventDefault(); messageMenu(msg.dataset.id, at); }
  });
  document.addEventListener("mouseover", e => {
    const t = e.target.closest("[data-tip]");
    if (t === tipTarget) return;
    tipTarget = t;
    showTip(t);
  });
  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.key === "Escape") {
      if (closeTop()) { e.preventDefault(); return; }
      if (S.replyTo) { cancelReply(); return; }
      if ($("#app").classList.contains("drawer")) $("#app").classList.remove("drawer");
    }
    if (!S.ready) return;
    if (mod && k === "k") { e.preventDefault(); switcher(); return; }
    if (mod && e.shiftKey && k === "m") { e.preventDefault(); toggleMute(); return; }
    if (mod && e.shiftKey && k === "d") { e.preventDefault(); toggleDeaf(); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); return; }
    if (S.view === "chat" && !mod && !e.altKey && e.key.length === 1 && !e.target.closest("input, textarea, select, [contenteditable]") && !$("#layer").children.length) $("#input").focus();
  });
  window.addEventListener("resize", () => { tipEl().classList.remove("show"); closeMenus(); }, { passive: true });
  window.addEventListener("focus", maybeRead);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) maybeRead(); });

  // rolagem das mensagens
  const mb = box();
  mb.addEventListener("scroll", () => {
    S.stick = atBottom();
    if (S.stick) { $("#jumpBtn").classList.add("hidden"); maybeRead(); }
    if (mb.scrollTop < 300 && S.channelId) { const b = S.msgs.get(S.channelId); if (b && b.loaded && b.more && !b.loading) loadHistory(S.channelId, true); }
    tipEl().classList.remove("show");
  }, { passive: true });
  $("#msgList").addEventListener("load", e => { if (e.target.tagName === "IMG" && S.stick) scrollBottom(); }, true);
  $("#jumpBtn").onclick = () => { scrollBottom(true); maybeRead(); };

  // composição
  const input = $("#input");
  input.addEventListener("input", () => {
    autoGrow();
    computeMention();
    if (input.value.trim() && Date.now() - lastTypingSent > 2500 && S.socket && S.channelId) { lastTypingSent = Date.now(); S.socket.emit("typing", { channelId: S.channelId }); }
  });
  input.addEventListener("keydown", e => {
    if (S.mention) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = S.mention.list.length; S.mention.i = (S.mention.i + (e.key === "ArrowDown" ? 1 : -1) + n) % n; drawMention(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(S.mention.i); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMention(); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
    else if (e.key === "ArrowUp" && !input.value) {
      const b = S.msgs.get(S.channelId);
      const last = b && [...b.list].reverse().find(m => m.a === S.me.id && !m.pending && !m.sys);
      if (last) { e.preventDefault(); startEdit(last.id); }
    } else if (e.key === "Escape" && S.replyTo) { e.stopPropagation(); cancelReply(); }
  });
  input.addEventListener("blur", () => setTimeout(closeMention, 150));
  // arquivos: botão, colar (Ctrl+V) e arrastar
  $("#fileInput").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  input.addEventListener("paste", e => { const fl = e.clipboardData && e.clipboardData.files; if (fl && fl.length) { e.preventDefault(); addFiles(fl); } });
  const chatView = $("#chatView"), drop = $("#dropZone");
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  chatView.addEventListener("dragenter", e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; drop.classList.remove("hidden"); });
  chatView.addEventListener("dragover", e => { if (hasFiles(e)) e.preventDefault(); });
  chatView.addEventListener("dragleave", e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; drop.classList.add("hidden"); } });
  chatView.addEventListener("drop", e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; drop.classList.add("hidden"); addFiles(e.dataTransfer.files); });
  $("#mentionPop").addEventListener("mousedown", e => e.preventDefault());
  $("#composer").addEventListener("submit", e => { e.preventDefault(); sendMessage(); });

  // arrastar servidores para reordenar
  const list = $("#serverList");
  let dragId = null;
  list.addEventListener("dragstart", e => {
    const it = e.target.closest(".rail-item[data-id]");
    if (!it) return;
    dragId = it.dataset.id;
    it.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  list.addEventListener("dragover", e => {
    if (!dragId) return;
    e.preventDefault();
    $$(".drop-before", list).forEach(x => x.classList.remove("drop-before"));
    const over = e.target.closest(".rail-item[data-id]");
    if (over && over.dataset.id !== dragId) over.classList.add("drop-before");
  });
  list.addEventListener("drop", e => {
    e.preventDefault();
    const over = e.target.closest(".rail-item[data-id]");
    const ids = sortedServers().map(s => s.id).filter(id => id !== dragId);
    const at = over ? ids.indexOf(over.dataset.id) : ids.length;
    ids.splice(at < 0 ? ids.length : at, 0, dragId);
    S.order = ids;
    store.set("order", ids);
    renderRail();
  });
  list.addEventListener("dragend", () => { dragId = null; $$(".dragging, .drop-before", list).forEach(x => x.classList.remove("dragging", "drop-before")); });
}

/* ------------------------------------------------------------------ */
/* Autenticação e inicialização                                        */
/* ------------------------------------------------------------------ */
let authMode = "login";
function setAuthMode(m) {
  authMode = m;
  $$(".seg button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  $(".seg").classList.toggle("right", m === "register");
  $("#authSubmit span").textContent = m === "login" ? "Entrar" : "Criar conta";
  $("#authSub").textContent = m === "login" ? "Que bom te ver de novo!" : "Crie sua conta em segundos.";
  $("#password").autocomplete = m === "login" ? "current-password" : "new-password";
  $("#authError").textContent = "";
}
function hideBoot() {
  const b = $("#boot");
  if (!b || b.classList.contains("hidden")) return;
  b.classList.add("out");
  setTimeout(() => b.classList.add("hidden"), 400);
}
function showAuth(msg) {
  hideBoot();
  $("#app").classList.add("hidden");
  $("#auth").classList.remove("hidden");
  $("#authError").textContent = msg || "";
  $("#authInvite").classList.toggle("hidden", !S.pendingInvite);
  setTimeout(() => $("#username").focus(), 50);
}
function showApp() {
  hideBoot();
  $("#auth").classList.add("hidden");
  $("#app").classList.remove("hidden");
}
async function doAuth(e) {
  e.preventDefault();
  const u = $("#username").value.trim(), p = $("#password").value, err = $("#authError"), btn = $("#authSubmit");
  err.textContent = "";
  if (u.length < 3) { err.textContent = "O usuário precisa de pelo menos 3 caracteres."; return; }
  if (p.length < 8) { err.textContent = "A senha precisa de pelo menos 8 caracteres."; return; }
  btn.classList.add("loading");
  try {
    if (LOCAL) {
      S.token = await localAuth(authMode, u, p);
      store.set("token", S.token);
      $("#password").value = "";
      connect();
      return;
    }
    const r = await fetch("/api/" + (authMode === "login" ? "login" : "register"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Falha ao entrar.");
    S.token = j.token;
    store.set("token", j.token);
    $("#password").value = "";
    connect();
  } catch (x) {
    err.textContent = x instanceof TypeError ? "Não foi possível falar com o servidor." : x.message;
  } finally { btn.classList.remove("loading"); }
}
async function logout() {
  await emit("logout", {});
  teardownVoice(true);
  store.del("token");
  location.reload();
}

function boot() {
  applySettings();
  $$("[data-logo]").forEach(e => (e.innerHTML = LOGO));
  $(".boot-logo").innerHTML = LOGO;
  $$("[data-icon]").forEach(e => (e.innerHTML = ic(e.dataset.icon)));
  const m = location.pathname.match(/^\/(?:convite|invite)\/([A-Za-z0-9]{4,16})/);
  let saved = null;
  try { saved = sessionStorage.getItem("nx:invite"); } catch {}
  const code = (m && m[1]) || new URLSearchParams(location.search).get("convite") || saved;
  if (code) { S.pendingInvite = code; try { sessionStorage.setItem("nx:invite", code); } catch {} }
  if (!LOCAL && location.pathname !== "/") history.replaceState(null, "", "/");
  if (LOCAL) {
    const note = $("#authInvite");
    note.textContent = "Modo local: sem servidor, sua conta e mensagens ficam salvas só neste navegador.";
    note.classList.remove("hidden");
    S.pendingInvite = null;
  }
  if (new URLSearchParams(location.search).get("abrir") === "amigos") S.openFriends = true;
  if (!LOCAL && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  if (DESKTOP) document.documentElement.classList.add("desktop-app");
  $$(".seg button").forEach(b => (b.onclick = () => setAuthMode(b.dataset.mode)));
  $("#authForm").addEventListener("submit", doAuth);
  wire();
  if (S.token) connect(); else showAuth();
}
// Nunca deixar a tela de carregamento presa: se algo falhar ou o servidor demorar, mostra o login.
setTimeout(() => { if (!S.ready && $("#auth").classList.contains("hidden")) showAuth(LOCAL ? "" : "O servidor está demorando para responder. Se ele estava dormindo (Render gratuito), aguarde uns segundos e tente entrar."); }, 9000);
try { boot(); } catch (e) { console.error(e); try { showAuth("Erro ao iniciar: " + e.message); } catch {} }
})();
