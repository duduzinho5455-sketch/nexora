/* =====================================================================
   Auryx Nexos — cliente
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
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  fileSearch: '<path d="M21 6H3M10 12H3M10 18H3"/><circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/>',
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
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6M2 9h20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
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
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  minimize: '<path d="M5 12h14"/>',
  volumeX: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>'
};
const ic = (n, c = "") => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
// cada logo ganha um id de degradê próprio (um logo escondido não "apaga" os outros)
let logoN = 0;
const LOGO = () => { const id = "axg" + (++logoN); return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a63ff"/><stop offset="1" stop-color="#22c7f0"/></linearGradient></defs><path d="M12.5 37.5 24 10.5l11.5 27" fill="none" stroke="url(#${id})" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 23v10M20.6 26v4.2M27.4 26v4.2" fill="none" stroke="url(#${id})" stroke-width="2.4" stroke-linecap="round"/></svg>`; };

const DESKTOP = window.nexoraDesktop || null;
const ANDROID = window.AuryxAndroid || null;   // ponte do app Android (tela nativa, chamada em segundo plano, avisos)
const ANDROID_URL = "https://github.com/duduzinho5455-sketch/nexora/releases/download/android/Auryx-Nexos.apk";
const DESKTOP_URL = "https://github.com/duduzinho5455-sketch/nexora/releases/latest/download/Auryx-Nexos-Setup.exe";
let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; });
window.addEventListener("appinstalled", () => { installPrompt = null; });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const COLORS = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#a78bfa", "#fb923c", "#2dd4bf"];
const STATUS = { online: "Disponível", idle: "Ausente", dnd: "Não perturbe", invisible: "Invisível", offline: "Offline" };
const EMOJIS = "😀 😂 🤣 😊 😍 🥰 😎 🤩 🥳 😅 😭 😤 😡 🤯 😱 🤔 🫡 😴 🙄 😏 🤡 💀 👻 👽 🤖 💩 👍 👎 👏 🙌 🙏 🤝 💪 👀 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 💯 🔥 ✨ ⚡ 🎉 🎮 🏆 🎧 🍕 🍔 ☕ 🍺 🚀 ✅ ❌ ⭐ 🌙".split(" ");
const QUICK = ["👍", "😂", "❤️"];
const SYS = { ocreate: "abriu este pedido. A equipe vai conferir se o Pix caiu na conta.", oreview: "colocou o pedido em análise. 🔎", oapprove: "aprovou o pagamento e liberou o plano! 🎉", oreject: "recusou o pedido.", oexpire: "— o pedido expirou depois de 7 dias sem resposta. Se você pagou, avise aqui que a equipe confere.", join: "entrou no servidor. Deem as boas-vindas! 🎉", gcreate: "criou o grupo. 🎉", gjoin: "entrou no grupo. 👋", gleave: "saiu do grupo.", gname: "mudou o nome do grupo." };
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
  shareQuality: "1080", shareMode: "detail", shareAudio: true, overlay: true, overlayPos: "tl"
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
  orders: new Map(), tickets: new Map(), plans: [], adminTab: "dash", adminFilter: "open",
  acts: new Map(), clockOff: 0
};
const V = {
  channelId: null, serverId: null, joining: false,
  mic: null, screen: null, screenCfg: null, cam: null,
  peers: new Map(), ctx: null, sink: null, meters: new Map(), speaking: new Set(),
  loop: null, statsTimer: null, ping: null, watching: new Set(), viewers: new Set(), focus: null,
  granted: new Map(),   // quem pode controlar meu PC: sock -> { uid, mode }
  padUsed: new Set(),   // vagas de controle virtual (0–3) ocupadas no meu PC
  controlling: null     // PC que eu controlo: { uid, sock, mode, kb }
};

const srv = () => S.servers.get(S.serverId);
function chan(cid = S.channelId) {
  if (isTicket(cid)) {
    const o = S.orders.get(cid.slice(2));
    if (!o) return null;
    let t = S.tickets.get(cid);
    if (!t) S.tickets.set(cid, (t = { id: cid, type: "text", ticket: true, last: o.last || null }));
    t.order = o;
    t.name = `Pedido ${o.plan}`;
    t.topic = `${fmtMoney(o.amount)} · ${ORDER_STATUS[o.status][0]}`;
    return t;
  }
  const d = S.dms.get(cid);
  if (d) { d.type = "text"; d.dm = true; if (!d.group) d.name = user(d.userId).username; d.topic = ""; return d; }
  for (const s of S.servers.values()) { const c = s.channels.find(x => x.id === cid); if (c) return c; }
  return null;
}
const isDm = cid => typeof cid === "string" && (cid.startsWith("d.") || cid.startsWith("g."));
const isTicket = cid => typeof cid === "string" && cid.startsWith("t.");
const fmtMoney = c => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const ORDER_STATUS = { pending: ["Pendente", "st-pend"], review: ["Em análise", "st-rev"], approved: ["Aprovado", "st-ok"], rejected: ["Recusado", "st-bad"], expired: ["Expirado", "st-bad"] };
const PLAN_RANK = { plus: 1, pro: 2, max: 3 };
const PLAN_NAME = { plus: "VIP", pro: "Pro", max: "Max" };
const myRank = () => (S.me && PLAN_RANK[S.me.plan]) || 0;
const groupTitle = d => d.name || d.members.filter(id => !S.me || id !== S.me.id).map(id => user(id).username).slice(0, 4).join(", ") || "Grupo";
const dmTitle = d => (d.group ? groupTitle(d) : user(d.userId).username);
function groupAvatar(d, size = 32) {
  if (d.icon && IS_IMG(d.icon)) return `<span class="av" style="--c:#5865f2;--s:${size}px"><img src="${esc(d.icon)}" alt=""></span>`;
  const others = d.members.filter(id => !S.me || id !== S.me.id).slice(0, 2).map(user);
  return `<span class="av-stack" style="--s:${size}px">${others.map(u => avatar(u, Math.round(size * 0.68))).join("")}</span>`;
}
function serverOf(cid) { for (const s of S.servers.values()) if (s.channels.some(c => c.id === cid)) return s; return null; }
const user = id => S.users.get(id) || (id === "aury" ? AURY : null) || { id, username: "Usuário removido", color: "#4b5068", avatar: "", status: "offline", about: "", created: 0 };
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
  const inner = IS_IMG(u.avatar) ? `<span class="av-im"><img src="${esc(u.avatar)}" alt="" decoding="async"${u.ap ? ` style="${bpImgStyle({ x: 50, y: 50, z: 100, ...u.ap })}"` : ""}></span>`
    : u.avatar ? `<span class="av-emoji">${esc(u.avatar)}</span>` : esc(([...name][0] || "?").toUpperCase());
  // moldura animada (Pro/Max): só em avatares de tamanho médio para cima, para não pesar em listas grandes
  const ring = u.ring && size >= 30 ? ` frame fr-${esc(u.ring)}` : "";
  const t = u.theme || [u.color || "#7c5cff", "#22d3ee"];
  return `<span class="av${ring}" style="--c:${esc(u.color || "#555")};--s:${size}px${ring ? `;--n1:${esc(t[0])};--n2:${esc(t[1])}` : ""}" ${attrs}>${inner}${status ? `<i class="st st-${esc(u.status || "offline")}"></i>` : ""}</span>`;
}
/* Perfil Turbo: nome com efeito, status personalizado e insígnias */
function nameHTML(u) {
  const t = u.theme || [u.color || "#7c5cff", "#22d3ee"];
  // assinantes: nome na cor do perfil (sem efeito) para se destacar no chat e na lista
  return `<span class="nm${u.fx ? " fx-" + esc(u.fx) : ""}${u.plan && !u.fx ? " nm-vip" : ""}" style="--n1:${esc(t[0])};--n2:${esc(t[1])}">${esc(u.username)}</span>`;
}
const staffTag = u => (u.staff === "owner" ? `<span class="staff-tag supreme" data-tip="Fundador e ADM Supremo da Auryx Nexos">ADM</span>` : u.staff === "adm" ? `<span class="staff-tag" data-tip="Equipe da Auryx Nexos">ADM</span>` : u.staff === "mod" ? `<span class="staff-tag mod" data-tip="Equipe Auryx Nexos — edição de vídeos, bugs, divulgação e backups">MOD</span>` : "");
const csText = u => (u.cs ? `${u.cs.e ? esc(u.cs.e) + " " : ""}${esc(u.cs.t || "")}` : "");
function badges(u) {
  const b = [];
  if (u.plan) b.push([{ plus: "💠", pro: "💎", max: "👑" }[u.plan] || "💠", `Assinante ${PLAN_NAME[u.plan] || ""}`]);
  if (u.created && u.created < Date.UTC(2027, 0, 1)) b.push(["⭐", "Fundador — chegou no começo da Auryx Nexos"]);
  if ([...S.servers.values()].some(s => s.ownerId === u.id)) b.push(["🏰", "Dono de servidor"]);
  if (u.steam) b.push(["🎮", "Steam conectada"]);
  return b.length ? `<div class="badges">${b.map(([e, t]) => `<span data-tip="${esc(t)}">${e}</span>`).join("")}</div>` : "";
}
function bannerStyle(u) {
  // banner em GIF: com "reduzir animações" mostra o 1º quadro (e ele também fica por baixo, enquanto o GIF carrega)
  if (u.banner && u.banner.startsWith("/f/")) {
    const still = u.bannerStill && u.bannerStill.startsWith("/f/") ? u.bannerStill : "";
    const img = still && S.settings.reduceMotion ? `url('${esc(still)}')` : still ? `url('${esc(u.banner)}'), url('${esc(still)}')` : `url('${esc(u.banner)}')`;
    return `background-image:${img};background-size:cover;background-position:center`;
  }
  const t = u.theme || [u.banner && u.banner.startsWith("#") ? u.banner : u.color || "#7c5cff", null];
  return `background:linear-gradient(135deg, ${esc(t[0])}, ${esc(t[1] || `color-mix(in srgb, ${t[0]} 30%, #000)`)})`;
}
/* Banner do perfil (imagem ou GIF) como <img>: a pessoa escolhe a altura, o zoom e o ponto que fica no centro.
   Antes era um fundo com "cover" numa faixa de 300×64 — um GIF 4:3 mostrava só ~1/4 da altura.
   O 1º quadro (still) fica por baixo só até o GIF carregar (classe "ld"), para não aparecer atrás de GIFs transparentes. */
const BANNER_H = { s: 64, m: 100, l: 140 };
const bpOf = u => ({ x: 50, y: 50, z: 100, h: "m", ...(u.bp || {}) });
const bpImgStyle = bp => `object-position:${bp.x}% ${bp.y}%;transform-origin:${bp.x}% ${bp.y}%;transform:scale(${bp.z / 100})`;
// banner (VIP) no fundo do quadro da call, atrás do avatar — GIF animado continua animado
function tileBanner(u) {
  const bp = bpOf(u), still = u.bannerStill && u.bannerStill.startsWith("/f/") ? u.bannerStill : "";
  const src = still && S.settings.reduceMotion ? still : u.banner;
  return `<div class="tile-bn"><img src="${esc(src)}" alt="" decoding="async" draggable="false" style="${bpImgStyle(bp)}"></div>`;
}
function bannerHTML(u) {
  if (!(u.banner && u.banner.startsWith("/f/"))) return `<div class="pb" style="${bannerStyle(u)}"></div>`;
  const bp = bpOf(u), still = u.bannerStill && u.bannerStill.startsWith("/f/") ? u.bannerStill : "";
  const src = still && S.settings.reduceMotion ? still : u.banner;
  return `<div class="pb pb-img" style="--bh:${BANNER_H[bp.h] || BANNER_H.m}px${still ? `;background-image:url('${esc(still)}')` : ""}"><img src="${esc(src)}" alt="" decoding="async" draggable="false" style="${bpImgStyle(bp)}"></div>`;
}
document.addEventListener("load", e => { const t = e.target; if (t.tagName === "IMG" && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains("pb-img")) t.parentNode.classList.add("ld"); }, true);
document.addEventListener("error", e => { const t = e.target; if (t.tagName === "IMG" && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains("pb-img")) t.style.display = "none"; }, true);
function uploadBlob(file, kind) {
  return new Promise((resolve, reject) => {
    if (LOCAL) return reject(new Error("Disponível na versão online da Auryx Nexos."));
    if (file.size > [8, 15, 25, 50][kind === "receipt" ? 0 : myRank()] * 1024 * 1024) return reject(new Error("Arquivo muito grande para o seu plano."));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("authorization", "Bearer " + S.token);
    if (kind === "receipt") xhr.setRequestHeader("x-private", "receipt");
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
  const inServer = (S.view === "chat" || S.view === "stage") && !isDm(S.channelId);
  $("#serverList").innerHTML = sortedServers().map(s => {
    const { mentions, unread } = serverUnread(s);
    const flag = mentions ? `<b class="badge">${mentions > 99 ? "99+" : mentions}</b>` : V.serverId === s.id ? `<span class="vc-dot">${ic("volume")}</span>` : "";
    return `<div class="rail-item${inServer && s.id === S.serverId ? " on" : ""}${unread ? " unread" : ""}" data-act="server" data-id="${s.id}" data-tip="${esc(s.name)}" role="button" tabindex="0" draggable="true"><span class="pill"></span>${serverIcon(s)}${flag}</div>`;
  }).join("");
  const premView = S.view === "premium" || (S.view === "chat" && isTicket(S.channelId) && !(S.me && S.me.admin));
  $('.rail-item[data-act="premium"]').classList.toggle("on", premView);
  const admBtn = $('.rail-item[data-act="admin"]');
  admBtn.classList.toggle("hidden", !(S.me && (S.me.admin || S.me.mod)));
  admBtn.classList.toggle("on", S.view === "admin" || (S.view === "chat" && isTicket(S.channelId) && !!(S.me && S.me.admin)));
  let tkPings = 0;
  for (const [cid, n] of S.mentions) if (isTicket(cid)) tkPings += n;
  for (const b of [$('.rail-item[data-act="premium"]'), admBtn]) { const ob = b.querySelector(".badge"); if (ob) ob.remove(); }
  if (tkPings) (S.me && S.me.admin ? admBtn : $('.rail-item[data-act="premium"]')).insertAdjacentHTML("beforeend", `<b class="badge">${tkPings}</b>`);
  const home = $(".rail-item.home");
  const inHome = S.view === "home" || S.view === "friends" || ((S.view === "chat" || S.view === "stage") && isDm(S.channelId));
  home.classList.toggle("on", inHome);
  let dmPings = 0;
  for (const d of S.dms.values()) dmPings += S.mentions.get(d.id) || 0;
  const pending = [...S.friends.values()].filter(v => v === "in").length;
  const total = dmPings + pending;
  const old = home.querySelector(".badge");
  if (old) old.remove();
  if (total) home.insertAdjacentHTML("beforeend", `<b class="badge">${total > 99 ? "99+" : total}</b>`);
  $('.rail-item[data-act="discover"]').classList.toggle("on", S.view === "discover");
  $('.rail-item[data-act="games"]').classList.toggle("on", S.view === "games");
  $('.rail-item[data-act="ai"]').classList.toggle("on", S.view === "ai");
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
  const homeLike = S.view === "home" || S.view === "friends" || ((S.view === "chat" || S.view === "stage") && isDm(S.channelId));
  const key = homeLike ? "home" : (S.view === "chat" || S.view === "stage") && s ? s.id : S.view;
  const anim = key !== lastSideKey;
  lastSideKey = key;
  body.classList.toggle("anim", anim);
  if (anim) setTimeout(() => body.classList.remove("anim"), 500);

  if (!(S.view === "chat" || S.view === "stage") || !s) {
    head.className = "side-head";
    head.style.cssText = "";
    delete head.dataset.act;
    if (S.view === "premium" || S.view === "admin" || (S.view === "chat" && isTicket(S.channelId))) {
      const adm = S.me.admin && S.view !== "premium";
      head.innerHTML = `<span class="title">${adm ? "Painel ADM" : "Premium"}</span>`;
      const list = [...S.orders.values()].filter(o => (adm ? true : o.uid === S.me.id)).sort((a, b) => ((b.last && b.last.ts) || b.created) - ((a.last && a.last.ts) || a.created)).slice(0, 40);
      body.innerHTML = (adm
        ? `<div class="ch${S.view === "admin" ? " on" : ""}" data-act="admin" role="button" tabindex="0">${ic("shield")}<span class="ch-name">Painel ADM</span></div><div class="ch" data-act="premium" role="button" tabindex="0">${ic("gem")}<span class="ch-name">Ver planos</span></div>`
        : `<div class="ch${S.view === "premium" ? " on" : ""}" data-act="premium" role="button" tabindex="0">${ic("gem")}<span class="ch-name">Planos</span></div>`) +
        `<div class="cat"><span>${adm ? "Atendimentos" : "Meus atendimentos"}</span></div>` +
        (list.length ? list.map(o => { const n = S.mentions.get("t." + o.id) || 0; return `<div class="dm-item${S.channelId === "t." + o.id ? " on" : ""}${n ? " unread" : ""}" data-act="open-ticket" data-id="${o.id}" role="button" tabindex="0"><span class="av" style="--c:${{ plus: "#22d3ee", pro: "#7c5cff", max: "#f59e0b" }[o.tier]};--s:32px">${ic("gem", "sm")}</span><div class="who"><b>${adm && o.user ? esc(o.user.username) + " · " : ""}${esc(o.plan)}</b><small>${ORDER_STATUS[o.status][0]} · ${fmtMoney(o.amount)}</small></div>${n ? `<b class="badge">${n}</b>` : ""}</div>`; }).join("")
          : `<p style="padding:0 8px;color:var(--muted);font-size:13px;margin:0">${adm ? "Abra o painel para carregar os pedidos." : "Nenhum pedido ainda."}</p>`);
      return;
    }
    if (S.view === "ai") {
      head.innerHTML = `<span class="title">Aury · IA</span>`;
      body.innerHTML = `<div class="ch on" role="button" tabindex="0">${ic("sparkles")}<span class="ch-name">Conversa com a Aury</span></div>` +
        (AIS.tier && AIS.msgs.length ? `<div class="ch" data-act="ai-clear" role="button" tabindex="0">${ic("trash")}<span class="ch-name">Apagar conversa</span></div>` : "") +
        `<div class="cat">Sobre</div><p style="padding:0 8px;color:var(--muted);font-size:13.5px;margin:0">A Aury é uma IA exclusiva do VIP. Ela também responde no atendimento de pagamento enquanto a equipe confere seu pedido.</p>`;
      return;
    }
    if (S.view === "games") {
      head.innerHTML = `<span class="title">Jogos</span>`;
      const cats = gameCats();
      body.innerHTML = `<div class="cat">Categorias</div>` + ["", ...cats].map(c => `<div class="ch${(S.gameCat || "") === c ? " on" : ""}" data-act="games-cat" data-cat="${esc(c)}" role="button" tabindex="0">${ic(c ? "gamepad" : "grid")}<span class="ch-name">${esc(c || "Todos os jogos")}</span></div>`).join("") +
        (GP.game ? `<div class="cat">Jogando agora</div><div class="ch" data-act="game-resume" role="button" tabindex="0">${ic("play")}<span class="ch-name">${esc(GP.game.name)}</span></div>` : "") +
        `<div class="cat">Dica</div><p style="padding:0 8px;color:var(--muted);font-size:13.5px;margin:0">Chame os amigos para uma call e joguem juntos. O jogo continua rodando se você minimizar.</p>`;
      return;
    }
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
        if (d.group) return `<div class="dm-item${S.view === "chat" && S.channelId === d.id ? " on" : ""}${n ? " unread" : ""}" data-act="open-dm" data-id="${d.id}" data-group="${d.id}" role="button" tabindex="0">${groupAvatar(d)}<div class="who"><b>${esc(groupTitle(d))}</b><small>${d.members.length} membros</small></div>${dmCallTag(d.id)}${n ? `<b class="badge">${n}</b>` : ""}</div>`;
        const u = user(d.userId);
        const sub = u.game ? `${ic("gamepad", "xs")} ${esc(u.game.name)}` : csText(u) || esc(u.about || "");
        return `<div class="dm-item${S.view === "chat" && S.channelId === d.id ? " on" : ""}${n ? " unread" : ""}" data-act="open-dm" data-id="${d.id}" data-uid="${u.id}" role="button" tabindex="0">${avatar(u, 32, true)}<div class="who"><b>${esc(u.username)}</b>${sub ? `<small>${sub}</small>` : ""}</div>${dmCallTag(d.id)}${n ? `<b class="badge">${n}</b>` : ""}</div>`;
      }).join("") : `<p style="padding:0 8px;color:var(--muted);font-size:13px;margin:0">Nenhuma conversa ainda. Adicione amigos e mande um oi! 👋</p>`);
    return;
  }

  // servidor personalizado: banner (imagem) ou faixa na cor temática no topo da lista de canais
  head.className = "side-head clickable" + (s.banner ? " banner has-img" : s.accent ? " banner" : "");
  head.style.cssText = s.banner ? `--c:${esc(s.accent || s.color || "#7c5cff")};--bimg:url('${esc(s.banner)}')` : s.accent ? `--c:${esc(s.accent)}` : "";
  head.dataset.act = "server-menu";
  head.innerHTML = `<span class="title">${esc(s.name)}</span>${ic("chevron", "chev")}`;
  const owner = canDo(s, "channels");
  const tools = id => (owner ? `<span class="ch-tools"><i data-act="ch-settings" data-id="${id}" data-tip="Editar canal">${ic("settings", "sm")}</i></span>` : "");
  const chIcon = (c, def) => (c.emoji ? `<span class="ch-emo">${esc(c.emoji)}</span>` : ic(def));
  const textRow = c => {
    const m = S.mentions.get(c.id) || 0;
    return `<div class="ch${S.view === "chat" && c.id === S.channelId ? " on" : ""}${isUnread(c) ? " unread" : ""}" data-act="open-ch" data-id="${c.id}" role="button" tabindex="0">${chIcon(c, "hash")}<span class="ch-name">${esc(c.name)}</span>${m ? `<b class="badge">${m}</b>` : ""}${tools(c.id)}</div>`;
  };
  const voiceRow = c => {
    const people = [...S.voice.values()].filter(v => v.channelId === c.id).sort((a, b) => a.at - b.at);
    const live = people.some(p => p.screen);
    const act = S.acts.get(c.id);
    return `<div class="ch${S.view === "stage" && c.id === S.channelId ? " on" : ""}${live ? " live" : ""}" data-act="open-ch" data-id="${c.id}" role="button" tabindex="0">${chIcon(c, "volume")}<span class="ch-name">${esc(c.name)}</span>${act ? `<span class="act-dot" data-tip="${esc(ACT_NAMES[act] || "Atividade")}">${ic({ yt: "music", sp: "headphones", board: "brush", ttt: "grid3" }[act] || "rocket", "xs")}</span>` : ""}${people.length ? `<span class="count">${people.length}/${S.voiceLimit}</span>` : ""}${tools(c.id)}</div>${people.length ? `<div class="vc-users">${people.map(vcUser).join("")}</div>` : ""}`;
  };
  const row = c => (c.type === "voice" ? voiceRow(c) : textRow(c));
  // canais sem categoria ficam nos grupos padrão; as categorias criadas pelo dono vêm depois, na ordem dos canais
  const text = s.channels.filter(c => c.type === "text" && !c.cat), voiceCh = s.channels.filter(c => c.type === "voice" && !c.cat);
  const cats = [...new Set(s.channels.map(c => c.cat).filter(Boolean))];
  const collapsed = store.get("catFold", {});
  const catHead = (name, key, add) => `<div class="cat${collapsed[key] ? " folded" : ""}" data-act="cat-fold" data-key="${esc(key)}" role="button" tabindex="0"><span>${ic("chevron", "xs")}${esc(name)}</span>${add || ""}</div>`;
  let h = "";
  if (text.length || !cats.length) h += catHead("Canais de texto", s.id + ":t", owner ? `<button data-act="new-channel" data-type="text" data-tip="Criar canal">${ic("plus", "sm")}</button>` : "") + (collapsed[s.id + ":t"] ? text.filter(c => c.id === S.channelId).map(textRow).join("") : text.map(textRow).join(""));
  if (voiceCh.length || !cats.length) h += catHead("Salas de voz", s.id + ":v", owner ? `<button data-act="new-channel" data-type="voice" data-tip="Criar sala de voz">${ic("plus", "sm")}</button>` : "") + (collapsed[s.id + ":v"] ? voiceCh.filter(c => c.id === S.channelId || [...S.voice.values()].some(v => v.channelId === c.id)).map(voiceRow).join("") : voiceCh.map(voiceRow).join(""));
  for (const cat of cats) {
    const key = s.id + ":c:" + cat, list = s.channels.filter(c => c.cat === cat);
    h += catHead(cat, key, owner ? `<button data-act="new-channel" data-type="text" data-cat="${esc(cat)}" data-tip="Criar canal em ${esc(cat)}">${ic("plus", "sm")}</button>` : "") + (collapsed[key] ? list.filter(c => c.id === S.channelId).map(row).join("") : list.map(row).join(""));
  }
  body.innerHTML = h;
}

/* ------------------------------------------------------------------ */
/* Render: topo, membros, painel do usuário                            */
/* ------------------------------------------------------------------ */
function renderTop() {
  const icon = $("#topIcon"), title = $("#topTitle"), topic = $("#topTopic"), actions = $("#topActions");
  const c = chan();
  const search = `<button class="icon-btn" data-act="switcher" data-tip="Ir para… (Ctrl+K)">${ic("search")}</button>`;
  // conversa de texto: mensagens fixadas e pesquisa no histórico inteiro
  const convo = c ? `<button class="icon-btn" data-act="pins" data-tip="Mensagens fixadas">${ic("pin")}</button><button class="icon-btn" data-act="msg-search" data-tip="Pesquisar nesta conversa">${ic("fileSearch")}</button>` : "";
  if (S.view === "chat" && c && c.ticket) {
    const o = c.order, st = ORDER_STATUS[o.status];
    icon.innerHTML = ic("gem");
    title.textContent = `Pedido ${o.plan} · ${fmtMoney(o.amount)}`;
    topic.innerHTML = `<span class="ost ${st[1]}">${st[0]}</span>${S.me.admin && o.user ? ` · ${esc(o.user.username)}` : " · Atendimento com a equipe"}`;
    const open = o.status === "pending" || o.status === "review";
    actions.innerHTML = (S.me.admin && open ? `${o.status === "pending" ? `<button class="btn sm" data-act="order-review" data-id="${o.id}">Em análise</button>` : ""}<button class="btn sm green" data-act="order-approve" data-id="${o.id}">Aprovar</button><button class="btn sm danger" data-act="order-reject" data-id="${o.id}">Recusar</button>` : "") + `<button class="icon-btn" data-act="premium" data-tip="Central de Pagamentos">${ic("gem")}</button>${search}`;
  } else if (S.view === "chat" && c && c.dm && c.group) {
    icon.innerHTML = ic("users");
    title.textContent = groupTitle(c);
    topic.textContent = `${c.members.length} membros`;
    actions.innerHTML = callBtn(c.id) + `<button class="icon-btn" data-act="group-add" data-id="${c.id}" data-tip="Adicionar pessoas">${ic("userPlus")}</button><button class="icon-btn${S.showMembers ? " on" : ""}" data-act="toggle-members" data-tip="Membros">${ic("users")}</button><button class="icon-btn" data-act="group-menu" data-id="${c.id}" data-tip="Opções do grupo">${ic("settings")}</button>${convo}${search}`;
  } else if (S.view === "chat" && c && c.dm) {
    const u = user(c.userId), f = S.friends.get(u.id);
    icon.innerHTML = ic("at");
    title.textContent = u.username;
    topic.textContent = u.game ? `🎮 Jogando ${u.game.name}` : STATUS[u.status] || "";
    actions.innerHTML = callBtn(c.id) + `${f === "friend" ? "" : `<button class="icon-btn" data-act="add-friend" data-uid="${u.id}" data-tip="${f === "out" ? "Pedido enviado" : "Adicionar amigo"}">${ic(f === "out" ? "userCheck" : "userPlus")}</button>`}<button class="icon-btn" data-act="profile" data-uid="${u.id}" data-tip="Perfil">${ic("users")}</button>${convo}${search}`;
  } else if (S.view === "chat" && c) {
    icon.innerHTML = ic("hash");
    title.textContent = c.name;
    topic.textContent = c.topic || "";
    actions.innerHTML = `<button class="icon-btn" data-act="invite" data-tip="Convidar pessoas">${ic("userPlus")}</button><button class="icon-btn${S.showMembers ? " on" : ""}" data-act="toggle-members" data-tip="Lista de membros">${ic("users")}</button>${convo}${search}`;
  } else if (S.view === "stage" && c && c.dm) {
    const n = [...S.voice.values()].filter(v => v.channelId === c.id).length;
    icon.innerHTML = ic("phone");
    title.textContent = c.group ? groupTitle(c) : user(c.userId).username;
    topic.textContent = n ? `Chamada privada · ${n} ${n === 1 ? "pessoa" : "pessoas"}` : "Chamada privada";
    actions.innerHTML = `<button class="icon-btn" data-act="open-dm" data-id="${c.id}" data-tip="Voltar para as mensagens">${ic("message")}</button>${search}`;
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
  } else if (S.view === "premium") {
    icon.innerHTML = ic("gem"); title.textContent = "Central de Pagamentos"; topic.textContent = "Planos VIP, Pro e Max"; actions.innerHTML = search;
  } else if (S.view === "ai") {
    icon.innerHTML = ic("sparkles"); title.textContent = "Aury"; topic.textContent = "Sua IA exclusiva do VIP"; actions.innerHTML = search;
  } else if (S.view === "games") {
    icon.innerHTML = ic("gamepad"); title.textContent = "Jogos"; topic.textContent = "Jogue com os amigos sem sair da Auryx"; actions.innerHTML = search;
  } else if (S.view === "admin") {
    icon.innerHTML = ic("shield"); title.textContent = "Painel ADM"; topic.textContent = "Pagamentos, planos e histórico"; actions.innerHTML = search;
  } else {
    icon.innerHTML = ic("users"); title.textContent = "Início"; topic.textContent = ""; actions.innerHTML = search;
  }
}

/* ------------------------------------------------------------------ */
/* Cargos e permissões dos servidores                                  */
/* ------------------------------------------------------------------ */
const PERM_INFO = [
  ["admin", "Administrador", "Pode tudo, menos excluir o servidor. Dê só para quem você confia muito."],
  ["server", "Editar o servidor", "Nome, ícone, cor, descrição e se é público."],
  ["channels", "Gerenciar canais", "Criar, editar, mover e excluir canais e salas de voz."],
  ["roles", "Gerenciar cargos", "Criar cargos e dar cargos (só abaixo do próprio)."],
  ["kick", "Expulsar membros", "Tirar alguém do servidor (pode voltar com convite)."],
  ["ban", "Banir membros", "Tirar e impedir de voltar. Também desbane."],
  ["messages", "Gerenciar mensagens", "Apagar mensagens de outras pessoas."]
];
const ROLE_COLORS = ["#99aab5", "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee", "#60a5fa", "#7c5cff", "#c084fc", "#f472b6", "#e11d48", "#16a34a"];
const sRoles = s => (s && s.roles) || [];                                   // do mais alto para o mais baixo
const userRoles = (s, uid) => { const ids = (s && s.memberRoles && s.memberRoles[uid]) || []; return sRoles(s).filter(r => ids.includes(r.id)); };
function canDo(s, p, uid = S.me && S.me.id) {
  if (!s || !uid) return false;
  if (s.ownerId === uid) return true;
  return userRoles(s, uid).some(r => r.perms.includes("admin") || r.perms.includes(p));
}
const canManage = s => PERM_INFO.some(([p]) => canDo(s, p));
function myTopPos(s, uid = S.me && S.me.id) { if (s.ownerId === uid) return Infinity; const r = userRoles(s, uid); return r.length ? Math.max(...r.map(x => x.pos)) : -1; }
// cor do nome = cargo mais alto que tem cor
function roleColor(s, uid) { const r = userRoles(s, uid).find(x => x.color && x.color !== "#99aab5"); return r ? r.color : ""; }
function onServerRoles({ serverId, roles, memberRoles }) {
  const s = S.servers.get(serverId);
  if (!s) return;
  s.roles = roles; s.memberRoles = memberRoles;
  schedule("side", "members", "chat", "rail");
  if (S.view === "chat" && S.serverId === serverId) rerenderVisible && rerenderVisible();
  const p = document.querySelector(".settings-wrap [data-roles-root]");
  if (p && p._redraw) p._redraw();
}
const roleChip = r => `<span class="role-chip" style="--rc:${esc(r.color)}"><i></i>${r.icon ? esc(r.icon) + " " : ""}${esc(r.name)}</span>`;

function rolesSection(s, sid) {
  return {
    id: "roles", name: "Cargos",
    render: () => `<div data-roles-root></div>`,
    mount(p) {
      const root = p.querySelector("[data-roles-root]");
      let editing = null;
      const draw = () => {
        const srv = S.servers.get(sid) || s, top = myTopPos(srv), roles = sRoles(srv);
        const count = r => Object.values(srv.memberRoles || {}).filter(ids => ids.includes(r.id)).length;
        if (editing) {
          const r = editing === "new" ? { name: "", color: "#7c5cff", perms: [], hoist: true } : roles.find(x => x.id === editing);
          if (!r) { editing = null; draw(); return; }
          root.innerHTML = `<button class="btn ghost sm" data-back>← Voltar aos cargos</button>
            <div class="role-edit"><div class="role-prev">${roleChip({ name: r.name || "Novo cargo", color: r.color, icon: r.icon })}</div>
            <label class="field"><span>Nome do cargo</span><input data-rname maxlength="32" value="${esc(r.name)}" placeholder="Ex.: Moderador, VIP, Amigos"></label>
            <span class="label">Cor</span><div class="swatches" style="margin:8px 0 16px">${ROLE_COLORS.map(c => `<button type="button" class="swatch${c === r.color ? " on" : ""}" style="--c:${c}" data-rcolor="${c}"></button>`).join("")}<label class="swatch custom" data-tip="Outra cor" style="--c:${esc(r.color)}"><input type="color" data-rcustom value="${esc(r.color)}"></label></div>
            <span class="label">Ícone do cargo</span><div class="row-btns" style="margin:8px 0 16px"><button type="button" class="btn emo-pick" data-ricon>${r.icon ? esc(r.icon) : "＋"}</button>${r.icon ? `<button type="button" class="btn sm ghost" data-ricon-clear>Tirar ícone</button>` : ""}<small class="hint">Aparece ao lado do nome no chat e na lista de membros</small></div>
            <div class="toggle-row"><span><b>Mostrar separado na lista de membros</b><small>Quem tem esse cargo aparece num grupo próprio</small></span><label class="switch"><input type="checkbox" data-rhoist ${r.hoist ? "checked" : ""}><i></i></label></div>
            <span class="label" style="display:block;margin-top:16px">Permissões</span>
            <div class="perm-list">${PERM_INFO.map(([k, t, d]) => { const mine = canDo(srv, k); return `<label class="perm${mine ? "" : " locked"}" ${mine ? "" : 'data-tip="Você não tem essa permissão para poder dar"'}><span><b>${t}</b><small>${d}</small></span><label class="switch"><input type="checkbox" data-perm="${k}" ${r.perms.includes(k) ? "checked" : ""} ${mine ? "" : "disabled"}><i></i></label></label>`; }).join("")}</div>
            <div class="modal-foot" style="justify-content:space-between">${editing !== "new" ? `<button class="btn danger" data-rdel>Apagar cargo</button>` : "<span></span>"}<button class="btn primary" data-rsave>${editing === "new" ? "Criar cargo" : "Salvar"}</button></div></div>`;
          const prev = () => { root.querySelector(".role-prev").innerHTML = roleChip({ name: root.querySelector("[data-rname]").value || "Novo cargo", color: r.color, icon: r.icon }); };
          root.querySelector("[data-rname]").addEventListener("input", prev);
          root.querySelector("[data-rcustom]").addEventListener("input", e => { r.color = e.target.value; $$("[data-rcolor]", root).forEach(b => b.classList.remove("on")); prev(); });
          root.onclick = async e => {
            if (e.target.closest("[data-back]")) { editing = null; draw(); return; }
            const c = e.target.closest("[data-rcolor]");
            if (c) { r.color = c.dataset.rcolor; $$("[data-rcolor]", root).forEach(b => b.classList.toggle("on", b === c)); prev(); return; }
            const ri = e.target.closest("[data-ricon]");
            if (ri) { emojiPicker(ri, v => { r.icon = v; ri.textContent = v; prev(); }); return; }
            if (e.target.closest("[data-ricon-clear]")) { r.icon = ""; root.querySelector("[data-ricon]").textContent = "＋"; prev(); return; }
            if (e.target.closest("[data-rsave]")) {
              const perms = $$("[data-perm]", root).filter(x => x.checked).map(x => x.dataset.perm);
              const res = await emit("role:save", { serverId: sid, roleId: editing === "new" ? undefined : editing, name: root.querySelector("[data-rname]").value, color: r.color, icon: r.icon || "", perms, hoist: root.querySelector("[data-rhoist]").checked });
              if (res.error) { toast(res.error, "error"); return; }
              toast("Cargo salvo.", "ok"); editing = null; setTimeout(draw, 150);
            }
            if (e.target.closest("[data-rdel]")) {
              if (!(await confirmBox({ title: "Apagar cargo", html: `Apagar o cargo <b>${esc(r.name)}</b>? Quem tem esse cargo perde ele.`, ok: "Apagar" }))) return;
              const res = await emit("role:delete", { serverId: sid, roleId: editing });
              if (res.error) { toast(res.error, "error"); return; }
              editing = null; setTimeout(draw, 150);
            }
          };
          return;
        }
        root.innerHTML = `<p style="color:var(--muted);margin-top:-8px">Cargos dão cor ao nome e permissões. Quem está mais acima na lista manda em quem está abaixo. O dono (👑) está acima de todos.</p>
          <button class="btn primary" data-rnew ${canDo(srv, "roles") ? "" : "disabled"}>${ic("plus", "sm")}Criar cargo</button>
          <div class="role-list">${roles.length ? roles.map((r, i) => { const can = r.pos < top; return `<div class="role-row${can ? "" : " locked"}"><span class="role-dot" style="--rc:${esc(r.color)}"></span><div class="who"><b>${esc(r.name)}</b><small>${count(r)} ${count(r) === 1 ? "membro" : "membros"} · ${r.perms.includes("admin") ? "Administrador" : r.perms.length ? r.perms.length + " permiss" + (r.perms.length === 1 ? "ão" : "ões") : "só a cor"}</small></div>${can ? `<button class="icon-btn" data-rup="${r.id}" data-tip="Subir" ${i === 0 ? "disabled" : ""}>${ic("arrowUp", "sm")}</button><button class="icon-btn" data-rdown="${r.id}" data-tip="Descer" ${i === roles.length - 1 ? "disabled" : ""}>${ic("arrowDown", "sm")}</button><button class="btn sm" data-redit="${r.id}">Editar</button>` : `<small class="role-lock">${ic("shield", "xs")} acima de você</small>`}</div>`; }).join("") : `<div class="empty" style="padding:24px">${ic("shield")}<p>Nenhum cargo ainda. Crie um "Moderador" para ter ajuda com o servidor.</p></div>`}</div>`;
        root.onclick = async e => {
          if (e.target.closest("[data-rnew]")) { editing = "new"; draw(); return; }
          const ed = e.target.closest("[data-redit]"), up = e.target.closest("[data-rup]"), dn = e.target.closest("[data-rdown]");
          if (ed) { editing = ed.dataset.redit; draw(); return; }
          if (up || dn) { const res = await emit("role:move", { serverId: sid, roleId: (up || dn).dataset[up ? "rup" : "rdown"], dir: up ? 1 : -1 }); if (res.error) toast(res.error, "error"); else setTimeout(draw, 150); }
        };
      };
      root._redraw = () => { if (!editing) draw(); };
      draw();
    }
  };
}
function memberRolesMenu(sid, uid, at, after) {
  const s = S.servers.get(sid);
  if (!s) return;
  const top = myTopPos(s), cur = new Set(userRoles(s, uid).map(r => r.id));
  const items = sRoles(s).filter(r => r.pos < top).map(r => ({ label: `${cur.has(r.id) ? "✓ " : ""}${r.name}`, icon: "shield", run: async () => {
    cur.has(r.id) ? cur.delete(r.id) : cur.add(r.id);
    const res = await emit("member:roles", { serverId: sid, userId: uid, roleIds: [...cur] });
    if (res.error) toast(res.error, "error"); else { toast("Cargos atualizados.", "ok"); after && setTimeout(after, 150); }
  } }));
  if (!items.length) { toast("Nenhum cargo que você possa dar. Crie um em Configurações › Cargos.", "info"); return; }
  menu(at, items);
}
function banModal(sid, u, after) {
  modal({
    title: "Banir membro", sub: esc(u.username),
    body: `<p style="color:var(--text-2)">A pessoa sai do servidor e <b>não consegue voltar</b> nem com convite, até alguém desbanir.</p><label class="field"><span>Motivo (opcional)</span><textarea data-r maxlength="200" placeholder="Ex.: spam, ofensas"></textarea></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go>Banir</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = async () => {
        const r = await emit("server:ban", { serverId: sid, userId: u.id, reason: m.querySelector("[data-r]").value });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast(`${u.username} foi banido(a).`, "ok"); after && setTimeout(after, 150);
      };
    }
  });
}
function membersSection(s, sid) {
  return {
    id: "members", name: "Membros",
    render: () => `<div data-mem-root></div>`,
    mount(p) {
      const root = p.querySelector("[data-mem-root]");
      let q = "";
      const draw = () => {
        const srv = S.servers.get(sid) || s, top = myTopPos(srv);
        const list = srv.members.map(user).filter(u => !q || u.username.toLowerCase().includes(q)).sort((a, b) => myTopPos(srv, b.id) - myTopPos(srv, a.id) || a.username.localeCompare(b.username));
        root.innerHTML = `<div class="mem-head"><input data-mq placeholder="Buscar membro…" value="${esc(q)}"><small>${srv.members.length} ${srv.members.length === 1 ? "membro" : "membros"}</small></div>` +
          list.map(u => {
            const mine = u.id === S.me.id, below = !mine && u.id !== srv.ownerId && myTopPos(srv, u.id) < top;
            return `<div class="member-row">${avatar(u, 36, true)}<div class="who"><b style="color:${esc(roleColor(srv, u.id) || "inherit")}">${esc(u.username)}${u.id === srv.ownerId ? " 👑" : ""}</b><div class="mr-roles">${userRoles(srv, u.id).map(roleChip).join("") || `<small style="color:var(--muted)">sem cargo</small>`}</div></div>
              <div class="ao-acts">${canDo(srv, "roles") && (below || (mine && srv.ownerId === S.me.id)) ? `<button class="btn sm" data-mroles="${u.id}">${ic("shield", "sm")}Cargos</button>` : ""}${below && canDo(srv, "kick") ? `<button class="btn sm" data-mkick="${u.id}">Expulsar</button>` : ""}${below && canDo(srv, "ban") ? `<button class="btn sm danger" data-mban="${u.id}">Banir</button>` : ""}${srv.ownerId === S.me.id && !mine ? `<button class="btn sm ghost" data-mtransfer="${u.id}" data-tip="Tornar dono">👑</button>` : ""}</div></div>`;
          }).join("");
        const inp = root.querySelector("[data-mq]");
        inp.oninput = () => { q = inp.value.trim().toLowerCase(); const pos = inp.selectionStart; draw(); const n = root.querySelector("[data-mq]"); n.focus(); n.setSelectionRange(pos, pos); };
      };
      root.addEventListener("click", async e => {
        const srv = S.servers.get(sid) || s;
        const rb = e.target.closest("[data-mroles]"), k = e.target.closest("[data-mkick]"), b = e.target.closest("[data-mban]"), t = e.target.closest("[data-mtransfer]");
        if (rb) memberRolesMenu(sid, rb.dataset.mroles, rb, draw);
        if (k) {
          const u = user(k.dataset.mkick);
          if (await confirmBox({ title: "Expulsar membro", html: `Expulsar <b>${esc(u.username)}</b> de ${esc(srv.name)}? A pessoa pode voltar com um novo convite.`, ok: "Expulsar" })) {
            const r = await emit("server:kick", { serverId: sid, userId: u.id });
            if (r.error) toast(r.error, "error"); else { toast(`${u.username} foi expulso(a).`, "ok"); setTimeout(draw, 150); }
          }
        }
        if (b) banModal(sid, user(b.dataset.mban), draw);
        if (t) {
          const u = user(t.dataset.mtransfer);
          if (await confirmBox({ title: "Transferir posse", html: `Tornar <b>${esc(u.username)}</b> dono(a) de ${esc(srv.name)}? Você perderá as permissões de dono.`, ok: "Transferir" })) {
            const r = await emit("server:transfer", { serverId: sid, userId: u.id });
            if (r.error) toast(r.error, "error"); else { toast("Posse transferida.", "ok"); closeTop(); }
          }
        }
      });
      root._redraw = draw;
      root.setAttribute("data-roles-root", "");
      draw();
    }
  };
}
function bansSection(sid) {
  return {
    id: "bans", name: "Banidos",
    render: () => `<div data-bans><p style="color:var(--muted)">Carregando…</p></div>`,
    mount(p) {
      const root = p.querySelector("[data-bans]");
      const draw = async () => {
        const r = await emit("server:bans", { serverId: sid });
        if (r.error) { root.innerHTML = esc(r.error); return; }
        root.innerHTML = r.bans.length ? r.bans.map(b => `<div class="member-row">${avatar(b.user, 36)}<div class="who"><b>${esc(b.user.username)}</b><small>Banido em ${fmtDate(b.at)} por ${esc(b.by)}${b.reason ? " · " + esc(b.reason) : ""}</small></div><button class="btn sm" data-unban="${b.user.id}">Desbanir</button></div>`).join("") : `<div class="empty" style="padding:24px">${ic("shield")}<p>Ninguém banido.</p></div>`;
      };
      root.addEventListener("click", async e => {
        const u = e.target.closest("[data-unban]");
        if (!u) return;
        const r = await emit("server:unban", { serverId: sid, userId: u.dataset.unban });
        if (r.error) toast(r.error, "error"); else { toast("Desbanido(a). A pessoa já pode voltar com um convite.", "ok"); draw(); }
      });
      draw();
    }
  };
}
function logSection(sid) {
  const NAMES = { kick: "expulsou", ban: "baniu", unban: "desbaniu", "role:create": "criou o cargo", "role:edit": "editou o cargo", "role:delete": "apagou o cargo", "member:roles": "mudou os cargos de" };
  return {
    id: "log", name: "Registro",
    render: () => `<div data-slog><p style="color:var(--muted)">Carregando…</p></div>`,
    mount(p) {
      const root = p.querySelector("[data-slog]");
      emit("server:log", { serverId: sid }).then(r => {
        if (r.error) { root.innerHTML = esc(r.error); return; }
        root.innerHTML = r.log.length ? `<div class="audit">${r.log.map(x => `<div class="au-row"><small>${new Date(x.at).toLocaleString("pt-BR")}</small><b>${esc(x.byName)}</b><span>${esc(NAMES[x.action] || x.action)} ${x.role ? `<b>${esc(x.role)}</b>` : ""}${x.targetName ? `<b>${esc(x.targetName)}</b>` : ""}${x.reason ? ` — ${esc(x.reason)}` : ""}</span></div>`).join("")}</div>` : `<div class="empty" style="padding:24px">${ic("receipt")}<p>Nada registrado ainda. Expulsões, banimentos e mudanças de cargo aparecem aqui.</p></div>`;
      });
    }
  };
}

function renderMembers() {
  const el = $("#members"), app = $("#app"), gc = S.view === "chat" ? chan() : null;
  const s = gc && gc.group ? { members: gc.members, ownerId: gc.ownerId, id: gc.id } : srv();
  const show = S.view === "chat" && s;
  app.classList.toggle("no-members", !(show && S.showMembers));
  if (!show) { el.innerHTML = ""; app.classList.remove("show-members"); return; }
  // assinantes primeiro (Max, Pro, VIP) e com destaque; depois por nome
  const all = s.members.map(user).sort((a, b) => (PLAN_RANK[b.plan] || 0) - (PLAN_RANK[a.plan] || 0) || a.username.localeCompare(b.username, "pt-BR"));
  const on = all.filter(u => u.status !== "offline"), off = all.filter(u => u.status === "offline");
  const row = u => {
    const v = S.voice.get(u.id);
    const sub = v && v.serverId === s.id ? `<small>${ic("volume", "xs")} ${esc(chan(v.channelId)?.name || "Em chamada")}${v.screen ? " · ao vivo" : ""}</small>`
      : u.game ? `<small class="playing">${ic("gamepad", "xs")} Jogando <b>${esc(u.game.name)}</b></small>`
      : u.cs ? `<small>${csText(u)}</small>`
      : u.about ? `<small>${esc(u.about)}</small>` : "";
    const rc = s.roles ? roleColor(s, u.id) : "";
    const ricon = s.roles ? userRoles(s, u.id).map(r => r.icon).find(Boolean) : "";
    return `<div class="member${u.status === "offline" ? " off" : ""}${V.speaking.has(u.id) ? " speaking" : ""}${u.plan ? " vip vip-" + esc(u.plan) : ""}" data-act="profile" data-uid="${u.id}" data-voice-user="${u.id}"${rc && !u.plan ? ` style="--rc:${esc(rc)}"` : ""}>${avatar(u, 34, true)}<div class="who"><b>${nameHTML(u)}${ricon ? `<span class="role-ico">${esc(ricon)}</span>` : ""}${u.plan ? `<span class="plan-chip" data-tip="Assinante ${esc(PLAN_NAME[u.plan])}">${{ plus: "💠", pro: "💎", max: "👑" }[u.plan]}</span>` : ""}${staffTag(u)}${u.id === s.ownerId ? `<span data-tip="Dono do servidor">${ic("crown", "xs")}</span>` : ""}</b>${sub}</div></div>`;
  };
  const hoisted = sRoles(s).filter(r => r.hoist);
  const groupOf = u => hoisted.find(r => userRoles(s, u.id).includes(r));
  let html = "";
  for (const r of hoisted) { const g = on.filter(u => groupOf(u) === r); if (g.length) html += `<div class="cat" style="color:${esc(r.color)}">${esc(r.name)} — ${g.length}</div>${g.map(row).join("")}`; }
  const rest = on.filter(u => !groupOf(u));
  if (rest.length) html += `<div class="cat">Online — ${rest.length}</div>${rest.map(row).join("")}`;
  if (off.length) html += `<div class="cat">Offline — ${off.length}</div>${off.map(row).join("")}`;
  el.innerHTML = html;
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
  el.innerHTML = `<div class="vp-row"><div class="vp-status"><b class="${failed || waiting ? "wait" : ""}" data-ping data-tip="${V.ping != null ? `Latência: ${V.ping} ms` : "Medindo latência…"}">${ic("signal", "sm")}${failed ? "Reconectando…" : waiting ? "Conectando…" : "Voz conectada"}</b><small data-act="open-ch" data-id="${V.channelId}">${c && c.dm ? `📞 Chamada privada · ${esc(dmTitle(c))}` : `${esc(c?.name || "")} / ${esc(s?.name || "")}`}</small></div><button class="icon-btn" data-act="voice-leave" data-tip="Desconectar">${ic("phoneOff")}</button></div>
    <div class="vp-actions"><button class="btn${V.cam ? " on" : ""}" data-act="cam">${ic(V.cam ? "camera" : "cameraOff", "sm")}Câmera</button><button class="btn${V.screen ? " on" : ""}" data-act="share">${ic("monitorUp", "sm")}${V.screen ? "Ao vivo" : "Tela"}</button></div>`;
}

function renderTitle() {
  let m = 0, u = false;
  for (const s of S.servers.values()) { const r = serverUnread(s); m += r.mentions; u = u || r.unread; }
  document.title = (m ? `(${m}) ` : u ? "• " : "") + "Auryx Nexos";
}

/* ------------------------------------------------------------------ */
/* Navegação                                                           */
/* ------------------------------------------------------------------ */
const VIEWS = { chat: "#chatView", stage: "#stageView", home: "#homeView", discover: "#discoverView", friends: "#friendsView", premium: "#premiumView", admin: "#adminView", games: "#gamesView", ai: "#aiView" };
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
  setTimeout(applyAccent, 0);   // a cor temática acompanha o servidor aberto
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
  const d = S.dms.get(id) || (isTicket(id) ? chan(id) : null);
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
/* ------------------------------------------------------------------ */
/* Central de Pagamentos: planos, Pix, comprovante e atendimento       */
/* O plano só é liberado quando um ADM confere o Pix e aprova.         */
/* ------------------------------------------------------------------ */
const statusTag = s => { const st = ORDER_STATUS[s] || ["?", ""]; return `<span class="ost ${st[1]}">${st[0]}</span>`; };
const fmtDate = ts => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
function onOrderUpdate(o) {
  const prev = S.orders.get(o.id);
  S.orders.set(o.id, o);
  if (prev && prev.status !== o.status && o.uid === S.me.id) {
    if (o.status === "approved") { toast(`Pagamento aprovado! Plano ${o.plan} liberado. 🎉`, "ok", 6000); confetti(); sfx("live"); }
    if (o.status === "rejected") toast(`Seu pedido do plano ${o.plan} foi recusado: ${o.reason}`, "warn", 8000);
    if (o.status === "review") toast(`Seu pedido do plano ${o.plan} está em análise.`, "info");
    if (o.status === "approved") loadPlans().then(() => S.view === "premium" && renderPremium());
  }
  if (S.view === "premium") renderPremium();
  if (S.view === "admin") renderAdmin(true);
  if (S.view === "chat" && S.channelId === "t." + o.id) renderTop();
  schedule("side");
}
async function loadPlans() {
  const r = await emit("plans:get", {});
  if (r.error) { toast(r.error, "error"); return false; }
  S.plans = r.plans; S.pixKey = r.pixKey || "";
  S.planMine = r.mine; S.planLast = r.last || null; S.planLog = r.log || [];
  for (const o of r.orders) S.orders.set(o.id, o);
  return true;
}
async function goPremium() {
  setView("premium");
  S.serverId = null; S.channelId = null;
  $("#premiumView").innerHTML = `<div class="page"><div class="hero"><h1>Carregando planos…</h1></div></div>`;
  renderAll(); updateMini();
  if (LOCAL) { $("#premiumView").innerHTML = `<div class="page"><div class="empty">${ic("gem")}<p>Os planos Premium funcionam na versão online da Auryx Nexos.</p></div></div>`; return; }
  if (await loadPlans()) renderPremium();
}
function renderPremium() {
  const root = $("#premiumView");
  if (!root || !S.plans.length) return;
  const mine = S.planMine || S.me.planInfo, last = S.planLast, log = S.planLog || [];
  const myOrders = [...S.orders.values()].filter(o => o.uid === S.me.id).sort((a, b) => b.created - a.created);
  const pending = myOrders.find(o => o.status === "pending" || o.status === "review");
  const day = 86400e3, left = mine ? Math.max(0, Math.ceil((mine.until - Date.now()) / day)) : 0;
  const span = mine && mine.since ? Math.max(day, mine.until - mine.since) : 30 * day;
  const pct = mine ? Math.max(4, Math.min(100, Math.round(((mine.until - Date.now()) / span) * 100))) : 0;
  const EMO = { plus: "💠", pro: "💎", max: "👑" };
  const sub = mine
    ? `<div class="sub-card sub-${esc(mine.tier)}"><div class="sub-top"><span class="sub-emo">${EMO[mine.tier] || "💠"}</span><div><small>Sua assinatura</small><b>${esc(PLAN_NAME[mine.tier] || "")} <span class="ost st-ok">ativa</span></b></div><div class="sub-left"><b>${left}</b><small>${left === 1 ? "dia restante" : "dias restantes"}</small></div></div>
        <div class="sub-bar"><i style="width:${pct}%"></i></div>
        <div class="sub-dates"><span>Ativada em <b>${mine.since ? fmtDate(mine.since) : "—"}</b></span><span>Vence em <b>${fmtDate(mine.until)}</b></span></div>
        ${left <= 3 ? `<div class="sub-warn">${ic("info", "sm")} Vence logo! Renove para não perder os benefícios — os dias novos somam aos que faltam.</div>` : ""}
        <div class="sub-acts"><button class="btn primary" data-act="buy-plan" data-tier="${esc(mine.tier)}" data-cycle="m">${ic("gem", "sm")}Renovar +30 dias</button><button class="btn" data-act="buy-plan" data-tier="${esc(mine.tier)}" data-cycle="q">+90 dias (trimestral)</button><small>Sem cobrança automática: o plano só renova quando você paga. Para cancelar, é só não renovar.</small></div></div>`
    : `<div class="sub-card sub-none"><div class="sub-top"><span class="sub-emo">✨</span><div><small>Sua assinatura</small><b>${last ? `${esc(PLAN_NAME[last.tier] || "")} <span class="ost st-bad">vencida em ${fmtDate(last.until)}</span>` : "Você ainda não assina"}</b></div></div><p>${last ? "Seus benefícios estão pausados, mas nada foi apagado: renove e tudo volta como estava." : "Escolha um plano abaixo. A partir de <b>R$ 5,99 por mês</b>, sem fidelidade."}</p></div>`;
  root.innerHTML = `<div class="page premium">
    <div class="hero prem-hero"><h1>${ic("gem", "lg")} Auryx VIP</h1><p>Apoie a Auryx Nexos e ganhe insígnia, perfil turbinado, a Aury (IA) e arquivos maiores. Pagamento por Pix, sem cartão e sem renovação automática.</p></div>
    ${pending ? `<div class="prem-alert">${ic("info")}<span>Você tem um pedido <b>${esc(pending.plan)}</b> ${statusTag(pending.status)}. A equipe confere o Pix e responde no atendimento.</span><button class="btn sm" data-act="open-ticket" data-id="${pending.id}">Abrir atendimento</button></div>` : ""}
    ${sub}
    <div class="cycle-pick" role="tablist"><button class="${S.cycle !== "q" ? "on" : ""}" data-act="plan-cycle" data-c="m">Mensal</button><button class="${S.cycle === "q" ? "on" : ""}" data-act="plan-cycle" data-c="q">Trimestral <span class="save-tag">economize até ${Math.max(...S.plans.map(p => p.price3 ? Math.round((1 - p.price3 / (p.price * 3)) * 100) : 0))}%</span></button></div>
    <div class="plans">${S.plans.map(p => {
      const q = S.cycle === "q" && p.price3, active = mine && mine.tier === p.tier, feat = p.tier === "plus";
      const days = q ? 90 : 30, price = q ? p.price3 : p.price;
      const off = q ? Math.round((1 - p.price3 / (p.price * 3)) * 100) : 0;
      const change = mine && !active ? `<small class="plan-note">Os dias que faltam do seu plano atual viram dias deste, pelo valor.</small>` : "";
      return `<div class="plan plan-${p.tier}${feat ? " featured" : ""}${active ? " current" : ""}">${feat ? `<span class="plan-flag">Oficial · mais escolhido</span>` : ""}${active ? `<span class="plan-flag cur">Seu plano</span>` : ""}
        <div class="plan-emo">${EMO[p.tier] || "💠"}</div><h3>${esc(p.name)}</h3><div class="price"><b>${fmtMoney(price)}</b><small>${q ? "/3 meses" : "/mês"}</small></div>
        ${q ? `<div class="price-sub"><s>${fmtMoney(p.price * 3)}</s> <span class="save-tag">-${off}%</span> · ${fmtMoney(Math.round(p.price3 / 3))}/mês</div>` : `<div class="price-sub">ou ${fmtMoney(p.price3)} no trimestral</div>`}
        <ul>${p.benefits.map(b => `<li>${ic("check", "sm")}${esc(b)}</li>`).join("")}</ul>
        <button class="btn ${feat || active ? "primary" : ""} big" data-act="buy-plan" data-tier="${p.tier}" data-cycle="${q ? "q" : "m"}">${active ? `Renovar +${days} dias` : `Assinar ${esc(p.name)}${q ? " · 3 meses" : ""}`}</button>${change}</div>`;
    }).join("")}</div>
    <div class="section-title">${ic("receipt", "sm")} Pagamentos</div>
    ${myOrders.length ? `<div class="orders">${myOrders.map(o => `<div class="order-row"><div class="or-main"><b>Plano ${esc(o.plan)}</b><small>${fmtMoney(o.amount)} · ${fmtDate(o.created)}${o.status === "rejected" && o.reason ? ` · Motivo: ${esc(o.reason)}` : ""}${o.status === "expired" ? " · ficou 7 dias sem resposta — chame no atendimento se você pagou" : ""}${o.decidedBy ? ` · por ${esc(o.decidedBy)}` : ""}</small></div>${statusTag(o.status)}<button class="btn sm" data-act="open-ticket" data-id="${o.id}">${ic("message", "sm")}Atendimento</button></div>`).join("")}</div>` : `<div class="empty" style="padding:24px">${ic("receipt")}<p>Nenhum pagamento ainda.</p></div>`}
    ${log.length ? `<div class="section-title">${ic("gem", "sm")} Histórico da assinatura</div><div class="orders">${log.map(x => `<div class="order-row"><div class="or-main"><b>${esc(x.name)} · +${x.days} dias</b><small>${new Date(x.at).toLocaleString("pt-BR")}${x.from && x.from !== x.tier ? ` · trocou de ${esc(PLAN_NAME[x.from] || x.from)}${x.credit ? ` (+${Math.round(x.credit / 24)} dias convertidos)` : ""}` : ""}${x.order ? "" : " · liberado pela equipe"}</small></div></div>`).join("")}</div>` : ""}
    <div class="prem-how"><b>Como funciona</b><ol><li>Escolha o plano e pague pelo Pix (QR Code ou link oficial do Nubank).</li><li>Envie o comprovante aqui no app.</li><li>Um ADM confere se o valor caiu na conta e libera na hora — você acompanha pelo atendimento, e a Aury (IA) tira dúvidas enquanto isso.</li></ol></div>
  </div>`;
}
let qrLib = null;
function loadQr() {
  if (window.qrcode) return Promise.resolve();
  if (qrLib) return qrLib;
  qrLib = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/qrcode/qrcode.js"; s.onload = res; s.onerror = () => { qrLib = null; rej(new Error("qr")); }; document.head.append(s); });
  return qrLib;
}
function buyModal(tier, cycle = "m") {
  const base = S.plans.find(x => x.tier === tier);
  if (!base) return;
  // trimestral: mesmo fluxo, com o valor e o link do ciclo de 3 meses; sem link, paga pela chave Pix da equipe
  const q = cycle === "q" && !!base.price3;
  const p = { ...base, price: q ? base.price3 : base.price, link: q ? base.link3 : base.link };
  const pix = !p.link && S.pixKey ? S.pixKey : "";
  if (!p.link && !pix) { toast("O pagamento deste plano ainda não foi configurado pela equipe. Tente o mensal ou fale com um ADM.", "warn", 6000); return; }
  let receipt = null, step = 1, sending = false;
  modal({
    title: `Assinar ${esc(p.name)}${q ? " · Trimestral" : ""}`, sub: `${fmtMoney(p.price)} por ${q ? "90 dias (3 meses)" : "30 dias"}`, cls: "wide",
    body: `<div class="buy"></div>`,
    onMount(m, close) {
      const box = m.querySelector(".buy");
      let draw = () => {
        box.innerHTML = `<div class="steps-bar">${["Pagar", "Comprovante", "Pronto"].map((s, i) => `<span class="${i + 1 === step ? "on" : i + 1 < step ? "done" : ""}"><b>${i + 1 < step ? "✓" : i + 1}</b>${s}</span>`).join("")}</div>` +
          (step === 1 && pix ? `<div class="pay-box"><div class="pay-amount">${fmtMoney(p.price)}</div><p>Pague <b>exatamente esse valor</b> pelo Pix usando a chave abaixo (no app do seu banco: Pix › Pagar › Chave).</p>
              <div class="pix-key"><code>${esc(pix)}</code><button class="btn sm" type="button" data-copypix>${ic("copy", "sm")}Copiar chave</button></div>
              <small>Depois de pagar, volte aqui e clique em <b>Já paguei</b>.</small></div>
              <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-next>Já paguei →</button></div>`
          : step === 1 ? `<div class="pay-box"><div class="pay-amount">${fmtMoney(p.price)}</div><p>Pague <b>exatamente esse valor</b> pelo Pix no link oficial de cobrança. Ele abre no seu navegador ou no app do banco.</p>
              <div class="pay-qr"><div class="qr-box" data-qr><small>Gerando QR Code…</small></div><div class="qr-side"><b>No celular</b><small>Aponte a câmera para o QR Code: abre a cobrança oficial do Nubank, onde dá para pagar pelo app do seu banco (QR ou Pix copia e cola).</small><b>Neste aparelho</b><a class="btn primary" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" data-paylink>${ic("arrowRight", "sm")}Abrir cobrança Pix</a><button class="btn sm" type="button" data-copylink>${ic("copy", "sm")}Copiar link de pagamento</button></div></div>
              <small>Depois de pagar, volte aqui e clique em <b>Já paguei</b>.</small></div>
              <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-next>Já paguei →</button></div>`
          : step === 2 ? `<p style="margin-top:0;color:var(--text-2)">Envie o comprovante do Pix (print ou PDF). Ele fica <b>privado</b>: só você e a equipe ADM conseguem ver.</p>
              <label class="receipt-drop${receipt ? " has" : ""}">${receipt ? (receipt.preview ? `<img src="${receipt.preview}" alt="">` : ic("file", "lg")) + `<b>${esc(receipt.name)}</b><small>${fmtSize(receipt.size)} · clique para trocar</small>` : `${ic("receipt", "lg")}<b>Escolher comprovante</b><small>PNG, JPG, WEBP ou PDF · até 8 MB</small>`}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden></label>
              <label class="field" style="margin-top:14px"><span>Observação (opcional)</span><textarea data-note maxlength="500" placeholder="Ex.: paguei pela conta do meu irmão, nome João Silva"></textarea></label>
              <div class="modal-foot"><button class="btn ghost" data-back>← Voltar</button><button class="btn primary" data-send ${receipt && receipt.id ? "" : "disabled"}>${sending ? "Enviando…" : "Enviar pedido"}</button></div>`
          : `<div class="pay-done">${ic("check", "lg")}<h3>Pedido enviado!</h3><p>Status: ${statusTag("pending")}</p><p>A equipe vai conferir se o Pix caiu na conta. Você recebe aviso quando o plano for liberado — e pode conversar com a equipe no atendimento.</p></div>
              <div class="modal-foot"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" data-ticket>Abrir atendimento</button></div>`);
      };
      const drawQr = () => {
        const box = m.querySelector("[data-qr]");
        if (!box) return;
        loadQr().then(() => {
          const q = qrcode(0, "M"); q.addData(p.link); q.make();
          box.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true, alt: "QR Code da cobrança Pix" });
        }).catch(() => { box.innerHTML = "<small>Não deu para gerar o QR. Use o botão ao lado.</small>"; });
      };
      const draw0 = draw;
      draw = () => { draw0(); if (step === 1 && !pix) drawQr(); };
      draw();
      m.addEventListener("click", e => {
        if (e.target.closest("[data-copypix]")) { navigator.clipboard.writeText(pix).then(() => toast("Chave Pix copiada.", "ok")).catch(() => {}); return; }
        if (e.target.closest("[data-copylink]")) { navigator.clipboard.writeText(p.link).then(() => toast("Link de pagamento copiado.", "ok")).catch(() => {}); return; }
        if (e.target.closest("[data-next]")) { step = 2; draw(); }
        if (e.target.closest("[data-back]")) { step = 1; draw(); }
        if (e.target.closest("[data-ticket]") && box._order) { close(); openTicket(box._order.id); }
      });
      m.addEventListener("change", async e => {
        if (!e.target.matches('input[type="file"]')) return;
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 8 * 1024 * 1024) { toast("O comprovante passa de 8 MB.", "warn"); return; }
        if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(f.type)) { toast("Envie uma imagem (PNG, JPG, WEBP) ou PDF.", "warn"); return; }
        receipt = { name: f.name, size: f.size, preview: /^image\//.test(f.type) ? URL.createObjectURL(f) : "" };
        draw();
        try { const r = await uploadBlob(f, "receipt"); receipt.id = r.id; }
        catch (err) { toast(err.message, "error"); receipt = null; }
        draw();
      });
      m.addEventListener("click", async e => {
        if (!e.target.closest("[data-send]") || sending || !receipt || !receipt.id) return;
        sending = true; draw();
        const r = await emit("order:create", { tier, cycle: q ? "q" : "m", receipt: receipt.id, note: (m.querySelector("[data-note]") || {}).value || "" });
        sending = false;
        if (r.error) { toast(r.error, "error"); draw(); return; }
        S.orders.set(r.order.id, r.order);
        box._order = r.order;
        step = 3; draw();
        if (S.view === "premium") renderPremium();
      });
    }
  });
}
function openTicket(orderId) {
  const o = S.orders.get(orderId);
  if (!o) { emit("order:get", { id: orderId }).then(r => { if (r.order) { S.orders.set(r.order.id, r.order); openDM("t." + orderId); } else toast(r.error || "Pedido não encontrado.", "error"); }); return; }
  openDM("t." + orderId);
}

/* --- painel ADM --- */
async function goAdmin() {
  if (!S.me || !(S.me.admin || S.me.mod)) { toast("Apenas a equipe.", "warn"); return; }
  setView("admin");
  S.serverId = null; S.channelId = null;
  renderAll(); updateMini();
  renderAdmin();
}
async function renderAdmin(soft) {
  const root = $("#adminView");
  if (!root || !(S.me.admin || S.me.mod)) return;
  const sup = !!S.me.supreme, modOnly = !S.me.admin;
  if (modOnly && S.adminTab !== "team") S.adminTab = "backup";
  if (!sup && !modOnly && (S.adminTab === "system" || S.adminTab === "backup")) S.adminTab = "dash";
  const tab = S.adminTab;
  clearInterval(S.admLive); S.admLive = null;
  const tabs = [["dash", "Visão geral"], ["orders", "Solicitações"], ["users", "Usuários e planos"], ["servers", "Servidores"], ["team", "Equipe"], ["games", "Jogos"], sup && ["system", "⚙️ Sistema"], sup && ["backup", "Backups"], ["audit", "Histórico"]].filter(Boolean).filter(t => !modOnly || t[0] === "backup" || t[0] === "team");
  const head = `<div class="page admin"><div class="hero adm-hero"><h1>${ic("shield", "lg")} ${modOnly ? "Painel do Moderador" : "Painel ADM"} ${sup ? `<span class="supreme-tag">ADM Supremo</span>` : ""}</h1><p>${modOnly ? "Você é <b>Moderador</b>: faça o backup e guarde no Drive do dono. O arquivo tem os dados de todo mundo — não compartilhe com ninguém." : sup ? "Acesso total: equipe, sistema, versão do app, desconexão geral e backups." : "Confira no extrato do banco se o Pix caiu antes de aprovar. Toda decisão fica registrada com o seu nome."}</p>${modOnly ? "" : `<button class="btn adm-announce" data-act="admin-broadcast">📢 Aviso geral</button>`}</div><div class="tabs-row">${tabs.map(([k, n]) => `<button class="tab${k === tab ? " on" : ""}" data-act="admin-tab" data-tab="${k}">${n}</button>`).join("")}</div><div class="adm-body"></div></div>`;
  if (!soft || !root.querySelector(".adm-body")) root.innerHTML = head;
  else root.querySelectorAll(".tabs-row .tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const body = root.querySelector(".adm-body");
  if (tab === "dash") {
    const r = await emit("admin:stats", {});
    if (r.error) { body.innerHTML = esc(r.error); return; }
    const card = (ic_, v, t, sub, cls = "") => `<div class="dash-card ${cls}"><span class="dash-ic">${ic(ic_)}</span><b>${v}</b><small>${t}</small>${sub ? `<em>${sub}</em>` : ""}</div>`;
    const dur = s => s < 3600 ? Math.round(s / 60) + " min" : s < 86400 ? Math.round(s / 3600) + " h" : Math.round(s / 86400) + " dias";
    const ok = (b, t) => `<span class="ost ${b ? "st-ok" : "st-bad"}">${t}</span>`;
    const ap = r.apps || {};
    body.innerHTML = `<div class="live-row"><span class="live-dot"></span><b>Ao vivo</b><span data-live>${r.online} online · ${r.sockets} conexões · ${r.msgsMin} msg/min · ${r.msgsHour} msg na última hora</span><small>Site ${ap.web || 0} · Android ${ap.android || 0} · PC ${ap.desktop || 0}</small></div>
    ${(r.series || []).length > 1 ? `<div class="spark-wrap"><div><span class="label">Online — últimas 24 h</span>${sparkline(r.series.map(x => x.on), "var(--green)")}</div><div><span class="label">Mensagens a cada 5 min</span>${sparkline(r.series.map(x => x.m), "var(--accent)")}</div></div>` : `<p class="hint" style="margin:0 0 14px">Os gráficos aparecem depois de alguns minutos com o servidor ligado (um ponto a cada 5 min).</p>`}
    ${r.settings && (r.settings.maintenance || !r.settings.regOpen || r.settings.minApp) ? `<div class="prem-alert">${ic("info")}<span>${[r.settings.maintenance && "🛠️ Modo manutenção ligado", !r.settings.regOpen && "🚫 Cadastros fechados", r.settings.minApp && `📲 App mínimo: Android ${esc(r.settings.minApp.android || "—")} · PC ${esc(r.settings.minApp.desktop || "—")}${r.settings.minApp.since > Date.now() ? ` (exigido em ${Math.ceil((r.settings.minApp.since - Date.now()) / 60000)} min)` : " (exigido)"}`].filter(Boolean).join(" · ")}</span>${sup ? `<button class="btn sm" data-act="admin-tab" data-tab="system">Sistema</button>` : ""}</div>` : ""}
    <div class="dash-grid">
      ${card("users", r.users, "Contas", `+${r.newDay} hoje · +${r.newWeek} na semana`)}
      ${card("signal", r.online, "Online agora", `${r.voiceNow} em call · ${r.rooms} salas`, "green")}
      ${card("message", r.msgsDay, "Mensagens nas últimas 24 h", `${r.msgs} guardadas no total`)}
      ${card("grid", r.servers, "Servidores", `${r.publicServers} públicos · ${r.blocked} bloqueados`)}
      ${card("gem", r.subs.plus + r.subs.pro + r.subs.max, "Assinantes ativos", `VIP ${r.subs.plus} · Pro ${r.subs.pro} · Max ${r.subs.max}`, "violet")}
      ${card("receipt", fmtMoney(r.revenueMonth), "Recebido este mês", `${fmtMoney(r.revenueTotal)} no total · ${r.paidCount} pagamentos`, "gold")}
      ${card("info", r.pending, "Pedidos esperando", r.pending ? "Abra Solicitações" : "Tudo em dia", r.pending ? "warn" : "")}
      ${card("shield", r.banned, "Contas suspensas", `${r.verified} com e-mail confirmado`)}
    </div>
    <div class="section-title">${ic("settings", "sm")} Estado dos serviços</div>
    <div class="svc-list">
      <div><b>Banco de dados</b>${ok(true, r.db)}</div>
      ${r.storage && r.storage.total ? `<div><b>Espaço usado</b>${ok(r.storage.total < 0.8 * r.storage.limit, fmtSize(r.storage.total) + " de " + fmtSize(r.storage.limit) + " (" + (r.storage.total / r.storage.limit * 100).toFixed(1) + "%)")}<small style="display:block;color:var(--muted)">Mensagens e contas ${fmtSize(r.storage.state)} · Arquivos ${fmtSize(r.storage.files)} (${r.storage.nFiles}) · Backups ${fmtSize(r.storage.backups)}${r.storage.gc && r.storage.gc.removed ? ` · Limpeza já apagou ${r.storage.gc.removed} arquivos sem uso (${fmtSize(r.storage.gc.bytes)})` : ""}</small></div>` : ""}
      <div><b>Último backup</b>${r.lastBackup ? ok(Date.now() - r.lastBackup < 2 * 86400e3, new Date(r.lastBackup).toLocaleString("pt-BR")) : ok(false, "nenhum ainda")}</div>
      <div><b>E-mail (Resend)</b>${ok(r.mail, r.mail ? "ligado" : "desligado")}</div>
      <div><b>Aury (IA)</b>${ok(r.ai, r.ai ? (r.aiName || "ligada") : "sem chave")}</div>
      ${r.aiStatus && (r.aiStatus.lastError || r.aiStatus.lastOk) ? `<div class="ai-diag"><b>Aury · diagnóstico</b><small>${r.aiStatus.lastOk ? `✅ Última resposta: ${esc(r.aiStatus.lastOk.provider)} em ${new Date(r.aiStatus.lastOk.at).toLocaleString("pt-BR")}` : "Nenhuma resposta desde que o servidor ligou"}${r.aiStatus.lastError ? `<br>⚠️ Último erro (${esc(r.aiStatus.lastError.provider)}, ${new Date(r.aiStatus.lastError.at).toLocaleString("pt-BR")}): ${esc(r.aiStatus.lastError.msg)}` : ""}${Object.keys(r.aiStatus.cooldown || {}).length ? `<br>⏸️ Pausado por 15 min (conta/créditos): ${esc(Object.keys(r.aiStatus.cooldown).join(", "))}` : ""}</small></div>` : ""}
      <div><b>Servidor TURN (voz em 4G)</b>${ok(r.turn, r.turn ? "ligado" : "não configurado")}</div>
      <div><b>Servidor ligado há</b><span class="ost st-rev">${dur(r.uptime)} · ${r.mem} MB</span></div>
    </div>`;
    // números ao vivo: atualiza sozinho a cada 5 s enquanto a aba está aberta
    S.admLive = setInterval(async () => {
      if (S.view !== "admin" || S.adminTab !== "dash" || document.hidden) return;
      const x = await emit("admin:stats", {});
      const el = $("#adminView [data-live]");
      if (!x.error && el) el.textContent = `${x.online} online · ${x.sockets} conexões · ${x.msgsMin} msg/min · ${x.msgsHour} msg na última hora`;
    }, 5000);
  } else if (tab === "team") {
    const r = await emit("admin:admins", {});
    if (r.error) { body.innerHTML = esc(r.error); return; }
    body.innerHTML = `<p class="hint" style="margin-top:0">${sup ? "Você é o <b>ADM Supremo</b>: só você nomeia ou tira ADMs, mexe no Sistema, baixa backups e desconecta todo mundo. Para nomear alguém, abra <b>Usuários e planos</b> e clique em <b>Tornar ADM</b>." : "A equipe que modera a Auryx Nexos. Só o ADM Supremo nomeia ou tira ADMs."}</p>` +
      r.admins.map(a => `<div class="adm-user">${avatar(a, 36)}<div class="who"><b>${esc(a.username)} ${a.supreme ? `<span class="supreme-tag">ADM Supremo</span>` : `<span class="ost st-rev">ADM</span>`}</b><small>${a.online ? "🟢 online agora" : "offline"}${a.env ? " · definido no Render (ADMIN_USERS)" : ""}</small></div><div class="ao-acts">${sup && !a.supreme && !a.env ? `<button class="btn sm danger" data-act="admin-adm-set" data-uid="${a.id}" data-on="0" data-name="${esc(a.username)}">Tirar ADM</button>` : ""}</div></div>`).join("") +
      `<h3 style="margin:18px 0 8px">Moderadores</h3><p class="hint" style="margin-top:0">Equipe de edição de vídeos, verificação de bugs, divulgação e backups (baixam e guardam no seu Drive) e ganham a etiqueta <span class="staff-tag mod">MOD</span>.</p>` +
      (sup ? `<form class="add-box" data-modadd style="max-width:340px;margin-bottom:10px"><input placeholder="Nome de usuário"><button class="btn primary">Tornar MOD</button></form>` : "") +
      ((r.mods || []).length ? r.mods.map(a => `<div class="adm-user">${avatar(a, 36)}<div class="who"><b>${esc(a.username)} <span class="staff-tag mod">MOD</span></b><small>${a.online ? "🟢 online agora" : "offline"}</small></div><div class="ao-acts">${sup ? `<button class="btn sm danger" data-act="admin-mod-set" data-uid="${a.id}" data-name="${esc(a.username)}">Tirar MOD</button>` : ""}</div></div>`).join("") : `<small class="hint">Nenhum Moderador ainda.</small>`);
  } else if (tab === "system") {
    const r = await emit("admin:settings", {});
    if (r.error) { body.innerHTML = esc(r.error); return; }
    const st = r.settings, mi = st.minApp || {};
    const linkRow = (tier, c, name) => `<label class="field"><span>${name}</span><input data-link="${tier}_${c}" placeholder="${esc(st.defaults[tier + "_" + c] || "sem link — usa a chave Pix")}" value="${esc(st.links[tier + "_" + c] || "")}"></label>`;
    body.innerHTML = `<div class="sys-grid">
      <div class="sys-card"><h3>🛠️ Acesso</h3>
        <div class="toggle-row"><span><b>Cadastros abertos</b><small>Desligue para ninguém novo criar conta</small></span><label class="switch"><input type="checkbox" data-sys="regOpen" ${st.regOpen !== false ? "checked" : ""}><i></i></label></div>
        <label class="field" style="margin-top:12px"><span>Modo manutenção (só a equipe entra)</span><input data-sys="maintenance" maxlength="300" placeholder="Vazio = desligado. Ex.: Voltamos às 22h!" value="${esc(st.maintenance || "")}"></label>
        <button class="btn primary" data-act="sys-save" data-part="access">Salvar acesso</button></div>
      <div class="sys-card"><h3>📲 Versão mínima do app</h3>
        <p class="hint">Apps de Android/PC mais antigos que isso recebem o aviso para atualizar e, passado o prazo, só entram baixando a versão nova. O site sempre usa a versão mais nova.</p>
        <div class="row-2"><label class="field"><span>Android</span><input data-min="android" placeholder="ex.: 3.0.0" value="${esc(mi.android || "")}"></label><label class="field"><span>PC (Windows)</span><input data-min="desktop" placeholder="ex.: 3.0.0" value="${esc(mi.desktop || "")}"></label></div>
        <label class="field"><span>Prazo para atualizar (minutos)</span><input data-min="grace" type="number" min="0" max="4320" value="${mi.since && mi.since > Date.now() ? Math.ceil((mi.since - Date.now()) / 60000) : 0}"></label>
        <small class="hint" style="display:block;margin:-6px 0 12px">${mi.android || mi.desktop ? (mi.since > Date.now() ? `Exigido a partir de ${new Date(mi.since).toLocaleString("pt-BR")}.` : "Já está sendo exigido.") : "Nenhuma versão mínima no momento."}</small>
        <div class="row-btns"><button class="btn primary" data-act="sys-save" data-part="min">Salvar versão</button><button class="btn ghost" data-act="sys-save" data-part="min-off">Não exigir</button></div></div>
      <div class="sys-card"><h3>💸 Pagamentos</h3>
        <label class="field"><span>Chave Pix (usada quando o plano não tem link)</span><input data-sys="pixKey" maxlength="140" placeholder="e-mail, telefone, CPF/CNPJ ou chave aleatória" value="${esc(st.pixKey || "")}"></label>
        <details><summary>Links de cobrança por plano</summary>${["plus", "pro", "max"].map(t => linkRow(t, "m", `${PLAN_NAME[t]} · mensal`) + linkRow(t, "q", `${PLAN_NAME[t]} · trimestral`)).join("")}</details>
        <button class="btn primary" data-act="sys-save" data-part="pay">Salvar pagamentos</button></div>
      <div class="sys-card danger-card"><h3>📢 Aviso fixado</h3>
        ${st.announce ? `<p><b>${esc(st.announce.title)}</b><br><small class="hint">por ${esc(st.announce.by || "?")} em ${new Date(st.announce.at).toLocaleString("pt-BR")} — aparece uma vez para cada pessoa ao entrar.</small></p><button class="btn" data-act="sys-ann-clear">Tirar o aviso fixado</button>` : `<p class="hint">Nenhum aviso fixado. Use <b>📢 Aviso geral</b> com a opção "fixar".</p>`}
        <h3 style="margin-top:20px">🔐 Desconexão geral</h3>
        <p class="hint">Encerra a sessão de <b>todas as contas em todos os aparelhos</b> (menos este). Todo mundo precisa entrar de novo.</p>
        <button class="btn danger" data-act="sys-logout-all">Desconectar todo mundo</button></div>
    </div>`;
  } else if (tab === "orders") {
    const r = await emit("order:list", { status: S.adminFilter });
    if (r.error) { body.innerHTML = `<p>${esc(r.error)}</p>`; return; }
    for (const o of r.orders) S.orders.set(o.id, o);
    const filters = [["open", "Abertas"], ["pending", "Pendentes"], ["review", "Em análise"], ["approved", "Aprovadas"], ["rejected", "Recusadas"], ["all", "Todas"]];
    body.innerHTML = `<div class="chips" style="margin-bottom:14px">${filters.map(([k, n]) => `<button class="chip${S.adminFilter === k ? " on" : ""}" data-act="admin-filter" data-f="${k}">${n}</button>`).join("")}</div>` +
      (r.orders.length ? r.orders.map(o => {
        const open = o.status === "pending" || o.status === "review";
        const rc = o.receipt;
        const recUrl = rc ? fileHref(rc) : "";
        return `<div class="adm-order"><div class="ao-user">${o.user ? avatar(o.user, 40) : ""}<div><b>${esc(o.user ? o.user.username : "?")}</b><small>${esc(o.userEmail || "sem e-mail")}</small></div></div>
          <div class="ao-plan"><b>${esc(o.plan)}</b><small>${fmtMoney(o.amount)}</small></div>
          <div class="ao-date"><small>${new Date(o.created).toLocaleString("pt-BR")}</small>${statusTag(o.status)}${o.decidedBy ? `<small>por <b>${esc(o.decidedBy)}</b>${o.reason ? ` — ${esc(o.reason)}` : ""}</small>` : ""}${o.note ? `<small class="ao-note">“${esc(o.note)}”</small>` : ""}</div>
          <div class="ao-acts">${rc ? (/^image\//.test(rc.t) ? `<button class="btn sm" data-act="receipt-view" data-src="${esc(recUrl)}">${ic("eye", "sm")}Comprovante</button>` : `<a class="btn sm" href="${esc(recUrl)}" target="_blank" rel="noopener">${ic("file", "sm")}Comprovante (PDF)</a>`) : ""}<button class="btn sm" data-act="open-ticket" data-id="${o.id}">${ic("message", "sm")}Atendimento</button>${open && o.status === "pending" ? `<button class="btn sm" data-act="order-review" data-id="${o.id}">Em análise</button>` : ""}${open ? `<button class="btn sm green" data-act="order-approve" data-id="${o.id}">Aprovar</button><button class="btn sm danger" data-act="order-reject" data-id="${o.id}">Recusar</button>` : ""}</div></div>`;
      }).join("") : `<div class="empty">${ic("receipt")}<p>Nenhuma solicitação aqui.</p></div>`);
  } else if (tab === "users") {
    body.innerHTML = `<form class="add-box" data-usearch style="margin-bottom:14px"><input placeholder="Buscar por nome ou e-mail (ou “premium”)" value="${esc(S.adminQ || "")}"><button class="btn primary">Buscar</button></form><div data-ulist></div>`;
    const list = body.querySelector("[data-ulist]");
    const r = await emit("admin:users", { q: S.adminQ || "" });
    if (r.error) { list.innerHTML = esc(r.error); return; }
    list.innerHTML = r.users.map(u => `<div class="adm-user">${avatar(u, 36)}<div class="who" data-act="admin-user" data-uid="${u.id}" role="button" tabindex="0" style="cursor:pointer" data-tip="Ver ficha completa"><b>${esc(u.username)}${u.admin ? ` <span class="ost st-rev">ADM</span>` : ""}</b><small>${esc(u.email || "sem e-mail")}${u.email && !u.emailVerified ? " (não confirmado)" : ""}</small></div><div>${u.plan ? `<span class="ost st-ok">${esc(PLAN_NAME[u.plan])}</span><small style="display:block;color:var(--muted)">até ${fmtDate(u.until)}</small>` : `<small style="color:var(--muted)">sem plano</small>`}</div><div class="ao-acts">${u.banned ? `<span class="ost st-bad" data-tip="${esc(u.banned.reason || "sem motivo")}">Suspensa</span>` : ""}${u.admin ? "" : `<button class="btn sm" data-act="admin-pass" data-uid="${u.id}" data-name="${esc(u.username)}">🔑 Senha</button>`}${sup && !u.admin && !u.banned ? `<button class="btn sm" data-act="admin-adm-set" data-uid="${u.id}" data-on="1" data-name="${esc(u.username)}">🛡️ Tornar ADM</button>` : ""}<button class="btn sm" data-act="admin-grant" data-uid="${u.id}" data-name="${esc(u.username)}">Dar plano</button>${u.plan ? `<button class="btn sm danger" data-act="admin-revoke" data-uid="${u.id}" data-name="${esc(u.username)}">Revogar</button>` : ""}${u.admin ? "" : u.banned ? `<button class="btn sm green" data-act="admin-unban" data-uid="${u.id}" data-name="${esc(u.username)}">Reativar conta</button>` : `<button class="btn sm danger" data-act="admin-ban" data-uid="${u.id}" data-name="${esc(u.username)}">Suspender</button>`}</div></div>`).join("") || `<p style="color:var(--muted)">Ninguém encontrado.</p>`;
  } else if (tab === "servers") {
    const f = S.adminSrvF || "active";
    body.innerHTML = `<div class="adm-games-head"><div class="chips"><button class="chip${f === "active" ? " on" : ""}" data-act="admin-srv-f" data-f="active">Ativos</button><button class="chip${f === "blocked" ? " on" : ""}" data-act="admin-srv-f" data-f="blocked">🔒 Bloqueados <b data-bcount></b></button></div><form class="add-box" data-ssearch style="flex:1;max-width:380px"><input placeholder="Buscar servidor ou dono" value="${esc(S.adminSrvQ || "")}"><button class="btn primary">Buscar</button></form></div><div data-slist><p style="color:var(--muted)">Carregando…</p></div>`;
    const r = await emit("admin:servers", { q: S.adminSrvQ || "", filter: f === "blocked" ? "blocked" : "active" });
    const list = body.querySelector("[data-slist]");
    if (!list) return;
    if (r.error) { list.innerHTML = esc(r.error); return; }
    body.querySelector("[data-bcount]").textContent = r.blocked ? `(${r.blocked})` : "";
    list.innerHTML = r.servers.length ? r.servers.map(x => `<div class="adm-user adm-srv${x.blocked ? " is-blocked" : ""}">${serverIcon(x)}<div class="who"><b>${esc(x.name)}${x.public ? ` <span class="ost st-rev">Público</span>` : ""}</b><small>Dono: <span class="ow">${esc(x.owner)}</span> · ${x.members} membro${x.members === 1 ? "" : "s"} (${x.online} online) · ${x.channels} canais · criado em ${fmtDate(x.created)}</small>${x.blocked ? `<small class="ao-note">🔒 Bloqueado por ${esc(x.blocked.by)} em ${fmtDate(x.blocked.at)}${x.blocked.reason ? " — " + esc(x.blocked.reason) : ""}</small>` : ""}</div><div class="ao-acts">${x.blocked ? `<button class="btn sm green" data-act="admin-srv-unblock" data-id="${x.id}">Desbloquear</button>` : `<button class="btn sm" data-act="admin-srv-block" data-id="${x.id}" data-name="${esc(x.name)}">🔒 Bloquear</button>`}<button class="btn sm danger" data-act="admin-srv-del" data-id="${x.id}" data-name="${esc(x.name)}">${ic("trash", "sm")}Excluir</button></div></div>`).join("")
      : `<div class="empty">${ic("grid")}<p>${f === "blocked" ? "Nenhum servidor bloqueado." : "Nenhum servidor encontrado."}</p></div>`;
  } else if (tab === "games") {
    if (!(await loadGames(true))) { body.innerHTML = `<p>Não deu para carregar os jogos.</p>`; return; }
    body.innerHTML = `<div class="adm-games-head"><p>Os jogos aparecem para todo mundo na aba <b>Jogos</b>. Só endereços <b>https://</b> são aceitos.</p><button class="btn primary" data-act="admin-game-edit">${ic("plus", "sm")}Adicionar jogo</button></div>` +
      (S.games.length ? S.games.map(g => `<div class="adm-user adm-game"><div class="ag-thumb">${gameCover(g)}</div><div class="who"><b>${esc(g.name)}</b><small>${esc(g.category || "sem categoria")} · ${esc(hostOf(g.url))}${g.embed ? "" : " · abre em nova aba"}</small></div><div>${gameTag(g)}</div><div class="ao-acts"><button class="btn sm" data-act="admin-game-edit" data-id="${g.id}">${ic("edit", "sm")}Editar</button><button class="btn sm danger" data-act="admin-game-del" data-id="${g.id}">${ic("trash", "sm")}Remover</button></div></div>`).join("")
        : `<div class="empty">${ic("gamepad")}<p>Nenhum jogo no catálogo.</p></div>`);
  } else if (tab === "backup") {
    const r = await emit("admin:backups", {});
    if (r.error) { body.innerHTML = esc(r.error); return; }
    const when = t => new Date(t).toLocaleString("pt-BR");
    const mail = r.mail ? (r.mail.ok ? `<span class="ost st-ok">enviado</span> em ${when(r.mail.at)}` : `<span class="ost st-bad">não enviado</span> — ${esc(r.mail.error || "")}`) : "ainda não enviado";
    const drv = r.drive && r.drive.on ? (r.drive.last ? (r.drive.last.ok ? `<span class="ost st-ok">enviado</span> em ${when(r.drive.last.at)} (guarda as ${r.drive.keep} últimas; as antigas vão para a lixeira do Drive)` : `<span class="ost st-bad">falhou</span> — ${esc(r.drive.last.error || "")}`) : "ligado, aguardando o próximo backup") : "não configurado (veja GDRIVE_* no Render)";
    const encTxt = r.enc ? `<span class="ost st-ok">criptografado</span> (guarde a senha BACKUP_KEY fora do Render: sem ela o backup não abre)` : `<span class="ost st-bad">sem criptografia</span> — defina BACKUP_KEY no Render`;
    const errTxt = r.lastError ? `<small style="display:block;margin-top:6px;color:var(--red)">Último erro (${when(r.lastError.at)}): ${esc(r.lastError.error)}</small>` : "";
    const why = b => (b.reason === "manual" ? "Feito na mão" : /^antes/.test(b.reason) ? "Antes de uma atualização (fica 30 dias)" : "Automático");
    body.innerHTML = `<div class="adm-games-head"><p>Uma cópia completa (contas, servidores, pedidos e <b>todas</b> as mensagens) é feita <b>todo dia</b> automaticamente e conferida depois de gravada. Ficam guardadas as <b>${r.keep} últimas</b>. Baixe e guarde no seu PC de vez em quando — se o banco sumir, é com ela que tudo volta (script <span class="kbd">scripts/restaurar-backup.js</span>). <small style="display:block;margin-top:6px;color:var(--muted)">Proteção: ${encTxt}.<br>Google Drive: ${drv}.<br>Cópia por e-mail para o dono: ${mail}. Imagens e vídeos enviados não entram no backup.</small>${errTxt}</p><button class="btn primary" data-act="admin-backup-now" ${r.running ? "disabled" : ""}>${ic("download", "sm")}Fazer backup agora</button></div>` +
      (r.list.length ? r.list.map(b => `<div class="adm-user"><span class="ag-ico">${ic("receipt")}</span><div class="who"><b>${when(b.at)}</b><small>${why(b)} · ${fmtSize(b.size)} · ${b.ok ? `<span class="ost st-ok">conferido</span>` : `<span class="ost st-pend">não conferido</span>`}${b.enc ? " · 🔒 criptografado" : ""}</small></div><div class="ao-acts">${sup || modOnly ? `<button class="btn sm" data-act="admin-backup-dl" data-id="${esc(b.id)}" data-enc="${b.enc ? 1 : 0}">${ic("download", "sm")}Baixar</button>` : ""}</div></div>`).join("")
        : `<div class="empty">${ic("receipt")}<p>Nenhum backup ainda. O primeiro é feito alguns minutos depois que o servidor liga — ou clique em <b>Fazer backup agora</b>.</p></div>`);
  } else {
    const r = await emit("admin:audit", { q: S.auditQ || "", action: S.auditA || "" });
    if (r.error) { body.innerHTML = esc(r.error); return; }
    const NAMES = { "order:approve": "Aprovou pedido", "order:reject": "Recusou pedido", "order:review": "Pôs em análise", "plan:grant": "Deu plano", "plan:revoke": "Revogou plano", "game:save": "Salvou jogo", "game:delete": "Removeu jogo", "server:block": "Bloqueou servidor de", "server:unblock": "Desbloqueou servidor de", "server:delete": "Excluiu servidor de", "user:ban": "Suspendeu", "user:unban": "Reativou", "broadcast": "Enviou aviso geral", "backup:now": "Fez backup do banco", "user:setpass": "Trocou a senha de", "user:logout": "Desconectou de tudo", "user:verify": "Confirmou o e-mail de", "admin:add": "Tornou ADM", "mod:add": "Tornou Moderador", "mod:remove": "Tirou o MOD de", "admin:remove": "Tirou o ADM de", "settings": "Mudou o sistema", "logout:all": "Desconectou todo mundo", "announce:clear": "Tirou o aviso fixado", "migration": "Atualização automática", "backup:fail": "Backup com problema" };
    const ACTS = [["", "Tudo"], ["order", "Pedidos"], ["plan", "Planos"], ["user", "Contas"], ["server", "Servidores"], ["admin", "Equipe"], ["settings", "Sistema"], ["broadcast", "Avisos"], ["game", "Jogos"]];
    body.innerHTML = `<div class="adm-games-head"><div class="chips">${ACTS.map(([k, n]) => `<button class="chip${(S.auditA || "") === k ? " on" : ""}" data-act="audit-a" data-a="${k}">${n}</button>`).join("")}</div><form class="add-box" data-asearch style="flex:1;max-width:340px"><input placeholder="Buscar por nome, motivo…" value="${esc(S.auditQ || "")}"><button class="btn primary">Buscar</button></form></div><small class="hint" style="display:block;margin:-4px 0 10px">${r.entries.length} de ${r.total} registros</small>` + (r.entries.length ? `<div class="audit">${r.entries.map(e => `<div class="au-row"><small>${new Date(e.at).toLocaleString("pt-BR")}</small><b>${esc(e.adminName)}</b><span>${esc(NAMES[e.action] || e.action)}</span><span>→ ${esc(e.targetName === "?" && e.details && e.details.game ? e.details.game : e.targetName)}</span><small>${esc([(e.details || {}).tier, e.details && e.details.days ? e.details.days + " dias" : "", e.details.amount ? fmtMoney(e.details.amount) : "", e.details.server ? "“" + e.details.server + "”" : "", e.details.reason].filter(Boolean).join(" · "))}</small></div>`).join("")}</div>` : `<div class="empty">${ic("shield")}<p>Nenhuma ação encontrada.</p></div>`);
  }
}
/* --- chamada privada (conversa ou grupo) --- */
const dmCallOn = cid => [...S.voice.values()].some(v => v.channelId === cid);
const dmCallTag = cid => dmCallOn(cid) ? `<span class="dm-call" data-tip="Em chamada">${ic("phone", "xs")}</span>` : "";
function callBtn(cid) {
  const inIt = V.channelId === cid, on = dmCallOn(cid);
  return `<button class="icon-btn call-btn${on ? " live" : ""}" data-act="dm-call" data-id="${cid}" data-tip="${inIt ? "Voltar para a chamada" : on ? "Entrar na chamada" : "Iniciar chamada de voz"}">${ic("phone")}</button>`;
}
function openDMCall(cid, join = true) {
  if (!S.dms.get(cid)) return;
  if (S.view === "chat" && S.channelId) S.drafts[S.channelId] = $("#input").value;
  S.serverId = null; S.channelId = cid;
  setView("stage");
  if (join && V.channelId !== cid) joinVoice(cid);
  renderRail(); renderSide(); renderTop(); renderMembers(); renderStage(); updateMini();
}
const RING = { el: null, cid: null, t: 0, snd: 0 };
function stopRing(cid) {
  if (cid && RING.cid !== cid) return;
  clearTimeout(RING.t); clearInterval(RING.snd);
  if (RING.el) RING.el.remove();
  RING.el = RING.cid = null;
}
function showRing({ channelId, from }) {
  if (V.channelId === channelId || !S.dms.get(channelId)) return;
  stopRing();
  const d = S.dms.get(channelId), u = user(from);
  const el = document.createElement("div");
  el.className = "ring";
  el.setAttribute("role", "alertdialog");
  el.innerHTML = `<div class="ring-av">${avatar(u, 72)}</div><b>${esc(u.username)}</b><small>${d.group ? `está ligando no grupo ${esc(groupTitle(d))}` : "está te ligando…"}</small>
    <div class="ring-acts"><button class="ring-btn no" data-ring="no" aria-label="Recusar">${ic("phoneOff")}</button><button class="ring-btn yes" data-ring="yes" aria-label="Atender">${ic("phone")}</button></div>`;
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-ring]");
    if (!b) return;
    stopRing();
    if (b.dataset.ring === "yes") openDMCall(channelId);
    else emit("call:decline", { channelId });
  });
  document.body.append(el);
  RING.el = el; RING.cid = channelId;
  const beep = () => { try { sfx("mention"); } catch {} if (navigator.vibrate) try { navigator.vibrate([200, 120, 200]); } catch {} };
  beep(); RING.snd = setInterval(beep, 2200);
  RING.t = setTimeout(() => stopRing(channelId), 45000);   // ninguém atendeu
  if (document.hidden) {   // app em segundo plano: aviso do sistema
    const t = `📞 ${u.username} está te ligando`;
    if (ANDROID && ANDROID.notify) { try { ANDROID.notify(t, "Toque para atender", "/?atender=" + encodeURIComponent(channelId)); } catch {} }
    else if ("Notification" in window && Notification.permission === "granted") { try { const n = new Notification(t, { body: "Clique para atender", tag: "call:" + channelId, requireInteraction: true }); n.onclick = () => { window.focus(); n.close(); stopRing(); openDMCall(channelId); }; } catch {} }
  }
}

/* --- ADM: servidores, contas e aviso geral --- */
function admReason(title, sub, label, btn, ph, run) {
  modal({
    title, sub,
    body: `<label class="field"><span>${label}</span><textarea data-r maxlength="300" placeholder="${ph}"></textarea></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go>${btn}</button></div>`,
    onMount(m, close) {
      const go = m.querySelector("[data-go]");
      go.onclick = async () => { go.classList.add("loading"); const ok = await run(m.querySelector("[data-r]").value.trim()); go.classList.remove("loading"); if (ok) close(); };
    }
  });
}
const admRun = async (ev, data, msg) => { const r = await emit(ev, data); if (r.error) { toast(r.error, "error"); return false; } toast(msg, "ok"); renderAdmin(true); return true; };
function adminSrvBlock(id, name) {
  admReason("Bloquear servidor", esc(name), "Motivo (os membros vão ver)", "🔒 Bloquear", "Ex.: conteúdo proibido / golpe / spam",
    reason => admRun("admin:server:block", { serverId: id, reason }, "Servidor bloqueado. Ele está na pasta Bloqueados."));
}
function adminSrvDelete(id, name) {
  modal({
    title: "Excluir servidor", sub: esc(name),
    body: `<p style="color:var(--text-2)">Isso apaga <b>para sempre</b> o servidor, todos os canais e todas as mensagens. Não dá para desfazer. Se quiser só tirar do ar, use <b>Bloquear</b>.</p><label class="field"><span>Digite o nome do servidor para confirmar</span><input data-c placeholder="${esc(name)}" autocomplete="off"></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go disabled>Excluir para sempre</button></div>`,
    onMount(m, close) {
      const inp = m.querySelector("[data-c]"), go = m.querySelector("[data-go]");
      inp.oninput = () => { go.disabled = inp.value !== name; };
      go.onclick = async () => { if (await admRun("admin:server:delete", { serverId: id, confirm: inp.value }, "Servidor excluído.")) close(); };
    }
  });
}
function adminBan(uid, name) {
  admReason("Suspender conta", esc(name), "Motivo (a pessoa vai ver)", "Suspender", "Ex.: golpe / ofensas / spam",
    reason => admRun("admin:ban", { userId: uid, reason }, `Conta de ${name} suspensa.`));
}
/* ficha completa de um usuário (Painel ADM) */
async function adminUserCard(uid) {
  const r = await emit("admin:user", { userId: uid });
  if (r.error) { toast(r.error, "error"); return; }
  const u = r.user, ST = { pending: "Pendente", review: "Em análise", approved: "Aprovado", rejected: "Recusado", expired: "Expirado" };
  modal({
    title: esc(u.username), sub: `${u.admin ? "ADM · " : ""}conta criada em ${fmtDate(u.created)}`, cls: "wide",
    body: `<div class="uc-head">${avatar(u, 64, true)}<div><b>${esc(u.username)}</b><small>${esc(u.email || "sem e-mail")} ${u.email ? (u.emailVerified ? '<span class="ost st-ok">confirmado</span>' : '<span class="ost st-pend">não confirmado</span>') : ""}</small><small>${r.online ? '<span class="ost st-ok">online agora</span>' : "offline"} · ${r.friends} amigos · ${r.ai} mensagens com a Aury</small>${u.banned ? `<small><span class="ost st-bad">suspensa</span> ${esc(u.banned.reason || "")}</small>` : ""}</div></div>
      <div class="uc-grid">
        <div><span class="label">Plano</span><p>${u.plan ? `<b>${esc(PLAN_NAME[u.plan])}</b> até ${fmtDate(u.planUntil)}` : "Sem plano"}</p></div>
        <div><span class="label">Aparelhos conectados</span><p>${r.sessions.length ? r.sessions.map(x => `${esc(x.dev)} <small>(ativo ${fmtDate(x.last)})</small>`).join("<br>") : "nenhum"}</p></div>
        <div><span class="label">Servidores (${r.servers.length})</span><p>${r.servers.slice(0, 12).map(x => `${esc(x.name)}${x.owner ? " 👑" : ""} <small>${x.members} membros${x.blocked ? " · bloqueado" : ""}</small>`).join("<br>") || "nenhum"}</p></div>
        <div><span class="label">Pagamentos</span><p>${r.orders.map(o => `${esc(o.plan)} · ${fmtMoney(o.amount)} · ${ST[o.status] || o.status} <small>${fmtDate(o.created)}</small>`).join("<br>") || "nenhum"}</p></div>
      </div>
      <div class="modal-foot uc-acts">
        ${u.admin ? "" : `<button class="btn sm" data-uc="logout">${ic("logout", "sm")}Desconectar de tudo</button>`}
        ${u.email && !u.emailVerified ? `<button class="btn sm" data-uc="verify">${ic("check", "sm")}Confirmar e-mail</button>` : ""}
        ${u.admin ? "" : `<button class="btn sm" data-uc="pass">🔑 Senha</button><button class="btn sm" data-uc="rename">✏️ Nome</button><button class="btn sm" data-uc="grant">${ic("gem", "sm")}Dar plano</button>${u.banned ? `<button class="btn sm green" data-uc="unban">Reativar</button>` : `<button class="btn sm danger" data-uc="ban">Suspender</button>`}`}
      </div>`,
    onMount(m, close) {
      m.addEventListener("click", async e => {
        const b = e.target.closest("[data-uc]");
        if (!b) return;
        const k = b.dataset.uc;
        if (k === "logout") { if (!confirm(`Desconectar ${u.username} de todos os aparelhos?`)) return; const x = await emit("admin:user:logout", { userId: uid }); if (x.error) toast(x.error, "error"); else { toast(`${x.ended} aparelho(s) desconectado(s).`, "ok"); close(); } }
        if (k === "verify") { const x = await emit("admin:user:verify", { userId: uid }); if (x.error) toast(x.error, "error"); else { toast("E-mail confirmado.", "ok"); close(); renderAdmin(true); } }
        if (k === "pass") { close(); adminSetPass(uid, u.username); }
        if (k === "rename") { close(); renameDialog(u.username, uid); }
        if (k === "grant") { close(); const g = document.querySelector(`[data-act="admin-grant"][data-uid="${uid}"]`); if (g) g.click(); }
        if (k === "ban") { close(); adminBan(uid, u.username); }
        if (k === "unban") { close(); const x = await emit("admin:unban", { userId: uid }); if (x.error) toast(x.error, "error"); else { toast("Conta reativada.", "ok"); renderAdmin(true); } }
      });
    }
  });
}
// Trocar nome de usuário: sem uid = o próprio (1 vez a cada 7 dias); com uid = ADM trocando o de outra pessoa
function renameDialog(cur, uid) {
  modal({
    title: "✏️ Trocar nome de usuário", sub: esc(cur),
    body: `<p style="color:var(--text-2)">${uid ? "A pessoa passa a entrar com o nome novo. Avise ela." : "Você passa a entrar com o nome novo. Dá para trocar de novo depois de 7 dias."}</p><label class="field"><span>Novo nome (3 a 24: letras, números, _ . -)</span><input data-n type="text" maxlength="24" autocomplete="off" spellcheck="false" value="${esc(cur)}"></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Salvar nome</button></div>`,
    onMount(m, close) {
      const go = m.querySelector("[data-go]"), inp = m.querySelector("[data-n]");
      inp.focus(); inp.select();
      const run = async () => {
        go.classList.add("loading");
        const r = await emit(uid ? "admin:rename" : "profile:rename", uid ? { userId: uid, name: inp.value } : { name: inp.value });
        go.classList.remove("loading");
        if (r.error) { toast(r.error, "error"); return; }
        toast(`Nome trocado para ${r.username}. ✅`, "ok");
        close();
        if (uid && typeof renderAdmin === "function") renderAdmin(true);
      };
      go.onclick = run;
      inp.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
    }
  });
}
document.addEventListener("click", e => { if (e.target.closest("[data-rename-me]") && S.me) renameDialog(S.me.username); });
function adminSetPass(uid, name) {
  modal({
    title: "🔑 Alterar senha", sub: esc(name),
    body: `<p style="color:var(--text-2)">A pessoa vai sair de todos os aparelhos e precisará entrar com a nova senha. Avise ela qual é.</p><label class="field"><span>Nova senha (8+ caracteres, letras e números)</span><input data-p type="text" maxlength="128" autocomplete="off" spellcheck="false"></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Salvar senha</button></div>`,
    onMount(m, close) {
      const go = m.querySelector("[data-go]");
      go.onclick = async () => { go.classList.add("loading"); const ok = await admRun("admin:setpass", { userId: uid, password: m.querySelector("[data-p]").value }, `Senha de ${name} alterada.`); go.classList.remove("loading"); if (ok) close(); };
    }
  });
}
function adminBroadcast() {
  const sup = !!S.me.supreme;
  modal({
    title: "📢 Aviso geral", sub: sup ? "Para todo mundo — online agora, e também quem entrar depois se você fixar" : "Aparece na tela de todo mundo que está online agora",
    body: `<label class="field"><span>Título</span><input data-ti maxlength="80" placeholder="Aviso da equipe Auryx"></label>
      <label class="field"><span>Mensagem</span><textarea data-t maxlength="1500" rows="5" placeholder="Ex.: Manutenção hoje às 22h, o app pode cair por 5 minutos."></textarea></label>
      ${sup ? `<div class="toggle-row"><span><b>Fixar o aviso</b><small>Quem entrar depois também vê (uma vez por pessoa)</small></span><label class="switch"><input type="checkbox" data-keep><i></i></label></div>
      <div class="toggle-row"><span><b>Mandar notificação</b><small>Chega até com o app fechado, para quem ligou as notificações</small></span><label class="switch"><input type="checkbox" data-push><i></i></label></div>` : ""}
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Enviar para todos</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = async () => {
        const r = await emit("admin:broadcast", { title: m.querySelector("[data-ti]").value.trim(), text: m.querySelector("[data-t]").value.trim(), keep: !!m.querySelector("[data-keep]")?.checked, push: !!m.querySelector("[data-push]")?.checked });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast(`Aviso enviado${r.push ? ` · ${r.push} notificações` : ""}.`, "ok");
      };
    }
  });
}
/* gráfico de linha pequeno (SVG) para o painel */
function sparkline(vals, color) {
  const w = 320, h = 64, max = Math.max(1, ...vals), n = vals.length;
  const pts = vals.map((v, i) => `${((i / Math.max(1, n - 1)) * w).toFixed(1)},${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="máximo ${max}"><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}" fill-opacity=".12" stroke="none"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg><small class="spark-meta">agora ${vals[n - 1]} · pico ${max}</small>`;
}
function showAnnounce({ id, title, text, by }) {
  try { sfx("mention"); } catch {}
  if (id && S.me) store.set("ann:" + S.me.id + ":" + id, 1);
  if (id && S.me) store.set("news", NEWS_ID);   // o aviso já traz as novidades
  modal({ title: esc(title || "📢 Aviso da equipe Auryx"), sub: by ? `por ${esc(by)}` : "", cls: "announce-modal",
    body: `<div class="ann-logo" data-logo></div><p class="ann-text">${esc(text)}</p><div class="modal-foot"><button class="btn primary" data-close>Entendi</button></div>`,
    onMount(m) { const l = m.querySelector("[data-logo]"); if (l) l.innerHTML = LOGO(); } });
}
/* limite de caracteres por mensagem (aumenta com o plano) */
function applyLimits(max) {
  if (max) S.msgMax = max;
  else if (S.me && S.me.msgMax) S.msgMax = S.me.msgMax;
  const inp = $("#input");
  if (inp && S.msgMax) inp.maxLength = S.msgMax;
}
/* app de Android/PC desatualizado: aviso (no prazo) e tela de bloqueio (depois do prazo) */
const appKindName = k => (k === "android" ? "Android" : "PC (Windows)");
function showOutdated(o) {
  if (!o || !o.url) return;
  const left = o.since ? Math.max(0, Math.ceil((o.since - Date.now()) / 60000)) : 0;
  modal({
    title: "📲 Atualize o app", sub: `Auryx Nexos para ${appKindName(o.kind)}`,
    body: `<p style="color:var(--text-2)">Saiu a versão nova do app (${esc(o.min)} ou mais nova). ${left ? `A versão que você usa para de funcionar em <b>${left} min</b>.` : ""} Baixe e instale por cima — suas conversas e servidores continuam todos lá.</p>
      <div class="modal-foot"><button class="btn ghost" data-close>Depois</button><a class="btn primary" href="${esc(o.url)}" target="_blank" rel="noopener">${ic("download", "sm")}Baixar a versão nova</a></div>`
  });
}
function showUpdateRequired(o) {
  hideBoot();
  $("#app").classList.add("hidden");
  $("#auth").classList.add("hidden");
  let el = $("#blockScreen");
  if (!el) { el = document.createElement("div"); el.id = "blockScreen"; el.className = "block-screen"; document.body.append(el); }
  el.innerHTML = `<div class="block-card"><div class="block-logo" data-logo>${LOGO()}</div><h1>Atualize a Auryx Nexos</h1>
    <p>O app mudou de nome e ganhou uma versão nova. Esta versão ${o.ver && o.ver !== "0" ? `(${esc(o.ver)}) ` : ""}do app para ${esc(appKindName(o.kind))} não é mais aceita.</p>
    <a class="btn primary big" href="${esc(o.url || "/site")}" target="_blank" rel="noopener">${ic("download", "sm")}Baixar o app novo</a>
    <small>Depois de instalar, abra o app e entre com seu usuário e senha. Também dá para usar pelo navegador: <a href="${esc(location.origin)}" target="_blank" rel="noopener">${esc(location.host)}</a></small></div>`;
}
function showMaintenance(text) {
  hideBoot();
  $("#app").classList.add("hidden");
  let el = $("#blockScreen");
  if (!el) { el = document.createElement("div"); el.id = "blockScreen"; el.className = "block-screen"; document.body.append(el); }
  el.innerHTML = `<div class="block-card"><div class="block-logo">${LOGO()}</div><h1>Em manutenção 🛠️</h1><p>${esc(text || "A Auryx Nexos está em manutenção. Volte daqui a pouco!")}</p><button class="btn primary" onclick="location.reload()">Tentar de novo</button></div>`;
}

/* aviso (uma vez por aparelho) para quem é administrador */
function adminWelcome() {
  store.set("admOk:" + S.me.id, true);
  modal({
    title: "🛡️ Você é administrador", sub: `Bem-vindo, ${esc(S.me.username)}!`,
    body: `<p style="color:var(--text-2)">Sua conta é <b>ADM da Auryx Nexos</b>. Você pode aprovar pagamentos Pix, dar ou revogar planos, cadastrar jogos e ver o histórico — tudo pelo <b>Painel ADM</b> (o escudo na barra da esquerda).</p>
      <div class="modal-foot"><button class="btn ghost" data-close>Depois</button><button class="btn primary" data-go>${ic("shield", "sm")}Abrir Painel ADM</button></div>`,
    onMount(m, close) { m.querySelector("[data-go]").onclick = () => { close(); goAdmin(); }; }
  });
  toast("Você é administrador do app 🛡️", "ok", 5000);
}
/* --- catálogo de jogos ---
   A lista vem do servidor (os ADMs cadastram pelo painel). O jogo abre num quadro isolado
   (sandbox, sem referer): ele não lê nada da Auryx — nem login, nem mensagens. */
const GP = { game: null, el: null, chip: null, loaded: false, t: 0 };
const GSTATUS = { on: ["Disponível", "st-ok"], soon: ["Em breve", "st-pend"], off: ["Indisponível", "st-bad"] };
const hostOf = u => { try { return new URL(u).host; } catch { return ""; } };
const gameTag = g => { const s = GSTATUS[g.status] || GSTATUS.on; return `<span class="ost ${s[1]}">${s[0]}</span>`; };
const gameCats = () => [...new Set((S.games || []).map(g => g.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
const gameById = id => (S.games || []).find(g => g.id === id);
async function loadGames(force) {
  if (S.games && !force) return true;
  if (LOCAL) { S.games = S.games || []; return true; }
  const r = await emit("games:list", {});
  if (r.error) { toast(r.error, "error"); return false; }
  S.games = r.games;
  return true;
}
/* ------------------------------------------------------------------ */
/* Aury — IA exclusiva dos assinantes VIP (e atendente do pagamento)   */
/* ------------------------------------------------------------------ */
const AURY = { id: "aury", username: "Aury (IA)", color: "#8b5cf6", avatar: "🤖", status: "online", about: "Assistente com inteligência artificial da Auryx Nexos.", created: 0, bot: true };
const AIS = { loaded: false, on: false, tier: "", limit: 0, limits: { plus: 60, pro: 200, max: 500 }, used: 0, msgs: [], pending: null, busy: false };
const AI_SUGGEST = ["Me dá ideias de nome para meu servidor de jogos", "Como transmito a tela do celular na call?", "Me ajuda a escrever as regras do meu servidor", "Me recomenda jogos para jogar com amigos"];
async function goAI() {
  setView("ai");
  S.serverId = null; S.channelId = null;
  store.set("last", { view: "ai" });
  if (!AIS.loaded) $("#aiView").innerHTML = `<div class="page"><div class="hero"><h1>${ic("sparkles", "lg")} Carregando a Aury…</h1></div></div>`;
  else renderAIView();
  renderAll(); updateMini();
  const r = await emit("ai:state", {});
  if (r.error) { toast(r.error, "error"); return; }
  Object.assign(AIS, { loaded: true, on: r.on, tier: r.tier, limit: r.limit, limits: r.limits || AIS.limits, used: r.used, msgs: r.msgs || [], busy: !!r.busy });
  if (S.view === "ai") { renderAIView(true); renderSide(); }
}
function aiBubble(m, last) {
  const mine = m.r === "u", done = !mine && m !== AIS.pending && m.t;
  const body = m.t ? renderText(m.t).html : `<span class="ai-dots"><i></i><i></i><i></i></span>`;
  // resposta pronta: copiar; a última (ou com erro / interrompida) pode ser gerada de novo
  const acts = done ? `<div class="ai-acts">${m.x ? `<small class="ai-cut">resposta interrompida</small>` : ""}${m.err ? "" : `<button type="button" class="btn ghost sm" data-ai-copy="${esc(m.id)}">${ic("copy", "xs")}Copiar</button>`}${last && !AIS.busy ? `<button type="button" class="btn ghost sm" data-ai-retry>${ic("refresh", "xs")}Tentar de novo</button>` : ""}</div>` : "";
  return `<div class="ai-msg${mine ? " me" : ""}${m.err ? " err" : ""}" data-id="${esc(m.id)}">${mine ? "" : `<span class="ai-av">🤖</span>`}<div class="ai-b">${body}${acts}</div></div>`;
}
function renderAIView(scroll) {
  const root = $("#aiView");
  if (!root) return;
  if (!AIS.tier) {
    root.innerHTML = `<div class="page ai-lock"><div class="ai-orb">🤖</div><h1>Conheça a <span class="grad">Aury</span></h1><p>Uma inteligência artificial só sua, para conversar sobre qualquer coisa: jogos, estudos, ideias, textos e dúvidas sobre o app. Responde na hora, em português.</p><ul><li>💠 <b>Plus</b> — ${AIS.limits.plus} mensagens por dia</li><li>💎 <b>Pro</b> — ${AIS.limits.pro} mensagens por dia</li><li>👑 <b>Max</b> — ${AIS.limits.max} mensagens por dia</li></ul><button class="btn primary big" style="width:auto;padding:0 28px" data-act="premium">${ic("gem", "sm")} Ver planos VIP</button><small>Exclusiva para assinantes do VIP.</small></div>`;
    return;
  }
  if (!root.querySelector(".ai-wrap")) {
    root.innerHTML = `<div class="ai-wrap"><div class="ai-list" id="aiList"></div><form class="ai-form" id="aiForm"><textarea id="aiInput" rows="1" maxlength="4000" placeholder="Mensagem para a Aury…"></textarea><button class="icon-btn send" aria-label="Enviar">${ic("send")}</button></form><div class="ai-foot" id="aiFoot"></div></div>`;
    const inp = $("#aiInput");
    inp.addEventListener("input", () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 180) + "px"; });
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendAI(); } });
    $("#aiForm").onsubmit = e => { e.preventDefault(); if (AIS.busy) stopAI(); else sendAI(); };
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-ai-sug]");
      if (b) { inp.value = b.dataset.aiSug; sendAI(); return; }
      const cp = e.target.closest("[data-ai-copy]");
      if (cp) { const m = AIS.msgs.find(x => x.id === cp.dataset.aiCopy); if (m) navigator.clipboard.writeText(m.t).then(() => toast("Resposta copiada.", "ok"), () => toast("Não deu para copiar.", "error")); return; }
      if (e.target.closest("[data-ai-retry]")) retryAI();
    });
    scroll = true;
  }
  const list = $("#aiList");
  const msgs = AIS.pending ? [...AIS.msgs, AIS.pending] : AIS.msgs;
  list.innerHTML = (!AIS.on ? `<div class="hint" style="margin:12px auto;max-width:560px">⚠️ A Aury ainda não foi ligada pela equipe. Assim que for, ela aparece aqui.</div>` : "") +
    (msgs.length ? msgs.map((m, i) => aiBubble(m, i === msgs.length - 1)).join("") : `<div class="ai-hello"><div class="ai-orb">🤖</div><h2>Oi, ${esc(S.me.username)}! Eu sou a Aury.</h2><p>Sua IA exclusiva do VIP. Pergunte o que quiser 👇</p><div class="ai-sugs">${AI_SUGGEST.map(t => `<button type="button" class="ai-sug" data-ai-sug="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>`);
  $("#aiFoot").innerHTML = `<span>${AIS.used}/${AIS.limit} mensagens hoje · plano ${esc(PLAN_NAME[AIS.tier] || "")}</span><small>A Aury é uma IA e pode errar. Não envie senhas nem dados de pagamento.</small>`;
  // enquanto a Aury responde, o botão de enviar vira "Parar"
  const send = $("#aiForm .send");
  if (send) {
    send.disabled = !AIS.on;
    send.innerHTML = ic(AIS.busy ? "x" : "send");
    send.setAttribute("aria-label", AIS.busy ? "Parar resposta" : "Enviar");
    send.dataset.tip = AIS.busy ? "Parar resposta" : "";
  }
  if (scroll) list.scrollTop = list.scrollHeight;
}
async function stopAI() {
  const r = await emit("ai:stop", {});
  if (r.error) toast(r.error, "error");
}
async function retryAI() {
  if (AIS.busy) return;
  AIS.busy = true;
  const r = await emit("ai:retry", {});
  if (r.error) { AIS.busy = false; toast(r.error, "error", 6000); renderAIView(); return; }
  // tira a resposta antiga (ou o aviso de erro) e espera a nova
  const last = AIS.msgs[AIS.msgs.length - 1];
  if (last && last.r === "a" && (last.err || last.id === r.removed)) AIS.msgs.pop();
  AIS.pending = { id: r.replyId, r: "a", t: "" };
  renderAIView(true);
}
async function sendAI() {
  const inp = $("#aiInput");
  if (!inp) return;
  const text = inp.value.trim();
  if (!text || AIS.busy) return;
  AIS.busy = true;
  inp.value = ""; inp.style.height = "auto";
  const r = await emit("ai:send", { text });
  if (r.error) { AIS.busy = false; inp.value = text; toast(r.error, "error", 6000); renderAIView(); return; }
  // mensagem de erro anterior some (a pergunta nova recomeça a conversa)
  if (AIS.msgs.length && AIS.msgs[AIS.msgs.length - 1].err) AIS.msgs.pop();
  AIS.msgs.push(r.msg);
  AIS.pending = { id: r.replyId, r: "a", t: "" };
  renderAIView(true);
}
function aiAtBottom() { const l = $("#aiList"); return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 80; }
// A resposta chega aos pedaços; o desenho acontece no máximo uma vez por quadro de tela
// (antes, cada pedaço refazia a formatação do texto inteiro na hora, travando celulares fracos).
let aiPaintRaf = 0;
function aiPaint() {
  aiPaintRaf = 0;
  const p = AIS.pending;
  if (!p || S.view !== "ai") return;
  const el = $(`#aiList [data-id="${CSS.escape(p.id)}"] .ai-b`), stick = aiAtBottom();
  if (el) el.innerHTML = p.t ? renderText(p.t).html : `<span class="ai-dots"><i></i><i></i><i></i></span>`; else renderAIView();
  if (stick) { const l = $("#aiList"); if (l) l.scrollTop = l.scrollHeight; }
}
function aiQueuePaint() { if (!aiPaintRaf) aiPaintRaf = requestAnimationFrame(aiPaint); }
function onAIDelta({ id, t }) {
  if (!AIS.pending || AIS.pending.id !== id || typeof t !== "string") return;
  AIS.pending.t = t;
  aiQueuePaint();
}
function onAIChunk({ id, n, d }) {
  if (!AIS.pending || AIS.pending.id !== id) return;
  // n = onde o pedaço começa; n menor que o texto atual = a IA recomeçou a resposta
  AIS.pending.t = AIS.pending.t.slice(0, Math.max(0, n | 0)) + String(d || "");
  aiQueuePaint();
}
function onAIDone({ msg, used }) {
  AIS.pending = null; AIS.busy = false;
  if (!AIS.msgs.some(m => m.id === msg.id)) AIS.msgs.push(msg);
  AIS.used = used;
  if (S.view === "ai") { const stick = aiAtBottom(); renderAIView(stick); }
  else toast("A Aury respondeu 🤖", "ok");
}
function onAIError({ id, error }) {
  if (AIS.pending && AIS.pending.id === id) AIS.pending = null;
  AIS.busy = false;
  AIS.msgs.push({ id, r: "a", t: error, err: true, ts: Date.now() });
  if (S.view === "ai") renderAIView(true);
}
async function clearAI() {
  if (!confirm("Apagar toda a conversa com a Aury?")) return;
  const r = await emit("ai:clear", {});
  if (r.error) { toast(r.error, "error"); return; }
  AIS.msgs = []; renderAIView(true);
}

async function goGames() {
  setView("games");
  S.serverId = null; S.channelId = null;
  store.set("last", { view: "games" });
  if (!S.games) $("#gamesView").innerHTML = `<div class="page"><div class="hero"><h1>${ic("gamepad", "lg")} Carregando jogos…</h1></div></div>`;
  else renderGamesView();
  renderAll(); updateMini();
  if (await loadGames(true) && S.view === "games") { renderGamesView(); renderSide(); }
}
function gameCover(g) {
  if (g.img) return `<img src="${esc(g.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  let h = 0;
  for (const ch of g.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<div class="gc-art" style="--h:${g.id === "bunker9" ? 4 : h}"><span>${ic("gamepad")}</span><b>${esc(g.name)}</b></div>`;
}
function gameCard(g) {
  const can = g.status === "on";
  return `<article class="game-card${can ? "" : " off"}">
    <div class="gc-cover"${can ? ` data-act="game-play" data-id="${g.id}" role="button" tabindex="0" aria-label="Jogar ${esc(g.name)}"` : ""}>${gameCover(g)}${can ? `<span class="gc-play">${ic("play")}</span>` : `<span class="gc-flag">${gameTag(g)}</span>`}</div>
    <div class="gc-body"><div class="gc-top"><h3>${esc(g.name)}</h3>${g.category ? `<span class="gc-cat">${esc(g.category)}</span>` : ""}</div>
      <p>${esc(g.desc || "")}</p>
      <div class="gc-acts">${can ? `<button class="btn primary" data-act="game-play" data-id="${g.id}">${ic("play", "sm")}${GP.game && GP.game.id === g.id ? "Voltar ao jogo" : "Jogar"}</button><button class="icon-btn" data-act="game-tab" data-id="${g.id}" data-tip="Abrir em nova aba">${ic("external")}</button>` : `<button class="btn" disabled>${(GSTATUS[g.status] || GSTATUS.off)[0]}</button>`}</div>
    </div></article>`;
}
function gamesGrid() {
  const q = (S.gameQ || "").trim().toLowerCase(), cat = S.gameCat || "";
  const list = (S.games || []).filter(g => (!cat || g.category === cat) && (!q || `${g.name} ${g.desc} ${g.category}`.toLowerCase().includes(q)));
  return list.length ? `<div class="game-grid">${list.map(gameCard).join("")}</div>`
    : `<div class="empty">${ic("gamepad")}<p>${(S.games || []).length ? "Nenhum jogo encontrado com esse filtro." : "Nenhum jogo no catálogo ainda."}</p></div>`;
}
function renderGamesView() {
  const root = $("#gamesView");
  if (!root || !S.games) return;
  const cat = S.gameCat || "";
  root.innerHTML = `<div class="page games">
    <div class="hero games-hero"><h1>${ic("gamepad", "lg")} Jogos</h1><p>Jogue direto na Auryx Nexos — sozinho ou com a galera da call.</p></div>
    <div class="games-bar"><label class="games-search">${ic("search", "sm")}<input data-gq type="search" placeholder="Buscar jogo" value="${esc(S.gameQ || "")}" maxlength="40" aria-label="Buscar jogo"></label>
      <div class="chips">${["", ...gameCats()].map(c => `<button class="chip${cat === c ? " on" : ""}" data-act="games-cat" data-cat="${esc(c)}">${esc(c || "Todos")}</button>`).join("")}</div></div>
    <div data-ggrid>${gamesGrid()}</div>
  </div>`;
  const inp = root.querySelector("[data-gq]");
  inp.oninput = () => { S.gameQ = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { const g = root.querySelector("[data-ggrid]"); if (g) g.innerHTML = gamesGrid(); }, 150); };
}
function openGameTab(g) {
  if (!g) return;
  const w = window.open(g.url, "_blank", "noopener,noreferrer");
  if (!w && !DESKTOP && !ANDROID) location.href = g.url;
}
function playGame(id) {
  const g = gameById(id);
  if (!g || g.status !== "on") { toast("Esse jogo não está disponível agora.", "warn"); return; }
  if (!g.embed) { openGameTab(g); return; }
  if (GP.game && GP.game.id === id) { showGame(); return; }
  closeGame(true);
  GP.game = g; GP.loaded = false;
  const el = document.createElement("div");
  el.className = "game-player";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", g.name);
  el.innerHTML = `<div class="gp-bar"><div class="gp-title">${ic("gamepad", "sm")}<b>${esc(g.name)}</b><small data-gp-st>Carregando…</small></div>
    <div class="gp-acts"><button class="icon-btn" data-act="game-reload" data-tip="Recarregar">${ic("refresh")}</button><button class="icon-btn" data-act="game-full" data-tip="Tela cheia">${ic("maximize")}</button><button class="icon-btn" data-act="game-tab" data-id="${g.id}" data-tip="Abrir em nova aba">${ic("external")}</button><button class="icon-btn" data-act="game-min" data-tip="Minimizar (o jogo continua)">${ic("minimize")}</button><button class="icon-btn gp-x" data-act="game-close" data-tip="Fechar jogo">${ic("x")}</button></div></div>
    <div class="gp-stage"><div class="gp-wait"><span class="gp-spin"></span><p>Abrindo ${esc(g.name)}…</p><small data-gp-hint></small><button class="btn sm hidden" data-act="game-tab" data-id="${g.id}" data-gp-alt>${ic("external", "sm")}Abrir em nova aba</button></div></div>`;
  const fr = document.createElement("iframe");
  fr.title = g.name;
  fr.allow = "fullscreen; gamepad; autoplay; clipboard-write; screen-wake-lock";
  fr.allowFullscreen = true;
  fr.referrerPolicy = "no-referrer";
  fr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads");
  fr.addEventListener("load", () => {
    GP.loaded = true; clearTimeout(GP.t);
    el.classList.add("ready");
    const st = el.querySelector("[data-gp-st]"); if (st) st.textContent = "";
  });
  fr.src = g.url;
  el.querySelector(".gp-stage").append(fr);
  document.body.append(el);
  GP.el = el;
  clearTimeout(GP.t);
  GP.t = setTimeout(() => {   // o servidor do jogo pode estar "dormindo" (Render): avisa e oferece a nova aba
    if (GP.loaded || GP.el !== el) return;
    el.querySelector("[data-gp-hint]").textContent = "O servidor do jogo pode estar acordando — isso leva até 1 minuto. Se preferir, abra em uma nova aba.";
    el.querySelector("[data-gp-alt]").classList.remove("hidden");
  }, 12000);
  if (S.view === "games") { const gg = $("#gamesView [data-ggrid]"); if (gg) gg.innerHTML = gamesGrid(); renderSide(); }
}
function showGame() {
  if (!GP.el) return;
  GP.el.classList.remove("min");
  GP.chip && GP.chip.remove(); GP.chip = null;
}
function minimizeGame() {
  if (!GP.el) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  GP.el.classList.add("min");
  if (!GP.chip) {
    const c = document.createElement("button");
    c.className = "gp-chip";
    c.dataset.act = "game-resume";
    c.innerHTML = `${ic("gamepad", "sm")}<span>${esc(GP.game.name)}</span><small>Voltar</small>`;
    document.body.append(c);
    GP.chip = c;
  }
}
function closeGame(silent) {
  if (!GP.el) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  clearTimeout(GP.t);
  const fr = GP.el.querySelector("iframe");
  if (fr) fr.src = "about:blank";   // libera memória e a conexão do jogo
  GP.el.remove(); GP.chip && GP.chip.remove();
  GP.el = GP.chip = GP.game = null;
  if (!silent && S.view === "games") { const gg = $("#gamesView [data-ggrid]"); if (gg) gg.innerHTML = gamesGrid(); renderSide(); }
}
function askCloseGame() {
  if (!GP.game) return;
  modal({
    title: "Fechar o jogo?", sub: esc(GP.game.name),
    body: `<p style="color:var(--text-2)">Se você estiver no meio de uma partida, vai sair dela. Para continuar jogando depois, use <b>Minimizar</b>.</p><div class="modal-foot"><button class="btn ghost" data-min>Minimizar</button><button class="btn danger" data-go>Fechar jogo</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = () => { close(); closeGame(); };
      m.querySelector("[data-min]").onclick = () => { close(); minimizeGame(); };
    }
  });
}
function gameFullscreen() {
  const st = GP.el && GP.el.querySelector(".gp-stage");
  if (!st) return;
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  if (st.requestFullscreen) st.requestFullscreen().catch(() => GP.el.classList.toggle("full"));
  else GP.el.classList.toggle("full");
}
function adminGameEdit(id) {
  const g = id ? gameById(id) : null;
  const v = g || { name: "", url: "https://", category: "", desc: "", img: "", status: "on", embed: true, order: (S.games || []).length + 1 };
  modal({
    title: g ? "Editar jogo" : "Adicionar jogo", sub: g ? esc(g.name) : "Ele aparece para todo mundo na aba Jogos",
    body: `<label class="field"><span>Nome</span><input data-f="name" maxlength="60" value="${esc(v.name)}" placeholder="Ex.: Bunker 9"></label>
      <label class="field"><span>Endereço do jogo (https://)</span><input data-f="url" maxlength="400" value="${esc(v.url)}" inputmode="url" placeholder="https://meujogo.onrender.com"></label>
      <div class="form-2"><label class="field"><span>Categoria</span><input data-f="category" maxlength="30" value="${esc(v.category)}" placeholder="Ex.: Ação, Corrida" list="gameCatList"><datalist id="gameCatList">${gameCats().map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label class="field"><span>Ordem</span><input data-f="order" type="number" min="0" max="999" value="${+v.order || 0}"></label></div>
      <label class="field"><span>Descrição</span><textarea data-f="desc" maxlength="300" placeholder="Uma ou duas frases sobre o jogo">${esc(v.desc)}</textarea></label>
      <label class="field"><span>Imagem de capa (link https://, opcional)</span><input data-f="img" maxlength="400" value="${esc(v.img)}" placeholder="Deixe vazio para gerar uma capa automática"></label>
      <span class="label">Situação</span><div class="chips" style="margin:8px 0 14px">${Object.entries(GSTATUS).map(([k, s]) => `<label class="chip${v.status === k ? " on" : ""}"><input type="radio" name="gst" value="${k}" ${v.status === k ? "checked" : ""} hidden>${s[0]}</label>`).join("")}</div>
      <label class="radio-card${v.embed ? " on" : ""}"><span><b>Abrir dentro da Auryx</b><small>Desmarque se o site do jogo não deixar ser aberto dentro de outro site — aí ele abre em uma nova aba.</small></span><input type="checkbox" data-f="embed" ${v.embed ? "checked" : ""}></label>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>${g ? "Salvar" : "Adicionar"}</button></div>`,
    onMount(m, close) {
      m.addEventListener("change", e => {
        if (e.target.name === "gst") $$(".chips .chip", m).forEach(c => c.classList.toggle("on", c.querySelector("input").checked));
        if (e.target.dataset.f === "embed") e.target.closest(".radio-card").classList.toggle("on", e.target.checked);
      });
      const go = m.querySelector("[data-go]");
      go.onclick = async () => {
        const f = k => m.querySelector(`[data-f="${k}"]`);
        const game = { id: g ? g.id : undefined, name: f("name").value.trim(), url: f("url").value.trim(), category: f("category").value.trim(), desc: f("desc").value.trim(), img: f("img").value.trim(), order: +f("order").value, embed: f("embed").checked, status: m.querySelector('input[name="gst"]:checked').value };
        go.classList.add("loading");
        const r = await emit("games:save", { game });
        go.classList.remove("loading");
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast(g ? "Jogo atualizado." : "Jogo adicionado ao catálogo.", "ok");
        await loadGames(true); renderAdmin(true);
      };
    }
  });
}
function adminGameDel(id) {
  const g = gameById(id);
  if (!g) return;
  modal({
    title: "Remover jogo", sub: esc(g.name),
    body: `<p style="color:var(--text-2)">Ele some da aba Jogos para todo mundo. O jogo em si não é afetado — dá para adicionar de novo depois.</p><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go>Remover</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = async () => {
        const r = await emit("games:delete", { id });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast("Jogo removido do catálogo.", "ok");
        await loadGames(true); renderAdmin(true);
      };
    }
  });
}
function adminApprove(id) {
  const o = S.orders.get(id);
  if (!o) return;
  modal({
    title: "Aprovar pagamento", sub: `${esc(o.user ? o.user.username : "?")} · plano ${esc(o.plan)}`,
    body: `<div class="pay-amount">${fmtMoney(o.amount)}</div><p style="color:var(--text-2)">Abra o extrato da conta Nubank e confira se <b>exatamente esse valor</b> entrou, na data do pedido. Só aprove se o dinheiro realmente caiu.</p>
      <label class="radio-card"><span><b>Confirmo que conferi o extrato e o valor caiu na conta</b></span><input type="checkbox" data-ok></label>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn green" data-go disabled>Aprovar e liberar plano</button></div>`,
    onMount(m, close) {
      const go = m.querySelector("[data-go]");
      m.querySelector("[data-ok]").onchange = e => { go.disabled = !e.target.checked; e.target.closest(".radio-card").classList.toggle("on", e.target.checked); };
      go.onclick = async () => {
        go.classList.add("loading");
        const r = await emit("order:approve", { id, confirm: true });
        go.classList.remove("loading");
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast("Pedido aprovado e plano liberado.", "ok");
      };
    }
  });
}
function adminReject(id) {
  const o = S.orders.get(id);
  if (!o) return;
  modal({
    title: "Recusar pedido", sub: `${esc(o.user ? o.user.username : "?")} · plano ${esc(o.plan)} · ${fmtMoney(o.amount)}`,
    body: `<label class="field"><span>Motivo (o usuário vai ver)</span><textarea data-r maxlength="400" placeholder="Ex.: o valor não apareceu no extrato / comprovante ilegível / valor diferente"></textarea></label>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go>Recusar pedido</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = async () => {
        const reason = m.querySelector("[data-r]").value.trim();
        if (reason.length < 3) { toast("Escreva o motivo da recusa.", "warn"); return; }
        const r = await emit("order:reject", { id, reason });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast("Pedido recusado. O usuário foi avisado.", "ok");
      };
    }
  });
}
function adminGrant(uid, name) {
  modal({
    title: "Dar plano manualmente", sub: esc(name),
    body: `<span class="label">Plano</span><div class="chips" style="margin:8px 0 14px">${["plus", "pro", "max"].map((t, i) => `<label class="chip${i === 0 ? " on" : ""}"><input type="radio" name="gt" value="${t}" ${i === 0 ? "checked" : ""} hidden>${PLAN_NAME[t]}</label>`).join("")}</div>
      <label class="field"><span>Dias</span><input type="number" data-days min="1" max="366" value="30"></label>
      <p class="hint">Use para cortesias ou correções. Fica registrado no histórico com o seu nome.</p>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Dar plano</button></div>`,
    onMount(m, close) {
      m.addEventListener("change", e => { if (e.target.name === "gt") $$(".chip", m).forEach(c => c.classList.toggle("on", c.querySelector("input").checked)); });
      m.querySelector("[data-go]").onclick = async () => {
        const tier = m.querySelector('input[name="gt"]:checked').value, days = +m.querySelector("[data-days]").value;
        const r = await emit("admin:grant", { userId: uid, tier, days });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast("Plano liberado.", "ok"); renderAdmin(true);
      };
    }
  });
}
function adminRevoke(uid, name) {
  modal({
    title: "Revogar plano", sub: esc(name),
    body: `<label class="field"><span>Motivo (o usuário vai ver)</span><textarea data-r maxlength="300" placeholder="Ex.: estorno do Pix / pagamento contestado"></textarea></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go>Revogar</button></div>`,
    onMount(m, close) {
      m.querySelector("[data-go]").onclick = async () => {
        const r = await emit("admin:revoke", { userId: uid, reason: m.querySelector("[data-r]").value.trim() });
        if (r.error) { toast(r.error, "error"); return; }
        close(); toast("Plano revogado.", "ok"); renderAdmin(true);
      };
    }
  });
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
    body = `<div class="add-friend"><h2>Adicionar amigo</h2><p>Você pode adicionar amigos pelo nome de usuário da Auryx Nexos.</p>
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
  if (isDm(cid) && V.channelId === cid) { openDMCall(cid, false); return; }
  if (isDm(cid) || isTicket(cid)) { openDM(cid); return; }
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
  input.placeholder = c.ticket ? "Escreva para a equipe…" : c.group ? `Mensagem para ${groupTitle(c)}` : c.dm ? `Mensagem para @${c.name}` : `Conversar em #${c.name}`;
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
    return `<div class="msg sys${isNew ? " new" : ""}" data-id="${m.id}">${ic("arrowRight")}<span><b data-act="profile" data-uid="${u.id}" style="color:${esc(u.color)}">${esc(u.username)}</b> ${m.sys === "gname" && m.t ? `mudou o nome do grupo para <b>${esc(m.t)}</b>.` : m.sys === "oreject" && m.t ? `recusou o pedido. Motivo: <b>${esc(m.t)}</b>` : m.sys === "oapprove" && m.t ? `aprovou o pagamento e liberou o plano <b>${esc(m.t)}</b>! 🎉` : SYS[m.sys] || ""}<time title="${esc(fmtFull(m.ts))}">${fmtStamp(m.ts)}</time></span></div>`;
  }
  const u = user(m.a), s = srv(), mine = S.me && m.a === S.me.id;
  const cont = prev && !prev.sys && prev.a === m.a && !m.re && m.ts - prev.ts < 420000 && sameDay(prev.ts, m.ts);
  const { html, images, jumbo } = renderText(m.t);
  const cls = ["msg", cont && "cont", isNew && "new", m.pending && "pending", m.failed && "failed", mentionsMe(m) && "mention", u.plan && "vip vip-" + u.plan].filter(Boolean).join(" ");
  let h = `<div class="${cls}" data-id="${esc(m.id)}">`;
  if (m.re) {
    const ru = user(m.re.a);
    h += `<div class="msg-reply" data-act="jump-to" data-ref="${esc(m.re.id)}">${avatar(ru, 16)}<b style="color:${esc(ru.color)}">@${esc(ru.username)}</b><span>${esc((m.re.t || "📎 Anexo").replace(/\n/g, " "))}</span></div>`;
  }
  h += cont ? `<time class="msg-side-time" title="${esc(fmtFull(m.ts))}">${fmtTime(m.ts)}</time>` : avatar(u, 40, false, `data-act="profile" data-uid="${esc(u.id)}"`);
  h += `<div class="msg-body">`;
  if (!cont) {
    h += `<div class="msg-head"><span class="msg-author" data-act="profile" data-uid="${esc(u.id)}" style="color:${esc((s && roleColor(s, u.id)) || u.color)}">${nameHTML(u)}</span>${u.plan ? `<span class="plan-chip" data-tip="Assinante ${esc(PLAN_NAME[u.plan])}">${{ plus: "💠", pro: "💎", max: "👑" }[u.plan]}</span>` : ""}${staffTag(u)}${s ? userRoles(s, u.id).slice(0, 1).map(r => `<span class="msg-role" style="--rc:${esc(r.color)}">${r.icon ? esc(r.icon) + " " : ""}${esc(r.name)}</span>`).join("") : ""}${s && s.ownerId === u.id ? `<span class="owner-tag" data-tip="Dono do servidor">${ic("crown")}</span>` : ""}<time title="${esc(fmtFull(m.ts))}">${fmtStamp(m.ts)}</time></div>`;
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
  if (b && !b.more && c.ticket) h += `<div class="chan-intro"><div class="big">${ic("gem")}</div><h2>Atendimento — pedido ${esc(c.order.plan)}</h2><p>Conversa privada entre ${S.me.admin && c.order.user ? `<b>${esc(c.order.user.username)}</b>` : "você"} e a equipe ADM. O plano só é liberado depois que a equipe confere que o Pix caiu na conta.</p></div>`;
  else if (b && !b.more && c.group) h += `<div class="chan-intro">${groupAvatar(c, 76)}<h2 style="margin-top:12px">${esc(groupTitle(c))}</h2><p>Bem-vindos ao começo do grupo. Só quem está aqui vê estas mensagens.</p></div>`;
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
  if (LOCAL) { toast("Enviar arquivos funciona na versão online da Auryx Nexos.", "warn"); return; }
  if (S.view !== "chat" || !S.channelId) return;
  for (const f of [...list]) {
    if (S.uploads.filter(u => u.cid === S.channelId).length >= 10) { toast("No máximo 10 arquivos por mensagem.", "warn"); break; }
    const maxMb = [8, 15, 25, 50][myRank()];
    if (f.size > maxMb * 1024 * 1024) { toast(`"${f.name}" passa de ${maxMb} MB.${myRank() < 3 ? " Os planos Premium aumentam esse limite." : ""}`, "warn"); continue; }
    const up = { key: Math.random().toString(36).slice(2), file: f, name: f.name || "imagem.png", size: f.size, type: f.type || "application/octet-stream", progress: 0, cid: S.channelId };
    if (/^image\//.test(up.type)) up.preview = URL.createObjectURL(f);
    S.uploads.push(up);
    startUpload(up);
  }
  renderTray();
  $("#input").focus();
}
/* Comprime fotos antes de enviar (WebP, até 1920 px). GIF, vídeo e arquivos pequenos vão como estão. */
async function shrinkImage(file) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 350 * 1024 || !window.createImageBitmap) return file;
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    let blob = await new Promise(r => c.toBlob(r, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp") blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.84));
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
    return new File([blob], (file.name || "imagem").replace(/\.[^.]*$/, "") + ext, { type: blob.type });
  } catch { return file; }
}
async function startUpload(up) {
  const small = await shrinkImage(up.file);
  if (small !== up.file) { up.file = small; up.name = small.name; up.type = small.type; up.size = small.size; }
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
  // Conexão caiu no meio do envio: tenta de novo com o MESMO nonce (o servidor reconhece e não duplica)
  const payload = { channelId: cid, text, replyTo: re ? re.id : undefined, nonce, files: fileIds };
  let r = await emit("send", payload);
  for (let i = 0; i < 3 && r.error && NET_ERRORS.has(r.error); i++) {
    await waitOnline(20000);
    r = await emit("send", payload);
  }
  if (!r.error && r.id && m.pending) {
    // o servidor já tinha a mensagem (aviso perdido durante a queda): troca a provisória pela verdadeira
    const i = b.list.indexOf(m);
    if (i >= 0) { const real = { ...m, id: r.id }; delete real.pending; delete real.nonce; b.list[i] = real; if (S.channelId === cid) rerenderMsg(real, m.id); }
  }
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
        fail("Amigos e mensagens privadas funcionam na versão online da Auryx Nexos.");
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
const NET_ERRORS = new Set(["Sem conexão com o servidor.", "O servidor demorou para responder."]);
// espera a conexão voltar (no máximo "ms")
function waitOnline(ms) {
  return new Promise(res => {
    const t0 = Date.now();
    const tick = () => (S.socket && S.socket.connected) || Date.now() - t0 > ms ? res() : setTimeout(tick, 300);
    tick();
  });
}
function emit(ev, data) {
  return new Promise(res => {
    if (!S.socket || !S.socket.connected) return res({ error: "Sem conexão com o servidor." });
    S.socket.timeout(12000).emit(ev, data || {}, (err, r) => res(err ? { error: "O servidor demorou para responder." } : r || {}));
  });
}
function connect() {
  const sock = LOCAL ? localSocket(S.token) : io({ auth: { token: S.token, v: 4 }, transports: ["websocket", "polling"], reconnectionDelayMax: 6000 });
  S.socket = sock;
  sock.on("connect_error", err => {
    if (err && err.message === "auth") { store.del("token"); S.token = null; sock.disconnect(); showAuth(Date.now() < Date.UTC(2027, 0, 15) ? "A Auryx Nexavória agora é Auryx Nexos! ✨ Por segurança, entre de novo." : "Sua sessão expirou. Entre novamente."); return; }
    if (err && err.message === "banned") { store.del("token"); S.token = null; sock.disconnect(); showAuth(`Sua conta foi suspensa pela equipe da Auryx.${err.data && err.data.reason ? " Motivo: " + err.data.reason : ""}`); return; }
    if (err && err.message === "verify") { sock.disconnect(); showAuth(); setAuthMode("verify", "Confirme seu e-mail para entrar. Digite o código que enviamos (ou peça outro)."); return; }
    // app de Android/PC antigo depois do prazo: só entra baixando a versão nova
    if (err && err.message === "update") { sock.disconnect(); showUpdateRequired(err.data || {}); return; }
    if (err && err.message === "maintenance") { sock.disconnect(); showMaintenance(err.data && err.data.text); return; }
    if (S.ready) $("#connBar").classList.remove("hidden");
  });
  sock.on("connect", () => { $("#connBar").classList.add("hidden"); sock.emit("vis", { hidden: document.hidden }); });
  sock.on("disconnect", reason => { if (reason !== "io client disconnect") $("#connBar").classList.remove("hidden"); });

  sock.on("ready", onReady);
  sock.on("presence", ({ userId, status }) => {
    const u = S.users.get(userId);
    if (!u) return;
    u.status = status;
    schedule("members", "side", "home");
  });
  sock.on("me:update", ({ me }) => {
    const wasAdmin = S.me && S.me.admin, wasMod = S.me && S.me.mod;
    S.me = { ...S.me, ...me };
    S.users.set(me.id, { ...S.users.get(me.id), ...me });
    applyAccent();
    applyLimits();
    $(".rail-item.admin").classList.toggle("hidden", !(S.me.admin || S.me.mod));
    if (S.me.mod && !wasMod) toast("Agora você é Moderador da Auryx Nexos 🛡️", "ok", 5000);
    if (!S.me.admin && !S.me.mod && S.view === "admin") goHome();
    if (S.me.admin && !wasAdmin) toast("Agora você faz parte da equipe ADM da Auryx Nexos 🛡️", "ok", 5000);
    schedule("user", "members", "side", "rail", "top", "home");
    if (S.view === "premium") renderPremium();
  });
  sock.on("announce:clear", () => {});
  sock.on("maintenance", ({ text }) => { S.ready = false; showMaintenance(text); });
  sock.on("order:update", ({ order }) => onOrderUpdate(order));
  sock.on("order:new", ({ order }) => { if (S.me && S.me.admin) { sfx("mention"); toast(`Novo pedido: ${order.user ? order.user.username : "?"} — plano ${order.plan}`, "info", 5000); } });
  sock.on("announce", showAnnounce);
  sock.on("call:ring", showRing);
  sock.on("call:end", ({ channelId }) => stopRing(channelId));
  sock.on("call:declined", ({ userId }) => toast(`${user(userId).username} recusou a chamada. Você pode continuar esperando na call.`, "info", 4500));
  sock.on("banned", ({ reason }) => toast(`Sua conta foi suspensa pela equipe.${reason ? " Motivo: " + reason : ""}`, "error", 8000));
  sock.on("games:changed", async () => {
    if (S.view === "games") { if (await loadGames(true) && S.view === "games") { renderGamesView(); renderSide(); } }
    else S.games = null;
  });
  sock.on("plan:revoked", ({ reason }) => toast(`Seu plano foi removido pela equipe. Motivo: ${reason}`, "warn", 8000));
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
    // mantém os campos só meus (ADM, e-mail, Aurys…) — antes eles sumiam até recarregar
    if (S.me && u.id === S.me.id) { S.me = { ...S.me, ...u, statusPref: statusPref || S.me.statusPref }; schedule("user"); }
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
    applyAccent();
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
    Object.assign(c, { name: channel.name, topic: channel.topic, emoji: channel.emoji || "", cat: channel.cat || "" });
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
  sock.on("pins:update", ({ channelId, pins }) => { if (Array.isArray(pins)) S.pins.set(channelId, pins); });
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
  sock.on("server:roles", onServerRoles);
  sock.on("ai:delta", onAIDelta);
  sock.on("ai:chunk", onAIChunk);
  sock.on("ai:done", onAIDone);
  sock.on("ai:error", onAIError);
  sock.on("voice:state", onVoiceState);
  sock.on("voice:leave", onVoiceLeave);
  sock.on("voice:signal", onSignal);
  // alguém da call caiu e voltou: só troca o "endereço" da conexão, sem desligar
  sock.on("voice:resock", ({ old, sock: ns, userId }) => {
    const p = V.peers.get(old);
    if (p) {
      V.peers.delete(old);
      p.sock = ns;
      p.polite = S.socket.id < ns;
      V.peers.set(ns, p);
      if (["failed", "disconnected"].includes(p.pc.connectionState)) { try { p.pc.restartIce(); } catch {} }
    }
    const st = S.voice.get(userId);
    if (st && st.sock === old) st.sock = ns;
    if (V.viewers.delete(old)) V.viewers.add(ns);
    if (V.granted.has(old)) { V.granted.set(ns, V.granted.get(old)); V.granted.delete(old); }
    if (V.controlling && V.controlling.sock === old) V.controlling.sock = ns;
  });
  sock.on("act", onAct);
  sock.on("act:sum", ({ channelId, type }) => { if (type) S.acts.set(channelId, type); else S.acts.delete(channelId); schedule("side"); });
  sock.on("act:ev", ev => { if (V.actEl && V.actEl._onEv) V.actEl._onEv(ev); });
  sock.on("call:fx", onCallFx);
  sock.on("plan:notice", ({ kind, tier, until }) => {
    const n = PLAN_NAME[tier] || "plano";
    if (kind === "soon") toast(`Seu ${n} vence em ${fmtDate(until)}. Renove em Premium para não perder os benefícios.`, "warn", 9000);
    else toast(`Seu ${n} venceu. Os benefícios foram pausados — nada foi apagado.`, "warn", 9000);
    if (S.view === "premium") loadPlans().then(renderPremium);
  });
  sock.on("session:ended", d => {
    const all = d && d.all;
    toast(all ? "A equipe desconectou todo mundo para uma atualização. Entre de novo!" : "Sua conta foi desconectada deste aparelho.", "warn", 6000);
    if (all) try { sessionStorage.setItem("nx:loggedOut", "1"); } catch {}
    setTimeout(() => { teardownVoice(true); store.del("token"); location.reload(); }, 1500);
  });
  sock.on("voice:kicked", ({ reason } = {}) => { teardownVoice(); if (reason) toast(reason, "warn", 5000); renderAll(); });
}

// Volta depois de uma queda: retoma a mesma chamada (o servidor guardou o lugar por 60 s)
async function resumeVoice(cid) {
  const r = await emit("voice:resume", { oldSock: V.mySock, channelId: cid });
  if (r.error) { teardownVoice(true); if (chan(cid)) joinVoice(cid); return; }
  V.mySock = S.socket.id;
  if (r.now) S.clockOff = r.now - Date.now();
  for (const p of V.peers.values()) p.polite = S.socket.id < p.sock;
  for (const p of [...V.peers.values()]) if (!r.peers.some(x => x.sock === p.sock)) closePeer(p);
  for (const pv of r.peers) {
    const p = V.peers.get(pv.sock);
    if (p && ["failed", "closed"].includes(p.pc.connectionState)) closePeer(p);
    if (!p || p.pc.connectionState === "closed" || p.pc.connectionState === "failed") createPeer(pv.sock, pv.userId, true);
    else if (p.pc.connectionState === "disconnected") { try { p.pc.restartIce(); } catch {} }
  }
  if (r.act) { V.act = r.act.type ? r.act : null; if (!V.act) destroyAct(); }
  callBackground(true);
  renderAll();
}
/* Atualização automática: o servidor mudou de versão enquanto o app estava aberto */
// Versão deste app.js (o servidor troca o marcador abaixo pela versão real ao entregar o arquivo).
// Antes, o app aberto a partir da cópia guardada comparava a versão do servidor com ela mesma e nunca se atualizava.
const BUILD = "__AURYX_BUILD__";
const appBusy = () => V.channelId || (document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName) && document.activeElement.value);
function checkVersion(ver) {
  if (!ver) return;
  if (!S.appVer) S.appVer = /^[0-9a-f]{10}$/.test(BUILD) ? BUILD : ver;
  if (ver === S.appVer) return;
  // proteção contra recarregar em loop se algo der errado com a cópia nova
  if (store.get("updTried") === ver) { showUpdateBar(); return; }
  if (appBusy()) {
    showUpdateBar();
    // em chamada ou digitando: atualiza sozinho assim que a pessoa sair da chamada / parar de digitar
    if (!S.updWait) S.updWait = setInterval(() => { if (!appBusy()) { clearInterval(S.updWait); S.updWait = 0; checkVersion(ver); } }, 15000);
    return;
  }
  store.set("updTried", ver);
  toast("Atualizando a Auryx Nexos…", "info", 3000);
  // apaga a cópia guardada do app para a recarga já vir com a versão nova
  const wipe = window.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).catch(() => {}) : Promise.resolve();
  wipe.then(() => setTimeout(() => location.reload(), 800));
}
/* Novidades: aparece uma vez para cada pessoa depois da atualização */
const NEWS_ID = "2026-11-21-nexos";
function showNews() {
  if (store.get("news") === NEWS_ID) return;
  store.set("news", NEWS_ID);
  const it = (e, t, d) => `<li><span class="nw-e">${e}</span><div><b>${t}</b><small>${d}</small></div></li>`;
  modal({
    title: "✨ Novidades da Auryx Nexos", sub: "Nome novo, visual novo e muita coisa nova",
    body: `<ul class="news">${[
      it("🅰️", "Agora somos Auryx Nexos", "Mesmo app, mesmos amigos e servidores — com nome, ícone e visual novos no PC."),
      it("📅", "Planos trimestrais", "VIP, Pro e Max por 3 meses, mais barato que pagar mês a mês."),
      it("💬", "Mensagens maiores", "Até 3.000 caracteres para todo mundo e até 10.000 no Max — e dá para mandar mais seguidas."),
      it("🎨", "Aurys", "No Pro e no Max você escolhe a cor do app inteiro, em todos os seus aparelhos."),
      it("🖼️", "Banner em GIF, molduras e partículas", "Perfis animados para quem assina, com moldura dourada e efeitos como galáxia e sakura no Max."),
      it("🏰", "Servidores do seu jeito", "Banner, cor temática, cargos com ícone e categorias de canais que dobram."),
      it("📱", "Android melhor", "O botão voltar fecha menus e janelas (antes fechava o app) e dá para abrir o menu deslizando da borda.")
    ].join("")}</ul><div class="modal-foot"><button class="btn primary" data-close>Bora!</button></div>`
  });
}
function onReady(d) {
  checkVersion(d.ver);
  S.spotifyId = d.spotifyId || "";
  const rejoin = V.channelId;
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
  applyAccent();
  applyLimits(d.limits && d.limits.msg);
  // aviso fixado pela equipe (ex.: o novo nome Auryx Nexos): aparece uma vez por conta neste aparelho
  const ann = d.announce;
  const annNow = first && ann && !LOCAL && !store.get("ann:" + S.me.id + ":" + ann.id);
  if (annNow) setTimeout(() => showAnnounce(ann), 900);
  else if (first && !LOCAL) setTimeout(showNews, 1200);
  if (d.outdated && !d.outdated.hard) setTimeout(() => showOutdated(d.outdated), 1500);
  if (!LOCAL) {
    // cookie HttpOnly para abrir comprovantes privados (sessões antigas não tinham)
    authApi("account/cookie", {}, true).catch(() => {});
    loadPlans().then(() => schedule("side", "rail"));
    if (S.me.admin) emit("order:list", { status: "open" }).then(r => { for (const o of r.orders || []) S.orders.set(o.id, o); schedule("side", "rail"); });
  }
  if (S.channelId && chan(S.channelId) && (isDm(S.channelId) || S.servers.has(S.serverId))) openChannel(S.channelId, false);
  else if (!first && S.view === "friends") goFriends();
  else if (!first && S.view === "games") goGames();
  else if (!first && S.view === "ai") goAI();       // reconectou: continua na mesma tela
  else if (!first && S.view === "premium") goPremium();
  else if (!first && S.view === "admin" && S.me.admin) goAdmin();
  else if (!first && S.view === "discover") goDiscover();
  else if (first) {
    const last = store.get("last", {});
    if (last.server && S.servers.has(last.server)) openServer(last.server); else if (last.view === "games") goGames(); else if (last.view === "ai") goAI(); else goHome();
  } else goHome();
  renderAll();
  if (rejoin && chan(rejoin)) resumeVoice(rejoin);
  else if (rejoin) teardownVoice();
  if (S.openFriends) { S.openFriends = false; goFriends(); }
  if (S.openUrl) { const u = S.openUrl; S.openUrl = null; setTimeout(() => openFromUrl(u), 600); }
  if (first) setupPush(false);
  if (first && !annNow && S.me.admin && !store.get("admOk:" + S.me.id, false)) setTimeout(adminWelcome, 900);
  if (S.pendingInvite) { const code = S.pendingInvite; S.pendingInvite = null; try { sessionStorage.removeItem("nx:invite"); } catch {} joinModal(code); }
}

function onMsg({ channelId, serverId, m, nonce }) {
  const dm = isDm(channelId) ? S.dms.get(channelId) : isTicket(channelId) ? chan(channelId) : null;
  const s = dm ? { id: null, name: dm.ticket ? "Atendimento" : "Mensagem privada" } : S.servers.get(serverId);
  const c = dm ? chan(channelId) : s && s.channels.find(x => x.id === channelId);
  if (dm && dm.ticket && dm.order) dm.order.last = { id: m.id, ts: m.ts, a: m.a };
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
  callChatOnMsg(channelId, m);
  schedule("rail", "side", "title");
}
function rerenderVisible() {
  const el = box(), top = el.scrollTop, stick = atBottom();
  renderMessages(false);
  if (stick) scrollBottom(); else el.scrollTop = top;
}
function notify(m, s, c) {
  const u = user(m.a);
  const title = c.ticket ? `Atendimento · ${u.username}` : c.group ? `${u.username} em ${groupTitle(c)}` : c.dm ? `${u.username} (privado)` : `${u.username} em #${c.name} (${s.name})`;
  // no app Android o aviso sai pela notificação do próprio Android
  if (ANDROID && ANDROID.notify) { if (document.hidden) { try { ANDROID.notify(title, (m.t || "📎 Anexo").slice(0, 160), "/?c=" + encodeURIComponent(c.id)); } catch {} } return; }
  if (!S.settings.notify || !("Notification" in window) || Notification.permission !== "granted") return;
  if (document.hasFocus() && S.channelId === c.id) return;
  try {
    const n = new Notification(title, { body: (m.t || "📎 Anexo").slice(0, 160), tag: c.id, silent: true });
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
  const dmc = isDm(cid) ? S.dms.get(cid) : null;
  const s = dmc ? { id: cid } : serverOf(cid), c = chan(cid);
  if (!s || !c || (!dmc && c.type !== "voice")) return;
  if (V.channelId === cid) return;
  stopRing(cid);
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
    V.mySock = S.socket.id;
    callBackground(true);
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
  if (V.channelId) callBackground(false);
  CC.unread = 0;
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
  // nunca duas conexões com a mesma pessoa (era isso que fazia a voz sair dobrada depois de uma queda)
  for (const q of [...V.peers.values()]) if (q.userId === userId && q.sock !== sock) closePeer(q);
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
    watchPeer(p);
    schedule("vpanel", "stage");
  };
  if (initiator) addBaseTracks(p);
  return p;
}
function addBaseTracks(p) {
  if (p.tracksAdded) return;
  p.tracksAdded = true;
  const t = V.mic && V.mic.getAudioTracks()[0];
  if (t) { p.senders.mic = p.pc.addTrack(t, V.mic); voicePriority(p.senders.mic); }
  else if (!p.pc.getTransceivers().some(x => x.receiver.track.kind === "audio")) p.pc.addTransceiver("audio", { direction: "recvonly" });
  if (V.cam) addCamTo(p);
}
// a voz tem prioridade na rede sobre a tela e a câmera: com alguém transmitindo, a fala não atrasa
function voicePriority(sender) {
  if (!sender || !sender.getParameters) return;
  const go = () => {
    try {
      const prm = sender.getParameters();
      if (!prm.encodings || !prm.encodings.length) return false;
      prm.encodings[0].priority = "high"; prm.encodings[0].networkPriority = "high";
      sender.setParameters(prm).catch(() => {});
      return true;
    } catch { return true; }
  };
  if (!go()) setTimeout(go, 1500);
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
    const add = ["useinbandfec=1", "stereo=0", "maxaveragebitrate=64000"].filter(x => !params.includes(x.split("=")[0]));
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
  if (data.watch) { V.viewers.add(p.sock); p.viewer = data.dev || null; addScreenTo(p); return; }
  if (data.unwatch) { V.viewers.delete(p.sock); removeScreenFrom(p); rebalance(); endGrant(p.sock, true); return; }
  if (data.ctrlReq) { askControl(p); return; }
  if (data.ctrlGrant) { onGranted(p, data.ctrlGrant, data.pad); return; }
  if (data.ctrlPad) { onCtrlPad(p, data.ctrlPad); return; }
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
  if (e.track.kind === "audio") {
    // voz: o menor atraso que a rede permitir
    try { if ("jitterBufferTarget" in e.receiver) e.receiver.jitterBufferTarget = 0; } catch {}
  }
  if (e.track.kind === "video") {
    // Baixa latência: o navegador mostra o quadro assim que chega (ideal para jogo e controle remoto).
    try {
      if ("jitterBufferTarget" in e.receiver) e.receiver.jitterBufferTarget = 0;
      else if ("playoutDelayHint" in e.receiver) e.receiver.playoutDelayHint = 0;
    } catch {}
  }
  if (e.track.kind === "audio" && p.audios.has(stream.id)) {
    // a mesma transmissão voltou (parou de assistir e assistiu de novo): religa o som
    const a = p.audios.get(stream.id);
    a.srcObject = null; a.srcObject = stream;
    applyVolumes();
    playAudio(a);
  } else if (e.track.kind === "audio") {
    const vs = S.voice.get(p.userId);
    if (!vs || vs.screen !== stream.id) {
      for (const q of V.peers.values()) for (const [sid, el] of q.audios) {
        const qs = S.voice.get(q.userId);
        if (q.userId === p.userId && sid !== stream.id && !(qs && qs.screen === sid)) { el.pause(); el.srcObject = null; q.audios.delete(sid); }
      }
    }
    const a = new Audio();
    a.autoplay = true;
    a.srcObject = stream;
    p.audios.set(stream.id, a);
    if (S.settings.outputId && a.setSinkId) a.setSinkId(S.settings.outputId).catch(() => {});
    applyVolumes();
    playAudio(a);
    const st = S.voice.get(p.userId);
    if (!st || st.screen !== stream.id) attachMeter(p.userId, stream);
  }
  e.track.addEventListener("unmute", () => schedule("stage"));
  e.track.addEventListener("ended", () => { try { stream.removeTrack(e.track); } catch {} schedule("stage"); });
  stream.onremovetrack = () => schedule("stage");
  schedule("stage");
}
// O navegador às vezes não deixa tocar som sem um clique (ex.: depois de recarregar dentro da call).
// Antes isso falhava calado e a pessoa não ouvia ninguém; agora aparece um aviso e o primeiro clique libera.
const blockedAudio = new Set();
function playAudio(a) {
  const p = a.play();
  if (p && p.catch) p.catch(err => { if (err && err.name === "NotAllowedError") { blockedAudio.add(a); showAudioUnlock(); } });
}
function showAudioUnlock() {
  if ($("#audioUnlock")) return;
  const el = document.createElement("button");
  el.id = "audioUnlock"; el.className = "audio-unlock"; el.type = "button";
  el.innerHTML = `${ic("volume")}<span><b>Toque para ativar o som da call</b><small>O navegador pausou o áudio até você interagir</small></span>`;
  document.body.append(el);
  const go = () => {
    for (const a of blockedAudio) a.play().catch(() => {});
    blockedAudio.clear();
    if (V.ctx && V.ctx.state === "suspended") V.ctx.resume().catch(() => {});
    el.remove();
    removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true);
  };
  addEventListener("pointerdown", go, true); addEventListener("keydown", go, true);
}
// Conexão com alguém travou: tenta reiniciar; se não voltar, refaz a ligação do zero (só um lado refaz, para não brigar)
function watchPeer(p) {
  const pc = p.pc;
  clearTimeout(p.fixT);
  if (pc.connectionState === "connected") { p.fails = 0; return; }
  if (pc.connectionState !== "failed" && pc.connectionState !== "disconnected") return;
  p.fixT = setTimeout(() => {
    if (!V.peers.has(p.sock) || V.peers.get(p.sock) !== p) return;
    if (pc.connectionState === "connected") return;
    p.fails = (p.fails || 0) + 1;
    if (p.fails <= 1) { try { pc.restartIce(); } catch {} watchPeer(p); return; }
    if (S.socket && S.socket.id < p.sock) { console.warn("[voz] refazendo conexão com", user(p.userId).username); createPeer(p.sock, p.userId, true); }
  }, pc.connectionState === "failed" ? 1500 : 6000);
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
  if (V.channelId && "mediaSession" in navigator) { try { navigator.mediaSession.setMicrophoneActive(!(S.muted || S.deaf)); } catch {} }
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
function viewerEnc(p) {
  const q = QUALITY[V.screenCfg.quality] || QUALITY["1080"], v = p.viewer || {};
  const vt = V.screen && V.screen.getVideoTracks()[0], st = vt ? vt.getSettings() : {};
  const srcH = st.height || q.h;
  let maxH = v.mobile ? 720 : Math.max(480, Math.min(v.h || q.h, q.h));
  let br = screenBitrate(), fps = q.fps;
  if (v.mobile) { br = Math.min(br, 2500000); fps = Math.min(fps, 30); }
  if (v.slow) { br = Math.min(br, 1200000); maxH = Math.min(maxH, 540); fps = Math.min(fps, 24); }
  return { maxBitrate: br, maxFramerate: fps, scaleResolutionDownBy: Math.max(1, srcH / maxH) };
}
function addScreenTo(p) {
  if (!V.screen || p.senders.screen) return;
  const q = QUALITY[V.screenCfg.quality] || QUALITY["1080"], detail = V.screenCfg.mode === "detail";
  const vt = V.screen.getVideoTracks()[0];
  if (!vt) return;
  const tv = p.pc.addTransceiver(vt, { direction: "sendonly", streams: [V.screen], sendEncodings: [{ ...viewerEnc(p), priority: "high", networkPriority: "high" }] });
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
      Object.assign(prm.encodings[0], viewerEnc(p));
      tv.sender.setParameters(prm).catch(() => {});
    } catch {}
  }
}
async function startScreen(cfg) {
  const native = ANDROID && ANDROID.startScreen;
  if (!native && (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)) {
    toast(/Android/i.test(navigator.userAgent) ? "Para transmitir a tela no Android, use o app Auryx Nexos para Android (Configurações › Baixar o app)." : "Seu navegador não permite compartilhar a tela.", "error", 6000);
    return;
  }
  if (!V.channelId) { toast("Entre em uma sala de voz para transmitir.", "warn"); return; }
  const q = QUALITY[cfg.quality] || QUALITY["1080"];
  let stream;
  try {
    stream = native ? await androidScreenStream(q, cfg.audio) : await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: q.w, max: q.w }, height: { ideal: q.h, max: q.h }, frameRate: { ideal: q.fps, max: q.fps } },
      audio: cfg.audio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, restrictOwnAudio: true, suppressLocalAudioPlayback: false } : false,
      selfBrowserSurface: "exclude", surfaceSwitching: "include", systemAudio: cfg.audio ? "include" : "exclude"
    });
  } catch (e) {
    if (e.name !== "NotAllowedError" && e.name !== "AbortError") toast("Não foi possível compartilhar a tela.", "error");
    return;
  }
  if (!V.channelId) { stream.getTracks().forEach(t => t.stop()); return; }
  // garante que o som capturado não traga as vozes da call de volta (eco)
  for (const t of stream.getAudioTracks()) { try { await t.applyConstraints({ restrictOwnAudio: true }); } catch {} }
  if (cfg.audio && stream.getAudioTracks().length && !native && !(await ownAudioSafe(stream))) {
    // o som do PC inteiro levaria as vozes da call de volta para todo mundo (voz duplicada): manda só a imagem
    stream.getAudioTracks().forEach(t => { t.stop(); stream.removeTrack(t); });
    toast("Som do PC desligado nesta transmissão: no seu Windows ele levaria as vozes da call junto (eco). Para mandar som, transmita uma aba do navegador ou use o Windows 11.", "warn", 9000);
  }
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
// O som capturado pode trazer as vozes da call de volta? Aba do navegador: nunca.
// Tela/janela inteira: só é seguro onde o sistema separa o som do próprio app (Windows 11+, macOS).
async function ownAudioSafe(stream) {
  const at = stream.getAudioTracks()[0];
  if (!at) return true;
  const surface = (stream.getVideoTracks()[0] && stream.getVideoTracks()[0].getSettings().displaySurface) || "";
  if (surface === "browser") return true;
  const D = window.nexoraDesktop;
  if (D && D.winBuild) return D.winBuild >= 22000;
  const sup = navigator.mediaDevices.getSupportedConstraints ? navigator.mediaDevices.getSupportedConstraints() : {};
  if (!sup.restrictOwnAudio) return false;
  if (!/Windows/i.test(navigator.userAgent)) return /Mac/i.test(navigator.userAgent);
  try {
    const v = await navigator.userAgentData.getHighEntropyValues(["platformVersion"]);
    return parseInt(v.platformVersion, 10) >= 13;       // 13+ = Windows 11
  } catch { return false; }
}
function stopScreen(silent) {
  if (!V.screen) return;
  for (const sock of [...V.granted.keys()]) endGrant(sock);
  for (const p of V.peers.values()) removeScreenFrom(p);
  V.screen.getTracks().forEach(t => t.stop());
  if (V.screen._stopNative) V.screen._stopNative();
  V.screen = null;
  V.viewers.clear();
  if (!silent) { emit("voice:update", { screen: null }); sfx("unlive"); renderAll(); }
}

/* ------------------------------------------------------------------ */
/* App Android: tela transmitida pelo próprio Android (MediaProjection)*/
/* O app manda quadros JPEG; aqui eles viram um vídeo de verdade      */
/* (canvas → captureStream) que segue pelo WebRTC como qualquer tela. */
/* ------------------------------------------------------------------ */
/* Som do celular (Android 10+): o app manda PCM; aqui vira uma faixa de áudio para o WebRTC.
   Um buffer curto (~0,1 s) mantém o som junto com a imagem. */
function androidScreenAudio() {
  if (!ANDROID || !ANDROID.screenAudio || !ANDROID.audio) return null;
  try { if (ANDROID.screenAudioSupported && !ANDROID.screenAudioSupported()) return null; } catch { return null; }
  let ctx;
  try { ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" }); } catch { try { ctx = new AudioContext(); } catch { return null; } }
  const rate = ctx.sampleRate === 44100 ? 44100 : 48000;
  const N = rate * 2, L = new Float32Array(N), R = new Float32Array(N);
  let w = 0, r = 0;
  const filled = () => (w - r + N) % N;
  const sp = ctx.createScriptProcessor(2048, 1, 2), dest = ctx.createMediaStreamDestination();
  sp.onaudioprocess = e => {
    const oL = e.outputBuffer.getChannelData(0), oR = e.outputBuffer.getChannelData(1), n = oL.length;
    if (filled() > rate * 0.3) r = (w - Math.round(rate * 0.1) + N) % N;    // atrasou: pula para perto do agora
    for (let i = 0; i < n; i++) {
      if (r === w) { oL[i] = 0; oR[i] = 0; continue; }
      oL[i] = L[r]; oR[i] = R[r]; r = (r + 1) % N;
    }
  };
  sp.connect(dest);
  ctx.resume().catch(() => {});
  const pull = setInterval(() => {
    let b64 = "";
    try { b64 = ANDROID.audio(); } catch {}
    if (!b64) return;
    const bin = atob(b64), n = bin.length >> 2;
    for (let i = 0; i < n; i++) {
      const k = i << 2;
      let l = bin.charCodeAt(k) | (bin.charCodeAt(k + 1) << 8), rr = bin.charCodeAt(k + 2) | (bin.charCodeAt(k + 3) << 8);
      if (l > 32767) l -= 65536;
      if (rr > 32767) rr -= 65536;
      L[w] = l / 32768; R[w] = rr / 32768; w = (w + 1) % N;
      if (w === r) r = (r + 1) % N;
    }
  }, 40);
  return {
    rate, track: dest.stream.getAudioTracks()[0],
    stop() { clearInterval(pull); try { sp.disconnect(); } catch {} ctx.close().catch(() => {}); }
  };
}
function androidScreenStream(q, wantAudio) {
  return new Promise((resolve, reject) => {
    const fps = Math.min(q.fps, 30);
    const snd = wantAudio ? androidScreenAudio() : null;
    try { if (ANDROID.screenAudio) ANDROID.screenAudio(!!snd, snd ? snd.rate : 48000); } catch {}
    window.__axScreenResult = ok => {
      window.__axScreenResult = null;
      if (!ok) { if (snd) snd.stop(); const e = new Error("negado"); e.name = "NotAllowedError"; reject(e); return; }
      const cv = document.createElement("canvas");
      cv.width = 1280; cv.height = 720;
      const g = cv.getContext("2d");
      const stream = cv.captureStream(0);
      const vtr = stream.getVideoTracks()[0];
      if (vtr && "contentHint" in vtr) vtr.contentHint = "motion";
      let busy = false, alive = true, sized = false;
      const toBlob = b64 => fetch("data:image/jpeg;base64," + b64).then(r => r.blob());
      const pull = setInterval(async () => {
        if (busy || !alive) return;
        let b64 = "";
        try { b64 = ANDROID.frame(); } catch {}
        if (!b64) return;
        busy = true;
        try {
          const bmp = await createImageBitmap(await toBlob(b64));
          if (!sized || cv.width !== bmp.width || cv.height !== bmp.height) { cv.width = bmp.width; cv.height = bmp.height; sized = true; }
          g.drawImage(bmp, 0, 0);
          if (vtr && vtr.requestFrame) vtr.requestFrame();
          bmp.close && bmp.close();
        } catch {}
        busy = false;
      }, Math.max(15, Math.round(500 / fps)));
      // o usuário pode parar pela notificação do Android
      const watch = setInterval(() => { let on = true; try { on = ANDROID.screenActive(); } catch {} if (!on && alive) stopScreen(); }, 1000);
      if (snd && snd.track) stream.addTrack(snd.track);
      stream._stopNative = () => { alive = false; clearInterval(pull); clearInterval(watch); if (snd) snd.stop(); try { ANDROID.stopScreen(); } catch {} };
      resolve(stream);
    };
    try { ANDROID.startScreen(q.w, q.h, fps); } catch (e) { window.__axScreenResult = null; if (snd) snd.stop(); reject(e); }
  });
}

/* ------------------------------------------------------------------ */
/* Segundo plano: a chamada continua com a tela bloqueada              */
/* ------------------------------------------------------------------ */
let keepAlive = null;
const MS_ACTIONS = ["hangup", "togglemicrophone", "stop", "pause", "play"];
function callBackground(on) {
  const c = on ? chan(V.channelId) : null, s = on ? S.servers.get(V.serverId) : null;
  if (ANDROID && ANDROID.callState) { try { ANDROID.callState(!!on, on ? `${c ? c.name : "Sala de voz"} · ${s ? s.name : ""}` : ""); } catch {} }
  if ("mediaSession" in navigator) {
    const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch {} };
    try {
      if (on) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: `Em chamada: ${c ? c.name : "sala de voz"}`, artist: s ? s.name : "Auryx Nexos", album: "Auryx Nexos", artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
        navigator.mediaSession.playbackState = "playing";
        set("hangup", () => leaveVoice()); set("stop", () => leaveVoice());
        set("togglemicrophone", () => toggleMute()); set("pause", () => toggleMute()); set("play", () => toggleMute());
        try { navigator.mediaSession.setMicrophoneActive(!(S.muted || S.deaf)); } catch {}
      } else {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
        MS_ACTIONS.forEach(a => set(a, null));
      }
    } catch {}
  }
  // um "som" silencioso mantém a página como mídia tocando: o celular não congela a chamada
  if (on && !keepAlive && V.ctx) {
    try {
      const dest = V.ctx.createMediaStreamDestination(), g = V.ctx.createGain(), o = V.ctx.createOscillator();
      g.gain.value = 0.00001; o.connect(g).connect(dest); o.start();
      const a = new Audio(); a.srcObject = dest.stream; a.play().catch(() => {});
      keepAlive = { a, o };
    } catch {}
  }
  if (!on && keepAlive) { try { keepAlive.o.stop(); keepAlive.a.pause(); keepAlive.a.srcObject = null; } catch {} keepAlive = null; }
}

/* ------------------------------------------------------------------ */
/* Notificações push (chegam com o app fechado)                        */
/* ------------------------------------------------------------------ */
const b64ToU8 = s => { const p = "=".repeat((4 - (s.length % 4)) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const pushSupported = () => !LOCAL && !ANDROID && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function setupPush(ask) {
  if (!pushSupported()) return false;
  try {
    if (Notification.permission === "default" && ask) await Notification.requestPermission();
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.ready;
    const k = await emit("push:key", {});
    if (!k.key) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(k.key) });
    const r = await emit("push:sub", { sub: sub.toJSON() });
    if (!r.error) { S.settings.notify = true; saveSettings(); }
    return !r.error;
  } catch (e) { console.warn("[push]", e); return false; }
}
// o app abriu da cópia guardada e o servidor tem versão nova: oferece atualizar (sem interromper a call)
function showUpdateBar() {
  if ($("#updBar")) return;
  const el = document.createElement("div");
  el.id = "updBar";
  el.className = "upd-bar";
  el.innerHTML = `${ic("sparkles", "sm")}<span>Nova versão da Auryx Nexos disponível</span><button class="btn sm primary" type="button">Atualizar</button><button class="icon-btn" type="button" aria-label="Depois">${ic("x", "sm")}</button>`;
  el.querySelector(".btn").onclick = () => { if (V.channelId && !confirm("Atualizar agora vai sair da chamada. Continuar?")) return; location.reload(); };
  el.querySelector(".icon-btn").onclick = () => el.remove();
  document.body.append(el);
}
function openFromUrl(url) {
  try {
    const u = new URL(url, location.origin), c = u.searchParams.get("c"), a = u.searchParams.get("abrir"), call = u.searchParams.get("atender");
    if (call && S.dms.get(call)) { stopRing(); if ([...S.voice.values()].some(v => v.channelId === call)) openDMCall(call); else openDM(call); return; }
    if (c && isTicket(c)) openTicket(c.slice(2));
    else if (c && chan(c)) openChannel(c);
    else if (a === "amigos") goFriends();
    else if (a === "premium") goPremium();
    else if (a === "jogos") goGames();
  } catch {}
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
  const conn = navigator.connection || {};
  sig(p.sock, { watch: true, dev: { w: Math.round(screen.width * (devicePixelRatio || 1)), h: Math.round(screen.height * (devicePixelRatio || 1)), mobile: matchMedia("(pointer: coarse)").matches || !!ANDROID, slow: /(^|-)2g|3g/.test(conn.effectiveType || "") || !!conn.saveData } });
  V.focus = uid + ":screen";
  schedule("stage");
}
function unwatch(uid) {
  if (V.controlling && V.controlling.uid === uid) stopControlling();
  V.watching.delete(uid);
  const p = peerByUser(uid), st = S.voice.get(uid);
  if (p) sig(p.sock, { unwatch: true });
  if (p && st && st.screen) {
    const au = p.audios.get(st.screen);
    if (au) { au.pause(); au.srcObject = null; p.audios.delete(st.screen); }
    p.streams.delete(st.screen);
  }
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
/* dados direto entre os dois PCs. Quem transmite precisa da Auryx Nexos    */
/* Agente aberto e aceitar o pedido — nada acontece sem permissão.     */
/* ------------------------------------------------------------------ */
// ver = versão do agente (2 = controles virtuais + mouse relativo); pad = "ok" | "nodriver" | "erro" | ""
const AG = { ws: null, ver: 0, pad: "" };
const agentOk = () => !!(AG.ws && AG.ws.readyState === 1);
const VIGEM_URL = "https://github.com/nefarius/ViGEmBus/releases/latest";
const padReady = () => agentOk() && AG.pad === "ok";
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
    if (!code) return rej(new Error("Abra o Agente Auryx e digite o código em Configurações › Controle remoto."));
    let ws;
    try { ws = new WebSocket(`ws://127.0.0.1:47800/?t=${encodeURIComponent(code)}`); }
    catch { return rej(new Error("O navegador bloqueou a conexão com o Agente Auryx.")); }
    const t = setTimeout(() => { try { ws.close(); } catch {} rej(new Error("Agente Auryx não respondeu. Ele está aberto?")); }, 4000);
    let helloWait = 0;
    const done = () => { clearTimeout(helloWait); helloWait = -1; res(); renderCtrlBar(); };
    ws.onopen = () => {
      clearTimeout(t); AG.ws = ws; AG.ver = 0; AG.pad = "";
      helloWait = setTimeout(done, 1500);       // agente antigo não se apresenta: segue sem controle virtual
    };
    ws.onmessage = e => {
      const line = String(e.data || "");
      if (line.startsWith("hello ")) {
        AG.ver = parseInt(line.split(" ")[1], 10) || 1;
        AG.pad = (/pad=(\w+)/.exec(line) || [])[1] || "";
        if (helloWait !== -1) done();
      } else onAgentMsg(line);
    };
    ws.onerror = () => { clearTimeout(t); rej(new Error("Agente Auryx não encontrado ou código errado.")); };
    ws.onclose = () => {
      if (AG.ws !== ws) return;
      AG.ws = null; AG.ver = 0;
      V.padUsed.clear();
      if (V.granted.size) { for (const sock of [...V.granted.keys()]) endGrant(sock); toast("O Agente Auryx foi fechado — controle encerrado.", "warn"); }
    };
  });
}
// respostas do agente sobre os controles virtuais: "pad <vaga> ok <jogador>" ou "pad <vaga> erro <motivo>"
function onAgentMsg(line) {
  const a = line.split(" ");
  if (a[0] !== "pad") return;
  const slot = +a[1];
  for (const [sock, g] of V.granted) {
    if (!g.pads) continue;
    for (const [i, s] of g.pads) {
      if (s !== slot) continue;
      const name = user(g.uid).username;
      if (a[2] === "ok") {
        const player = +a[3] >= 0 ? +a[3] + 1 : 0;
        toast(`🎮 Controle de ${name} conectado no seu PC${player ? ` como Jogador ${player}` : ""}.`, "ok", 5000);
        sig(sock, { ctrlPad: { i, ok: true, player } });
      } else {
        toast(`Não deu para criar o controle virtual de ${name}: ${a.slice(3).join(" ") || "erro"}. O controle dele vai virar teclado.`, "warn", 7000);
        sig(sock, { ctrlPad: { i, ok: false } });
        g.pads.delete(i); V.padUsed.delete(s);
      }
      return;
    }
  }
}
// vaga do agente (0–3) para o controle número i de quem joga junto; o Windows aceita no máximo 4 controles
function padSlot(g, i) {
  g.pads = g.pads || new Map();
  if (g.pads.has(i)) return g.pads.get(i);
  for (let s = 0; s < 4; s++) if (!V.padUsed.has(s)) { V.padUsed.add(s); g.pads.set(i, s); return s; }
  if (!g.padFull) { g.padFull = true; toast("Limite de 4 controles virtuais atingido.", "warn"); }
  return -1;
}
function freePads(g) {
  if (!g || !g.pads) return;
  for (const s of g.pads.values()) { agentSend(`px ${s}`); V.padUsed.delete(s); }
  g.pads.clear();
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
// Segurança do controle: pedidos só com a sua permissão, no máximo um pedido aberto por pessoa,
// espera de 20 s depois de uma recusa, opção de bloquear todos os pedidos e fim automático
// do controle depois de 15 min sem uso. Cada sessão fica no histórico deste aparelho.
const CTRL_IDLE = 15 * 60e3, CTRL_RETRY = 20e3;
let ctrlIdleTimer = 0, agentStopTimer = 0;
function ctrlLogAdd(entry) {
  const list = store.get("ctrlLog", []);
  list.unshift(entry);
  store.set("ctrlLog", list.slice(0, 30));
}
function ctrlLogEnd(g, why) {
  if (!g || !g.logAt) return;
  const list = store.get("ctrlLog", []), e = list.find(x => x.at === g.logAt && x.uid === g.uid);
  if (e && !e.end) { e.end = Date.now(); e.why = why || ""; store.set("ctrlLog", list); }
}
function ctrlWatch() {
  // um relógio só enquanto alguém tem permissão; desliga sozinho depois
  if (V.granted.size && !ctrlIdleTimer) ctrlIdleTimer = setInterval(() => {
    const now = Date.now();
    for (const [sock, g] of [...V.granted]) if (now - (g.last || g.since) > CTRL_IDLE) {
      endGrant(sock, false, "inativo");
      toast(`O controle de ${user(g.uid).username} terminou sozinho depois de 15 min sem uso.`, "info", 6000);
    }
    if (!V.granted.size) { clearInterval(ctrlIdleTimer); ctrlIdleTimer = 0; }
  }, 30e3);
  // app de PC: o agente embutido fecha 2 min depois que ninguém mais tem permissão (não fica escutando à toa)
  clearTimeout(agentStopTimer);
  if (!V.granted.size && DESKTOP && DESKTOP.stopAgent) agentStopTimer = setTimeout(() => {
    if (V.granted.size) return;
    if (AG.ws) { const ws = AG.ws; AG.ws = null; try { ws.close(); } catch {} }
    DESKTOP.stopAgent().catch(() => {});
  }, 120e3);
}
function askControl(p) {
  const u = user(p.userId);
  if (!V.screen) { sig(p.sock, { ctrlDeny: "Essa pessoa não está transmitindo a tela agora." }); return; }
  if (V.granted.has(p.sock)) { const g = V.granted.get(p.sock); sig(p.sock, { ctrlGrant: g.mode, pad: g.pad ? 2 : 0 }); return; }
  if (S.settings.noCtrl) { sig(p.sock, { ctrlDeny: "Essa pessoa não está aceitando pedidos de controle agora." }); return; }
  if (p.ctrlAsking) return;                                                     // já tem um pedido aberto na tela
  if (p.ctrlDeniedAt && Date.now() - p.ctrlDeniedAt < CTRL_RETRY) { sig(p.sock, { ctrlDeny: "Pedido recusado há pouco. Espere alguns segundos para pedir de novo." }); return; }
  p.ctrlAsking = true;
  const surface = (V.screen.getVideoTracks()[0]?.getSettings() || {}).displaySurface;
  sfx("mention");
  let mode = "coop", answered = false;
  modal({
    title: `${esc(u.username)} quer controlar`, sub: "Escolha o que essa pessoa pode fazer no seu PC.",
    body: `<div class="invite-card" style="--c:${esc(u.color)}">${avatar(u, 48)}<div><b>${esc(u.username)}</b><small>está assistindo sua transmissão</small></div></div>
      <label class="radio-card on">${ic("gamepad", "lg")}<span><b>Co-op (jogar junto)</b><small>Só teclado e controle — ideal para co-op local. Mouse bloqueado.</small></span><input type="radio" name="cm" value="coop" checked></label>
      <label class="radio-card">${ic("pointer", "lg")}<span><b>Controle total</b><small>Mouse e teclado, como AnyDesk.${surface && surface !== "monitor" ? " <b style='color:var(--yellow)'>Transmita a tela inteira para o mouse cair no lugar certo.</b>" : ""}</small></span><input type="radio" name="cm" value="full"></label>
      <div class="hint" style="margin:10px 0 0">${DESKTOP || agentOk() ? "✅ Controle remoto pronto." : "⚠️ O Agente Auryx precisa estar aberto neste PC (Configurações › Controle remoto) — ou use o app de PC, que já vem com ele."} Você pode encerrar a qualquer momento.</div>
      ${agentOk() && AG.pad && AG.pad !== "ok" ? `<div class="hint" style="margin:8px 0 0">🎮 Para o jogo reconhecer o controle dessa pessoa como <b>Jogador 2</b>, instale o driver gratuito <a href="${VIGEM_URL}" target="_blank" rel="noopener">ViGEmBus</a> (uma vez só). Sem ele, o controle vira teclado.</div>` : ""}
      <div class="modal-foot"><button class="btn ghost" data-no>Recusar</button><button class="btn primary" data-yes>Permitir</button></div>`,
    onMount(m, close) {
      m.addEventListener("change", e => { if (e.target.name === "cm") { mode = e.target.value; $$(".radio-card", m).forEach(r => r.classList.toggle("on", r.querySelector("input").checked)); } });
      m.querySelector("[data-no]").onclick = () => { answered = true; p.ctrlDeniedAt = Date.now(); close(); sig(p.sock, { ctrlDeny: true }); };
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
        const now = Date.now(), pad = padReady();
        V.granted.set(p.sock, { uid: p.userId, mode, alt: false, since: now, last: now, logAt: now, pad, pads: new Map() });
        ctrlLogAdd({ at: now, uid: p.userId, name: u.username, mode });
        ctrlWatch();
        // pad: 2 = este PC cria controles de Xbox virtuais (cada pessoa vira outro jogador no jogo)
        sig(p.sock, { ctrlGrant: mode, pad: pad ? 2 : 0 });
        toast(`${u.username} agora pode ${mode === "full" ? "controlar seu PC" : "jogar com você"}.`, "ok");
        if (!pad && mode === "coop") toast(`Sem o driver ViGEmBus, o controle de ${u.username} vira teclado e o jogo pode achar que é o Jogador 1. Veja Configurações › Controle remoto.`, "warn", 9000);
        renderCtrlBar();
      };
    },
    onClose() { p.ctrlAsking = false; if (!answered) { p.ctrlDeniedAt = Date.now(); sig(p.sock, { ctrlDeny: true }); } }
  });
}
function endGrant(sock, silent, why) {
  const g = V.granted.get(sock);
  if (!g) return;
  V.granted.delete(sock);
  agentSend("u 0\nu 1\nu 2");
  freePads(g);                                   // tira os controles virtuais dessa pessoa do Windows
  if (!silent) sig(sock, { ctrlEnd: true });
  ctrlLogEnd(g, why);
  ctrlWatch();
  renderCtrlBar();
}
function onRemoteInput(p, data) {
  const g = V.granted.get(p.sock);
  if (!g || !agentOk() || typeof data !== "string" || data.length > 2000) return;
  g.last = Date.now();
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
    } else if (a[0] === "r" && g.mode === "full") {
      // mouse relativo (jogos 3D): só no controle total
      const dx = Math.round(clamp(+a[1] || 0, -800, 800)), dy = Math.round(clamp(+a[2] || 0, -800, 800));
      if (dx || dy) out.push(`r ${dx} ${dy}`);
    } else if (a[0] === "p" && g.pad) {
      // estado do controle: p <nº do controle> <botões> <LT> <RT> <LX> <LY> <RX> <RY>
      const i = Math.round(+a[1]);
      if (!(i >= 0 && i <= 3) || a.length < 9) continue;
      const slot = padSlot(g, i);
      if (slot < 0) continue;
      const n = (v, lo, hi) => Math.round(clamp(+v || 0, lo, hi));
      // botão Guia (0x0400) bloqueado: abriria a Xbox Game Bar no seu PC
      out.push(`p ${slot} ${n(a[2], 0, 0xffff) & ~0x0400} ${n(a[3], 0, 255)} ${n(a[4], 0, 255)} ${n(a[5], -32768, 32767)} ${n(a[6], -32768, 32767)} ${n(a[7], -32768, 32767)} ${n(a[8], -32768, 32767)}`);
    } else if (a[0] === "px") {
      const i = Math.round(+a[1]), s = g.pads && g.pads.get(i);
      if (s !== undefined) { out.push(`px ${s}`); g.pads.delete(i); V.padUsed.delete(s); }
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
function onGranted(p, mode, pad) {
  const prev = V.controlling && V.controlling.sock === p.sock ? V.controlling : null;
  V.controlling = { uid: p.userId, sock: p.sock, mode: mode === "full" ? "full" : "coop", kb: false, keys: new Set(), padKeys: new Set(), preset: store.get("padPreset", "wasd"),
    // pad: o PC de quem transmite cria controles de Xbox virtuais (cada controle seu vira um jogador no jogo)
    pad: +pad >= 2, kbPad: store.get("kbPad", false), padSent: new Map(), padFail: new Set(), player: {}, kbState: new Set() };
  if (prev) { V.controlling.padSent = prev.padSent; V.controlling.player = prev.player; }
  V.focus = p.userId + ":screen";
  sfx("live");
  const padTip = V.controlling.pad ? " Seu controle aparece no PC dele como um controle de Xbox (outro jogador) — no jogo, aperte Start para entrar." : "";
  toast(mode === "full" ? `Você está controlando o PC de ${user(p.userId).username}. Clique na transmissão para usar mouse e teclado.${padTip}` : `Co-op liberado! Clique na transmissão e jogue com controle${V.controlling.pad ? "" : " ou teclado"}.${padTip}`, "ok", 7000);
  if (S.view !== "stage" && V.channelId) openChannel(V.channelId, false);
  schedule("stage");
  renderCtrlBar();
  padLoop();
}
function dcSend(line) {
  const c = V.controlling, p = c && V.peers.get(c.sock);
  if (p && p.dc && p.dc.readyState === "open") p.dc.send(line);
}
// resposta do PC de quem transmite sobre o controle virtual número i
function onCtrlPad(p, d) {
  const c = V.controlling;
  if (!c || c.sock !== p.sock || !d) return;
  const i = +d.i;
  if (d.ok) { c.player[i] = +d.player || 0; toast(`🎮 Seu controle${i ? " " + (i + 1) : ""} está conectado${c.player[i] ? ` como Jogador ${c.player[i]}` : ""}. No jogo, aperte Start para entrar.`, "ok", 6000); }
  else { c.padFail.add(i); toast("O PC de quem transmite não conseguiu criar o controle virtual. Seu controle vai virar teclado.", "warn", 7000); }
  renderCtrlBar();
}
function stopControlling(silent, msg) {
  const c = V.controlling;
  if (!c) return;
  const ups = [...c.keys, ...c.padKeys].map(vk => `k 0 ${vk} 0`);
  if (ups.length) dcSend(ups.join("\n"));
  if (c.pad) { const px = [...c.padSent.keys()].map(i => `px ${i}`); if (px.length) dcSend(px.join("\n")); }
  if (document.pointerLockElement) document.exitPointerLock();
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
let pendingMove = null, moveRaf = 0, relMove = null;
// Mouse travado (Pointer Lock): manda movimento relativo, que é o que jogos 3D/FPS leem para girar a câmera
const mouseLocked = () => { const v = ctrlVideo(); return !!(v && document.pointerLockElement === v); };
function toggleMouseLock() {
  const c = V.controlling, v = ctrlVideo();
  if (!c || c.mode !== "full" || !v) return;
  if (document.pointerLockElement) { document.exitPointerLock(); return; }
  c.kb = true; v.closest(".tile").classList.add("kb");
  const r = v.requestPointerLock && v.requestPointerLock();
  if (r && r.catch) r.catch(() => toast("O navegador não deixou travar o mouse. Clique na transmissão e tente de novo.", "warn"));
  toast("Mouse travado no jogo (bom para jogos 3D). Aperte Esc para soltar.", "info", 5000);
}
// Teclado como controle de Xbox (para quem não tem controle): vira o controle nº 4 no PC de quem transmite
const KBPAD = {
  KeyW: ["ly", 1], KeyS: ["ly", -1], KeyA: ["lx", -1], KeyD: ["lx", 1], KeyI: ["ry", 1], KeyK: ["ry", -1], KeyJ: ["rx", -1], KeyL: ["rx", 1],
  ArrowUp: 0x0001, ArrowDown: 0x0002, ArrowLeft: 0x0004, ArrowRight: 0x0008, Space: 0x1000, KeyE: 0x2000, KeyQ: 0x4000, KeyR: 0x8000,
  Digit1: 0x0100, Digit3: 0x0200, KeyZ: "lt", KeyC: "rt", Enter: 0x0010, Tab: 0x0020, KeyF: 0x0040, KeyH: 0x0080
};
const KBPAD_HELP = [["W A S D", "analógico esquerdo"], ["I J K L", "analógico direito"], ["Setas", "direcional"], ["Espaço", "A"], ["E", "B"], ["Q", "X"], ["R", "Y"], ["1 / 3", "LB / RB"], ["Z / C", "LT / RT"], ["Enter", "Start"], ["Tab", "Back"], ["F / H", "L3 / R3"]];
const KB_PAD = 3;
function kbPadState(set) {
  let btn = 0, lt = 0, rt = 0;
  const ax = { lx: 0, ly: 0, rx: 0, ry: 0 };
  for (const code of set) {
    const v = KBPAD[code];
    if (typeof v === "number") btn |= v; else if (v === "lt") lt = 255; else if (v === "rt") rt = 255; else if (Array.isArray(v)) ax[v[0]] += v[1];
  }
  const s = v => Math.round(clamp(v, -1, 1) * 32767);
  return `${btn} ${lt} ${rt} ${s(ax.lx)} ${s(ax.ly)} ${s(ax.rx)} ${s(ax.ry)}`;
}
function sendPad(c, i, st) {
  if (c.padSent.get(i) === st) return;
  c.padSent.set(i, st);
  dcSend(`p ${i} ${st}`);
}
function wireControlInput() {
  const grid = () => $("#stageGrid");
  const onTarget = e => { const v = ctrlVideo(); return v && (e.target === v || (e.target.closest && e.target.closest(".tile") === v.closest(".tile") && !e.target.closest("button"))) ? v : null; };
  const btnOf = e => (e.button === 2 ? 2 : e.button === 1 ? 1 : 0);
  document.addEventListener("pointerlockchange", () => {
    const c = V.controlling;
    if (!document.pointerLockElement && c && c.mode === "full") { relMove = null; dcSend("u 0\nu 1\nu 2"); }
    renderCtrlBar();
  });
  document.addEventListener("pointermove", e => {
    const c = V.controlling;
    if (!c || c.mode !== "full") return;
    if (mouseLocked()) {
      // soma o movimento e manda no máximo uma vez por quadro
      relMove = relMove || { x: 0, y: 0 };
      relMove.x += e.movementX || 0; relMove.y += e.movementY || 0;
      if (!moveRaf) moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        const r = relMove; relMove = null;
        if (r && (r.x || r.y)) dcSend(`r ${Math.round(r.x)} ${Math.round(r.y)}`);
      });
      return;
    }
    const v = onTarget(e); if (!v) return;
    const pt = videoPoint(v, e); if (!pt) return;
    pendingMove = pt;
    if (!moveRaf) moveRaf = requestAnimationFrame(() => { moveRaf = 0; if (pendingMove) dcSend(`m ${pendingMove.x.toFixed(5)} ${pendingMove.y.toFixed(5)}`); pendingMove = null; });
  }, { passive: true });
  document.addEventListener("pointerdown", e => {
    const c = V.controlling;
    if (!c) return;
    if (c.mode === "full" && mouseLocked()) { e.preventDefault(); dcSend(`d ${btnOf(e)}`); return; }
    const v = onTarget(e);
    c.kb = !!v;
    v && v.closest(".tile").classList.add("kb");
    if (!v) { $$(".tile.kb").forEach(t => t.classList.remove("kb")); releaseKeys(); return; }
    if (c.mode !== "full") return;
    const pt = videoPoint(v, e);
    if (!pt) return;
    e.preventDefault();
    dcSend(`m ${pt.x.toFixed(5)} ${pt.y.toFixed(5)}\nd ${btnOf(e)}`);
  }, true);
  document.addEventListener("pointerup", e => {
    const c = V.controlling;
    if (!c || c.mode !== "full" || (!mouseLocked() && !onTarget(e))) return;
    dcSend(`u ${btnOf(e)}`);
  }, true);
  document.addEventListener("contextmenu", e => { if (V.controlling && onTarget(e)) e.preventDefault(); }, true);
  document.addEventListener("wheel", e => {
    const c = V.controlling;
    if (!c || c.mode !== "full" || (!mouseLocked() && !onTarget(e))) return;
    e.preventDefault();
    dcSend(`w ${-Math.sign(e.deltaY) * 120}`);
  }, { passive: false, capture: true });
  const key = down => e => {
    const c = V.controlling;
    if (!c || !c.kb) return;
    // teclado como controle de Xbox (só quando o PC de quem transmite tem controle virtual)
    if (c.pad && c.kbPad && !c.padFail.has(KB_PAD) && KBPAD[e.code] !== undefined) {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      if (down) c.kbState.add(e.code); else c.kbState.delete(e.code);
      sendPad(c, KB_PAD, kbPadState(c.kbState));
      return;
    }
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
  if (c.kbState && c.kbState.size) { c.kbState.clear(); sendPad(c, KB_PAD, kbPadState(c.kbState)); }
}
// Botões no padrão do navegador (Xbox, PlayStation e a maioria dos genéricos) -> botões do controle de Xbox
// 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 Back/Share · 9 Start/Options · 10 L3 · 11 R3 · 12–15 direcional · 16 Guia
const XB_BTN = [0x1000, 0x2000, 0x4000, 0x8000, 0x0100, 0x0200, 0, 0, 0x0020, 0x0010, 0x0040, 0x0080, 0x0001, 0x0002, 0x0004, 0x0008, 0x0400];
const PAD_IDLE = "0 0 0 0 0 0 0";
function padState(gp) {
  let btn = 0;
  for (let i = 0; i < XB_BTN.length; i++) if (XB_BTN[i] && gp.buttons[i] && gp.buttons[i].pressed) btn |= XB_BTN[i];
  const trig = i => { const b = gp.buttons[i]; return b ? Math.round(clamp(b.value || (b.pressed ? 1 : 0), 0, 1) * 255) : 0; };
  // zona morta de 10% (controle parado não manda nada) e 256 degraus por lado (menos mensagens, sem perda perceptível)
  const ax = i => { let v = +gp.axes[i] || 0; if (Math.abs(v) < 0.1) v = 0; return Math.round(Math.round(clamp(v, -1, 1) * 255) / 255 * 32767); };
  // no navegador "para cima" é negativo; no controle de Xbox é positivo
  return `${btn} ${trig(6)} ${trig(7)} ${ax(0)} ${-ax(1) || 0} ${ax(2)} ${-ax(3) || 0}`;
}
// Controle (gamepad) de quem controla -> controle de Xbox virtual no PC de quem transmite
// (ou, se ele não tiver o driver, -> teclas, como antes)
function padLoop(ref) {
  const c = V.controlling;
  if (!c || (ref && ref !== c) || (!ref && c.looping)) return;
  c.looping = true;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const asKeys = [];
  for (const gp of pads) {
    const i = gp.index;
    if (!c.pad || i > 2 || c.padFail.has(i)) { asKeys.push(gp); continue; }
    sendPad(c, i, padState(gp));
    if (!c.padSeen) { c.padSeen = true; renderCtrlBar(); }
    if (gp.mapping !== "standard" && !c.padOdd) { c.padOdd = true; toast("Esse controle não usa o mapeamento padrão do navegador: alguns botões podem ficar trocados.", "warn", 6000); }
  }
  // controle desconectado deste lado: solta tudo no controle virtual (a vaga continua dele)
  for (const [i, st] of c.padSent) if (i !== KB_PAD && st !== PAD_IDLE && !pads.some(gp => gp.index === i)) sendPad(c, i, PAD_IDLE);
  const gp = asKeys[0];
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
  } else if (c.padKeys.size) {                    // controle tirado no meio: solta as teclas que ele segurava
    dcSend([...c.padKeys].map(vk => `k 0 ${vk} ${EXT_VK.has(vk) ? 1 : 0}`).join("\n"));
    c.padKeys = new Set();
  }
  if (pads.length) requestAnimationFrame(() => padLoop(c));   // controle ligado: lê a cada quadro
  else setTimeout(() => padLoop(c), 500);                       // sem controle: verifica de vez em quando (economiza CPU)
}
function renderCtrlBar() {
  const el = $("#ctrlBar");
  const c = V.controlling;
  let h = "";
  for (const [sock, g] of V.granted) {
    const n = g.pads ? g.pads.size : 0;
    h += `<div class="cb-row host">${ic(g.mode === "full" ? "pointer" : "gamepad", "sm")}<span><b>${esc(user(g.uid).username)}</b> ${g.mode === "full" ? "está controlando seu PC" : "está jogando com você (co-op)"}${n ? ` · 🎮 ${n} ${n === 1 ? "controle virtual" : "controles virtuais"}` : ""}</span><button class="btn danger sm" data-act="ctrl-revoke" data-sock="${esc(sock)}">Encerrar</button></div>`;
  }
  if (c) {
    const pr = PAD_PRESETS[c.preset] || PAD_PRESETS.wasd;
    const players = Object.values(c.player || {}).filter(Boolean);
    const padTxt = c.pad ? ` · 🎮 controle de Xbox virtual${players.length ? ` (Jogador ${players.join(", ")})` : ""}${c.kbPad ? " · teclado = controle" : ""}` : c.padSeen ? ` · 🎮 ${pr.name}` : "";
    h += `<div class="cb-row">${ic(c.mode === "full" ? "pointer" : "gamepad", "sm")}<span>${c.mode === "full" ? "Controlando" : "Co-op com"} <b>${esc(user(c.uid).username)}</b> · clique na tela para usar o teclado${padTxt}</span>${c.mode === "full" ? `<button class="btn sm" data-act="ctrl-lock" data-tip="${document.pointerLockElement ? "Soltar o mouse (Esc)" : "Travar o mouse no jogo (jogos 3D)"}">${ic("pointer", "sm")}</button>` : ""}<button class="btn sm" data-act="pad-preset" data-tip="Controle e teclado">${ic("gamepad", "sm")}</button><button class="btn sm" data-act="ctrl-stop">Parar</button></div>`;
  }
  el.innerHTML = h;
  el.classList.toggle("hidden", !h);
}
function kbPadHelp() {
  modal({
    title: "Teclado como controle", sub: "Cada tecla vira um botão do controle de Xbox no PC de quem transmite.",
    body: `<div class="steps">${KBPAD_HELP.map(([k, v]) => `<div class="step"><b>${ic("gamepad", "xs")}</b><div><b><span class="kbd">${esc(k)}</span></b><small>${esc(v)}</small></div></div>`).join("")}</div><div class="modal-foot"><button class="btn primary" data-ok>Entendi</button></div>`,
    onMount(m, close) { m.querySelector("[data-ok]").onclick = close; }
  });
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
// Escolhe quantas colunas usar para que todos os quadros fiquem do mesmo tamanho,
// o maior possível, sem passar da tela e sem um ficar por cima do outro.
function layoutGrid(grid) {
  if (!grid || grid.classList.contains("focus")) { if (grid) { grid.style.removeProperty("--tw"); grid.style.removeProperty("--th"); } return; }
  const n = grid.querySelectorAll(":scope > .tile").length;
  if (!n) return;
  const cs = getComputedStyle(grid), gap = parseFloat(cs.columnGap) || 10;
  const W = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const H = grid.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (W <= 0 || H <= 0) return;
  const ratio = W < 560 ? 4 / 3 : 16 / 10;
  let best = { w: 0, h: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    let w = (W - gap * (cols - 1)) / cols, h = w / ratio;
    if (h * rows + gap * (rows - 1) > H) { h = (H - gap * (rows - 1)) / rows; w = h * ratio; }
    if (w > best.w) best = { w, h };
  }
  const w = Math.max(120, Math.floor(best.w)), h = Math.max(90, Math.floor(best.h));
  grid.style.setProperty("--tw", w + "px");
  grid.style.setProperty("--th", h + "px");
  grid.classList.toggle("small-tiles", w < 260);
}
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
  const sig = [t.kind, hasVideo, t.v.muted, t.v.deaf, u.username, u.avatar, u.color, u.banner, JSON.stringify(u.bp || ""), S.settings.reduceMotion, t.watching, V.focus === t.key, ctrl && V.controlling.mode].join("|");
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
    if (!hasVideo && u.banner && u.banner.startsWith("/f/")) h += tileBanner(u);
    if (!hasVideo) h += `<div class="tile-av">${avatar(u, 84)}</div>`;
    h += `<div class="tile-name">${t.v.deaf ? ic("headOff") : t.v.muted ? ic("micOff") : ""}<span>${esc(u.username)}${mine ? " (você)" : ""}</span></div>`;
    { const pp = mine ? null : peerByUser(u.id), cs = pp && pp.pc.connectionState; if (cs === "failed" || cs === "disconnected" || (pp && cs === "new" && Date.now() - (t.v.at || 0) > 15000)) h += `<div class="tile-conn" data-tip="Sem conexão de voz com essa pessoa — tentando de novo">${ic("signal", "xs")}Reconectando…</div>`; }
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
    root.innerHTML = `<div class="stage-empty">${people.length ? `<div class="faces">${people.slice(0, 6).map(v => avatar(user(v.userId), 56)).join("")}</div>` : `<div style="width:76px;height:76px;border-radius:50%;background:#1a1e30;display:grid;place-items:center">${ic("volume", "lg")}</div>`}<h2>${esc(c.dm ? dmTitle(c) : c.name)}</h2><p>${people.length ? `${names}${people.length > 3 ? ` e mais ${people.length - 3}` : ""} ${people.length === 1 ? "está" : "estão"} na sala` : "Ninguém por aqui ainda. Que tal começar a conversa?"}</p><button class="btn green big" style="width:auto;padding:0 28px" data-act="join-voice" data-id="${c.id}" ${full || V.joining ? "disabled" : ""}>${V.joining ? "Conectando…" : full ? "Sala cheia" : c.dm ? "Entrar na chamada" : "Entrar na sala"}</button></div>`;
    return;
  }
  if (!root.querySelector(".stage")) root.innerHTML = `<div class="stage"><div class="stage-grid" id="stageGrid"></div><div class="stage-bar" id="stageBar"></div></div>`;
  const grid = $("#stageGrid");
  const tiles = stageTiles(c.id);
  if (V.focus && V.focus !== "__act" && !tiles.some(t => t.key === V.focus)) V.focus = null;
  if (V.act && !V.focus && !V.actMin) V.focus = "__act";
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
  layoutGrid(grid);
  if (!grid._ro && window.ResizeObserver) { grid._ro = new ResizeObserver(() => layoutGrid(grid)); grid._ro.observe(grid); }
  let wait = root.querySelector(".stage-wait");
  const alone = c.dm && ![...S.voice.values()].some(v => v.channelId === c.id && v.userId !== S.me.id);
  if (alone && !wait) { wait = document.createElement("div"); wait.className = "stage-wait"; root.querySelector(".stage").prepend(wait); }
  if (alone) wait.innerHTML = `${ic("phone", "sm")}<span>Chamando <b>${esc(dmTitle(c))}</b>… você pode ficar na call esperando.</span>`;
  else if (wait) wait.remove();
  renderCallChat();
  const micOff = S.muted || S.deaf;
  $("#stageBar").innerHTML = `<button class="ctl${micOff ? " off" : ""}" data-act="mute" data-tip="${micOff ? "Ativar microfone" : "Silenciar"}">${ic(micOff ? "micOff" : "mic")}</button><button class="ctl${S.deaf ? " off" : ""}" data-act="deafen" data-tip="${S.deaf ? "Ativar áudio" : "Desativar áudio"}">${ic(S.deaf ? "headOff" : "headphones")}</button><button class="ctl${V.cam ? " on" : ""}" data-act="cam" data-tip="${V.cam ? "Desligar câmera" : "Ligar câmera"}">${ic(V.cam ? "camera" : "cameraOff")}</button><button class="ctl${V.screen ? " on" : ""}" data-act="share" data-tip="${V.screen ? "Opções da transmissão" : "Transmitir tela"}">${ic("monitorUp")}</button><span class="ctl-sep"></span><button class="ctl${V.act ? " on" : ""}" data-act="act-menu" data-tip="Atividades: música, lousa, jogos">${ic("rocket")}</button><button class="ctl" data-act="sound-menu" data-tip="Sons para todos">${ic("speaker")}</button><button class="ctl" data-act="react-menu" data-tip="Reações">${ic("smile")}</button><button class="ctl cc-btn${CC.open ? " on" : ""}" data-act="call-chat" data-tip="Chat da call">${ic("message")}${CC.unread && !CC.open ? `<span class="cc-badge">${CC.unread > 9 ? "9+" : CC.unread}</span>` : ""}</button><span class="ctl-sep"></span><button class="ctl red" data-act="voice-leave" data-tip="Desconectar">${ic("phoneOff")}</button>`;
}

/* --- sobreposição de jogo (app de PC): quem está na call, por cima do jogo --- */
let ovLast = "";
function overlayState() {
  if (!V.channelId || !S.me || S.settings.overlay === false) return { on: false };
  const c = chan(V.channelId);
  const people = [...S.voice.values()].filter(v => v.channelId === V.channelId).map(v => {
    const u = user(v.userId);
    return {
      id: v.userId, name: u.username || "?", color: u.color || "#555",
      av: IS_IMG(u.avatar) ? new URL(u.avatar, location.origin).href : u.avatar || "",
      speaking: V.speaking.has(v.userId) && !(v.userId === S.me.id && (S.muted || S.deaf)),
      muted: v.userId === S.me.id ? !!(S.muted || S.deaf) : !!v.muted, deaf: v.userId === S.me.id ? !!S.deaf : !!v.deaf, live: !!v.screen
    };
  });
  return { on: true, pos: S.settings.overlayPos || "tl", title: c ? (c.dm ? dmTitle(c) : c.name) : "Call", people };
}
if (window.nexoraDesktop && window.nexoraDesktop.overlay) setInterval(() => {
  let st;
  try { st = overlayState(); } catch { return; }
  const j = JSON.stringify(st);
  if (j === ovLast) return;
  ovLast = j;
  try { window.nexoraDesktop.overlay(st); } catch {}
}, 200);
function renderOverlaySettings() {
  const pos = S.settings.overlayPos || "tl", P = [["tl", "↖ Em cima, à esquerda"], ["tr", "↗ Em cima, à direita"], ["bl", "↙ Embaixo, à esquerda"], ["br", "↘ Embaixo, à direita"]];
  const desk = !!(window.nexoraDesktop && window.nexoraDesktop.overlay);
  return `${desk ? "" : `<div class="hint" style="margin:-4px 0 14px">⚠️ A sobreposição funciona no <b>app da Auryx para Windows</b>. No navegador ela não aparece.</div>`}
    ${toggleRow("overlay", "Mostrar sobreposição nos jogos", "Quando você está numa call e vai para o jogo, aparece no canto da tela quem está na call — e acende quem está falando", S.settings.overlay !== false)}
    <span class="label" style="display:block;margin-top:16px">Posição na tela</span>
    <div class="ov-pos" style="margin-top:8px">${P.map(([k, t]) => `<button type="button" class="qopt${k === pos ? " on" : ""}" data-ovpos="${k}"><b>${t}</b></button>`).join("")}</div>
    <div class="hint" style="margin-top:16px">💡 Funciona com jogos em <b>janela</b> ou <b>tela cheia sem bordas</b> (borderless). Em jogos com "tela cheia exclusiva" o Windows não deixa nada aparecer por cima — troque para "sem bordas" nas opções de vídeo do jogo. Os cliques passam direto para o jogo.</div>`;
}
function mountOverlaySettings(p) {
  bindToggles(p);
  p.addEventListener("click", e => {
    const b = e.target.closest("[data-ovpos]");
    if (!b) return;
    S.settings.overlayPos = b.dataset.ovpos; saveSettings();
    $$("[data-ovpos]", p).forEach(x => x.classList.toggle("on", x === b));
  });
}

/* --- chat da call: mensagens de texto ao lado da chamada --- */
const CC = { open: false, unread: 0, cid: null };
function ccMsg(m, prev) {
  if (m.sys) return `<div class="cc-sys">${esc(m.t || "")}</div>`;
  const u = user(m.a), same = prev && !prev.sys && prev.a === m.a && m.ts - prev.ts < 300000;
  return `<div class="cc-msg${same ? " same" : ""}" data-id="${esc(m.id || "")}">${same ? "" : `<div class="cc-head">${avatar(u, 22)}<b>${esc(u.username)}</b><small>${fmtTime(m.ts)}</small></div>`}<div class="cc-t">${m.t ? renderText(m.t).html : ""}${filesHTML(m)}</div></div>`;
}
function ccList() {
  const b = S.msgs.get(V.channelId);
  return b ? b.list.slice(-80) : [];
}
function renderCallChat() {
  const stage = $("#stageView .stage");
  if (!stage) return;
  let el = stage.querySelector(".cc-panel");
  if (!CC.open || !V.channelId) { if (el) el.remove(); return; }
  if (CC.cid !== V.channelId) { CC.cid = V.channelId; if (el) { el.remove(); el = null; } }
  if (!el) {
    el = document.createElement("aside");
    el.className = "cc-panel";
    el.innerHTML = `<header><b>${ic("message", "sm")} Chat da call</b><button class="icon-btn" data-act="call-chat" aria-label="Fechar chat">${ic("x", "sm")}</button></header><div class="cc-list"></div><form class="cc-form"><input maxlength="2000" placeholder="Mensagem para a call…" autocomplete="off"><button class="icon-btn send" aria-label="Enviar">${ic("send", "sm")}</button></form>`;
    el.querySelector("form").onsubmit = e => { e.preventDefault(); sendCallChat(el.querySelector("input")); };
    stage.append(el);
    const b = S.msgs.get(V.channelId);
    if (!b || !b.loaded) loadHistory(V.channelId).then(() => fillCallChat());
    fillCallChat();
    if (!matchMedia("(pointer: coarse)").matches) el.querySelector("input").focus({ preventScroll: true });
  }
}
function fillCallChat() {
  const list = $("#stageView .cc-list");
  if (!list) return;
  const ms = ccList();
  list.innerHTML = ms.length ? ms.map((m, i) => ccMsg(m, ms[i - 1])).join("") : `<p class="cc-empty">Ninguém escreveu ainda. Mande um link, um print ou um oi pra galera da call 👋</p>`;
  list.scrollTop = list.scrollHeight;
  markRead(V.channelId);
}
async function sendCallChat(inp) {
  const text = inp.value.trim();
  if (!text || !V.channelId) return;
  inp.value = "";
  const r = await emit("send", { channelId: V.channelId, text, nonce: Math.random().toString(36).slice(2) });
  if (r && r.error) { toast(r.error, "error"); inp.value = text; }
}
function toggleCallChat() {
  CC.open = !CC.open;
  if (CC.open) CC.unread = 0;
  schedule("stage");
}
function callChatOnMsg(channelId, m) {
  if (!V.channelId || channelId !== V.channelId) return;
  const open = CC.open && S.view === "stage" && $("#stageView .cc-list");
  if (open) { fillCallChat(); return; }
  if (m.a !== S.me.id && !m.sys) { CC.unread++; if (!isDm(channelId)) sfx("mention"); schedule("stage"); }
}

/* ------------------------------------------------------------------ */
/* Atividades na call: Ouvir juntos (YouTube), Lousa, Jogo da velha,   */
/* sons para todos e reações voando na tela                            */
/* ------------------------------------------------------------------ */
const ACT_NAMES = { sp: "🎧 o Spotify", yt: "🎵 Ouvir juntos", board: "🎨 a Lousa", ttt: "❌⭕ Jogo da velha" };
const nowServer = () => Date.now() + (S.clockOff || 0);
function startActivity(type) {
  if (!V.channelId) { toast("Entre numa sala de voz primeiro.", "warn"); return; }
  emit("act:start", { type }).then(r => r.error && toast(r.error, "error"));
}
function actMenu(at) {
  menu(at, [
    { label: "Ouvir juntos (YouTube)", icon: "music", hint: "música e vídeo", run: () => startActivity("yt") },
    { label: "Ouvir juntos (Spotify)", icon: "headphones", hint: "músicas e playlists", run: () => startActivity("sp") },
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
    ({ yt: mountYT, sp: mountSpotify, board: mountBoard, ttt: mountTTT })[a.type](el);
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-mm]");
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.mm === "mute") {
        store.set("musicMute", !musicMuted());
        $$('[data-mm="mute"]', el).forEach(x => { x.innerHTML = ic(musicMuted() ? "volumeX" : "volume"); });
        toast(musicMuted() ? "Música mutada só para você 🔇" : "Música de volta 🔊", "info", 2000);
        if (el._update) el._update(V.act);
      } else { V.actMin = V.focus === "__act"; V.focus = V.actMin ? null : "__act"; schedule("stage"); }
    });
  }
  el.classList.toggle("big", V.focus === "__act");
  return el;
}
const musicMuted = () => !!store.get("musicMute", false);
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
  if (a.type && a.type !== prev) { V.actMin = false; V.focus = "__act"; if (a.by !== S.me.id) toast(`${user(a.by).username} abriu ${ACT_NAMES[a.type]} na call!`, "info"); }
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
    <div class="yt-bar"><button class="icon-btn" data-yt="toggle" data-tip="Tocar / pausar">${ic("play")}</button><button class="icon-btn" data-yt="skip" data-tip="Próxima">${ic("skip")}</button><span class="yt-time">0:00</span><input type="range" class="yt-seek" min="0" max="100" value="0" step="0.5"><span class="yt-dur">0:00</span><span data-tip="Volume (só para você)" style="display:grid">${ic("volume", "sm")}</span><input type="range" class="yt-vol" min="0" max="100" value="${store.get("ytVol", 70)}"><span class="mm-sep"></span><button class="icon-btn" data-mm="mute" data-tip="Mutar a música (só para você)">${ic(musicMuted() ? "volumeX" : "volume")}</button><button class="icon-btn" data-mm="min" data-tip="Diminuir / aumentar o player">${ic("minimize")}</button></div>
    <div class="yt-now hidden"></div>
    <form class="yt-add"><input placeholder="Nome da música, ou link do YouTube ou do Spotify…" spellcheck="false" enterkeyhint="search"><button class="btn sm primary">${ic("search", "sm")}Tocar</button></form>
    <div class="yt-results hidden"></div>
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
    el.querySelector(".yt-queue").innerHTML = q.length ? `<span class="label">Na fila — ${q.length}</span><div class="yt-qs">${q.map((v, i) => `<div class="yt-q" data-v="${esc(v)}"><img src="https://i.ytimg.com/vi/${esc(v)}/mqdefault.jpg" alt="" referrerpolicy="no-referrer"><button class="icon-btn" data-yt-del="${i}" data-tip="Tirar da fila">${ic("x", "xs")}</button></div>`).join("")}</div>` : "";
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
    if (S.deaf || musicMuted()) player.mute(); else player.unMute();
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
  const titles = new Map();
  const needTitles = ids => { const miss = ids.filter(x => x && !titles.has(x)); if (!miss.length) return; miss.forEach(x => titles.set(x, "")); emit("music:titles", { ids: miss }).then(r => { for (const [k, v] of Object.entries(r.titles || {})) titles.set(k, v); drawMeta(); }); };
  const drawMeta = () => {
    const s = st();
    if (!s) return;
    const now = el.querySelector(".yt-now");
    now.classList.toggle("hidden", !s.vid);
    if (s.vid) now.innerHTML = `<span class="eq${s.playing ? " on" : ""}"><i></i><i></i><i></i></span><b>${esc(titles.get(s.vid) || "Tocando agora")}</b>`;
    $$(".yt-q", el).forEach(q => { const v = q.dataset.v; if (v) q.dataset.tip = titles.get(v) || "Na fila"; });
    needTitles([s.vid, ...(s.queue || [])]);
  };
  const addVid = id => {
    const s = st();
    if (!s) return;
    if (!s.vid) push({ ...s, vid: id, pos: 0, playing: true });
    else { push({ ...s, pos: ytPos(s), queue: [...(s.queue || []), id].slice(0, 50) }); toast("Adicionado à fila. 🎵", "ok"); }
  };
  const results = el.querySelector(".yt-results");
  el.querySelector(".yt-add").addEventListener("submit", async e => {
    e.preventDefault();
    const inp = e.target.querySelector("input"), text = inp.value.trim(), id = ytId(text);
    if (!text) return;
    if (id) { inp.value = ""; results.classList.add("hidden"); addVid(id); return; }
    const btn = e.target.querySelector("button");
    btn.classList.add("loading");
    const r = await emit("music:search", { q: text });
    btn.classList.remove("loading");
    if (r.error) { toast(r.error, "warn", 7000); return; }
    if (!r.results.length) { toast("Nada encontrado com esse nome.", "warn"); return; }
    inp.value = "";
    results.innerHTML = `<div class="yr-head"><small>${r.from ? `Do Spotify: <b>${esc(r.from)}</b> — escolha a versão inteira` : "Escolha a música"}</small><button class="icon-btn" type="button" data-yr-close>${ic("x", "sm")}</button></div>` + r.results.map(x => `<button type="button" class="yr" data-yr="${esc(x.id)}" data-t="${esc(x.title)}"><img src="${esc(x.thumb)}" alt="" referrerpolicy="no-referrer"><span><b>${esc(x.title)}</b><small>${esc(x.channel)}</small></span>${ic("plus", "sm")}</button>`).join("");
    results.classList.remove("hidden");
  });
  results.addEventListener("click", e => {
    if (e.target.closest("[data-yr-close]")) { results.classList.add("hidden"); return; }
    const b = e.target.closest("[data-yr]");
    if (!b) return;
    titles.set(b.dataset.yr, b.dataset.t);
    addVid(b.dataset.yr);
    results.classList.add("hidden");
  });
  el._update = () => { sync(); drawMeta(); };
  el._destroy = () => { clearInterval(timer); clearInterval(drift); try { if (player) player.destroy(); } catch {} };
  drawMeta();
}

/* --- Ouvir juntos no Spotify (player oficial embutido, sincronizado) --- */
let spApi = null;
function loadSpotify() {
  if (window.__spIFrameAPI) return Promise.resolve(window.__spIFrameAPI);
  if (spApi) return spApi;
  spApi = new Promise((res, rej) => {
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = api => { window.__spIFrameAPI = api; if (prev) try { prev(api); } catch {} res(api); };
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    s.onerror = () => { spApi = null; rej(new Error("Não foi possível carregar o Spotify.")); };
    document.head.append(s);
    setTimeout(() => { if (!window.__spIFrameAPI) { spApi = null; rej(new Error("O Spotify demorou para responder. Tente de novo.")); } }, 15000);
  });
  return spApi;
}
// aceita link (open.spotify.com/intl-pt/track/…), link curto de app e "spotify:track:…"
function spUri(text) {
  const s = String(text || "").trim();
  let m = s.match(/^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]{10,40})$/);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/);
  return m ? `spotify:${m[1]}:${m[2]}` : "";
}
const SP_KIND = { track: "Música", album: "Álbum", playlist: "Playlist", episode: "Episódio", show: "Podcast", artist: "Artista" };
const spKind = uri => (uri || "").split(":")[1] || "";
const spSingle = uri => ["track", "episode"].includes(spKind(uri));      // posição exata só em música/episódio
const spInfo = new Map();
function spMeta(uri) {
  if (spInfo.has(uri)) return Promise.resolve(spInfo.get(uri));
  const [, kind, id] = uri.split(":");
  return fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${kind}/${id}`)}`)
    .then(r => (r.ok ? r.json() : null)).then(j => { const v = j ? { title: j.title || "", img: j.thumbnail_url || "" } : null; spInfo.set(uri, v); return v; })
    .catch(() => null);
}
// Entrar no Spotify sem sair da Auryx: o login fica guardado no app e o player passa a tocar a música inteira
const SP_LOGIN = "https://accounts.spotify.com/login?continue=" + encodeURIComponent("https://open.spotify.com/");
function spotifyLogin(done) {
  if (ANDROID && ANDROID.spotifyLogin) { try { ANDROID.spotifyLogin(); } catch {} window.__axSpotifyDone = () => { toast("Pronto! Se entrou, a música toca inteira agora.", "ok"); done && done(); }; return; }
  if (ANDROID) { toast("Atualize o app Android para entrar no Spotify por aqui.", "warn", 6000); return; }
  const w = window.open(SP_LOGIN, "spotify-login", "width=480,height=720");
  if (!w) { toast("O navegador bloqueou a janela. Entre em open.spotify.com nesta mesma janela do navegador e volte.", "warn", 8000); return; }
  toast("Entre na sua conta do Spotify e feche a janela quando terminar.", "info", 6000);
  const t = setInterval(() => { if (w.closed) { clearInterval(t); toast("Pronto! Se entrou, a música toca inteira agora.", "ok"); done && done(); } }, 800);
}
/* Conta do Spotify (Premium) conectada: o player oficial (Web Playback SDK) toca a música inteira e deixa mudar o volume.
   Login OAuth com PKCE: não precisa de segredo no servidor, só do Client ID (SPOTIFY_CLIENT_ID no Render). */
const SP_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const spConnected = () => !!(S.spotifyId && store.get("spTok"));
async function spotifyConnect(done) {
  if (!S.spotifyId) { spotifyLogin(done); return; }
  if (!crypto.subtle) { toast("Abra a Auryx pelo endereço https para conectar o Spotify.", "warn"); return; }
  const verifier = b64u(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64u(crypto.getRandomValues(new Uint8Array(12)));
  const redirect = location.origin + "/spotify-callback.html";
  store.set("spPkce", { verifier, state, redirect, client: S.spotifyId, android: !!(ANDROID && ANDROID.spotifyAuth) });
  const url = "https://accounts.spotify.com/authorize?" + new URLSearchParams({ response_type: "code", client_id: S.spotifyId, scope: SP_SCOPES, redirect_uri: redirect, state, code_challenge_method: "S256", code_challenge: challenge });
  window.__axSpotifyDone = () => { if (store.get("spTok")) { toast("Spotify conectado! 🎧 Música inteira e volume liberados.", "ok"); done && done(); } };
  if (ANDROID) { if (ANDROID.spotifyAuth) { try { ANDROID.spotifyAuth(url); } catch {} } else toast("Atualize o app Android para conectar o Spotify.", "warn", 6000); return; }
  const w = window.open(url, "spotify-login", "width=480,height=760");
  if (!w) location.href = url;   // janela bloqueada: faz o login nesta aba e volta sozinho
  else toast("Entre na sua conta do Spotify na janela que abriu.", "info", 5000);
}
window.addEventListener("message", e => { if (e.origin === location.origin && e.data && "axSpotify" in e.data && window.__axSpotifyDone) window.__axSpotifyDone(); });
let spRefreshing = null;
function spToken() {
  const t = store.get("spTok");
  if (!t) return Promise.resolve("");
  if (Date.now() < t.exp) return Promise.resolve(t.a);
  return spRefreshing || (spRefreshing = fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.r, client_id: t.c }) })
    .then(r => r.json()).then(j => {
      if (!j.access_token) throw new Error("refresh");
      store.set("spTok", { a: j.access_token, r: j.refresh_token || t.r, exp: Date.now() + (j.expires_in - 60) * 1000, c: t.c });
      return j.access_token;
    }).catch(() => { store.del("spTok"); return ""; }).finally(() => { spRefreshing = null; }));
}
let spSdk = null;
function loadSpotifySDK() {
  if (spSdk) return spSdk;
  return (spSdk = new Promise((res, rej) => {
    if (window.Spotify) return res(window.Spotify);
    window.onSpotifyWebPlaybackSDKReady = () => res(window.Spotify);
    const sc = document.createElement("script");
    sc.src = "https://sdk.scdn.co/spotify-player.js";
    sc.onerror = () => { spSdk = null; rej(new Error("load")); };
    document.head.append(sc);
    setTimeout(() => { if (!window.Spotify) { spSdk = null; rej(new Error("load")); } }, 15000);
  }));
}
// Player da conta com a mesma "cara" do controle do embed (loadUri/play/pause/resume/seek/destroy) + volume
async function spSdkController() {
  const Sp = await loadSpotifySDK();
  const ls = {}, fire = (n, d) => (ls[n] || []).forEach(f => { try { f(d); } catch {} });
  const player = new Sp.Player({ name: "Auryx Nexos", getOAuthToken: cb => spToken().then(cb), volume: store.get("spVol", 70) / 100 });
  const call = async (method, path, body) => {
    const t = await spToken();
    if (!t) throw new Error("conecte sua conta de novo");
    const r = await fetch("https://api.spotify.com/v1/me/player" + path, { method, headers: { authorization: "Bearer " + t, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (r.status >= 400) { const j = await r.json().catch(() => ({})); throw new Error((j.error && j.error.message) || "HTTP " + r.status); }
  };
  return new Promise((res, rej) => {
    let device = "", cur = "", loaded = false, lastPlay = 0, settled = false;
    const fail = m => { if (!settled) { settled = true; try { player.disconnect(); } catch {} rej(new Error(m)); } };
    player.addListener("initialization_error", () => fail("init"));
    player.addListener("authentication_error", () => { store.del("spTok"); fail("auth"); });
    player.addListener("account_error", () => fail("premium"));
    player.addListener("player_state_changed", st => { if (st) fire("playback_update", { data: { isPaused: st.paused, position: st.position, duration: st.duration } }); });
    player.addListener("ready", ({ device_id }) => {
      if (settled) return;
      device = device_id; settled = true;
      const play = () => {
        if (!cur || Date.now() - lastPlay < 1500) return;
        lastPlay = Date.now(); loaded = true;
        const single = /^spotify:(track|episode):/.test(cur);
        call("PUT", "/play?device_id=" + encodeURIComponent(device), single ? { uris: [cur] } : { context_uri: cur }).catch(e => toast("Spotify: " + e.message, "error"));
      };
      res({
        sdk: true,
        addListener(n, f) { (ls[n] = ls[n] || []).push(f); },
        activate() { try { player.activateElement(); } catch {} },
        loadUri(uri) { cur = uri; loaded = false; lastPlay = 0; },
        play,
        resume() { if (!loaded) play(); else player.resume(); },
        pause() { player.pause(); },
        seek(sec) { if (loaded) player.seek(Math.max(0, sec * 1000)); },
        setVolume(v) { player.setVolume(Math.max(0, Math.min(1, v))); },
        destroy() { try { player.disconnect(); } catch {} }
      });
    });
    player.connect().then(ok => { if (!ok) fail("connect"); });
    setTimeout(() => fail("timeout"), 15000);
  });
}
const SP_ERR = { premium: "O player do Spotify só funciona com conta Premium — usando o player comum.", auth: "Sua conexão com o Spotify expirou. Conecte de novo.", init: "Este app não roda o player do Spotify (use o navegador ou o Android) — usando o player comum.", load: "Não foi possível carregar o player do Spotify — usando o player comum.", connect: "O Spotify não aceitou a conexão — usando o player comum.", timeout: "O Spotify demorou para responder — usando o player comum." };

// Troca o Spotify (prévia de 30 s) pela mesma música inteira no player do YouTube, para todos da call
async function spotifyToFull(s) {
  if (!s || !s.uri) { toast("Coloque uma música do Spotify primeiro.", "warn"); return; }
  const [, kind, id] = s.uri.split(":");
  const r = await emit("music:search", { q: `https://open.spotify.com/${kind}/${id}` });
  if (r.error) { toast(r.error, "warn", 7000); return; }
  if (!r.results.length) { toast("Não achei essa música inteira.", "warn"); return; }
  const st0 = await emit("act:start", { type: "yt" });
  if (st0 && st0.error) { toast(st0.error, "error"); return; }
  setTimeout(() => {
    const cur = V.act && V.act.type === "yt" ? V.act.state : { vid: "", queue: [], playing: false, pos: 0 };
    emit("act:state", { state: { ...cur, vid: r.results[0].id, pos: 0, playing: true, queue: [] } });
    toast(`🎧 Tocando "${r.from || r.results[0].title}" inteira`, "ok", 4000);
  }, 500);
}
function mountSpotify(el) {
  el.innerHTML = `<div class="yt-wrap sp-wrap"><div class="sp-player"><div class="sp-frame"></div><div class="yt-empty sp-empty">${ic("music", "lg")}<b>Ouvir juntos no Spotify</b><small>Cole aqui embaixo o link de uma música, álbum, playlist ou podcast do Spotify (Compartilhar › Copiar link). Todo mundo na call ouve junto.</small></div></div>
    <div class="yt-bar"><button class="icon-btn" data-sp="toggle" data-tip="Tocar / pausar para todos">${ic("play")}</button><button class="icon-btn" data-sp="skip" data-tip="Próxima da fila">${ic("skip")}</button><span class="yt-time">0:00</span><input type="range" class="yt-seek" min="0" max="100" value="0" step="0.5"><span class="yt-dur">0:00</span><span class="sp-volw"><button class="icon-btn sp-vb" type="button" data-sp="vol-" data-tip="Abaixar o volume (só para você)">−</button><input type="range" class="yt-vol sp-vol" min="0" max="100" step="5" value="${store.get("spVol", 70)}"><button class="icon-btn sp-vb" type="button" data-sp="vol+" data-tip="Aumentar o volume (só para você)">+</button></span><span class="mm-sep"></span><button class="icon-btn" data-mm="mute" data-tip="Mutar a música (só para você)">${ic(musicMuted() ? "volumeX" : "volume")}</button><button class="icon-btn" data-mm="min" data-tip="Diminuir / aumentar o player">${ic("minimize")}</button></div>
    <form class="yt-add"><input placeholder="Cole um link do Spotify para tocar ou pôr na fila…" spellcheck="false"><button class="btn sm primary">${ic("plus", "sm")}Adicionar</button></form>
    <div class="yt-queue"></div>
    <div class="sp-login"></div></div>`;
  let ctl = null, ready = false, lastUri = "", seeking = false, pb = { paused: true, pos: 0, dur: 0 }, alive = true;
  const st = () => (V.act && V.act.type === "sp" ? V.act.state : null);
  const push = s => emit("act:state", { state: s }).then(r => r.error && toast(r.error, "error"));
  const next = () => { const s = st(); if (!s) return; const q = (s.queue || []).slice(); const uri = q.shift() || ""; push({ ...s, uri, queue: q, playing: !!uri, pos: 0 }); };
  const posOf = s => (s.pos || 0) + (s.playing ? (nowServer() - s.at) / 1000 : 0);
  let api = null, creating = false, sdkFailed = false;
  const useSdk = () => spConnected() && !sdkFailed;
  const ensureEmbed = () => { if (!api) loadSpotify().then(x => { api = x; if (alive) sync(); }).catch(e => toast(e.message, "error")); };
  if (!useSdk()) ensureEmbed();
  // o player do embed troca a .sp-frame por um <iframe>: aqui ela é recriada limpa quando preciso
  const frame = () => {
    let f = el.querySelector(".sp-frame");
    if (!f) { f = document.createElement("div"); f.className = "sp-frame"; el.querySelector(".sp-player").prepend(f); }
    return f;
  };
  const dropCtl = () => {
    if (ctl) { try { ctl.destroy(); } catch {} }
    ctl = null; ready = false; creating = false; lastUri = ""; pb = { paused: true, pos: 0, dur: 0 };
    el.querySelectorAll(".sp-player > iframe").forEach(x => x.remove());
    frame().innerHTML = "";
  };
  function drawLogin() {
    const sdk = !!(ctl && ctl.sdk);
    el.classList.toggle("sp-sdk", sdk);
    el.querySelector(".sp-vol").disabled = !sdk;
    el.querySelectorAll(".sp-vb").forEach(b => { b.disabled = !sdk; });
    el.querySelector(".sp-volw").dataset.tip = sdk ? "Volume (só para você)" : "Conecte sua conta do Spotify para mudar o volume";
    el.querySelector(".sp-login").innerHTML = sdk
      ? `<small>🟢 Tocando pela sua conta do Spotify — música inteira, sem prévia.</small><button class="btn sm" type="button" data-sp="logout">Desconectar</button>`
      : spConnected()
      ? `<small>🎧 Sua conta do Spotify está conectada, mas o player dela não abriu aqui.</small><button class="btn sm primary" type="button" data-sp="full">${ic("play", "sm")}Tocar inteira (sem prévia)</button><button class="btn sm" type="button" data-sp="logout">Desconectar</button>`
      : `<small>🎧 Tocando só 30 s? ${S.spotifyId ? "Conecte sua conta do Spotify (Premium) para tocar a música inteira e mudar o volume." : "O Spotify só toca a música inteira para quem está logado nele."}</small><button class="btn sm primary" type="button" data-sp="login">${ic("headphones", "sm")}${S.spotifyId ? "Conectar minha conta" : "Entrar no Spotify"}</button><button class="btn sm" type="button" data-sp="full">${ic("play", "sm")}Tocar inteira (sem prévia)</button>`;
  }
  function drawNow(uri) {
    if (!(ctl && ctl.sdk)) return;
    const m = spInfo.get(uri);
    frame().innerHTML = uri ? `<div class="sp-now">${m && m.img ? `<img src="${esc(m.img)}" alt="" referrerpolicy="no-referrer">` : `<span class="sp-ph">${ic("music", "lg")}</span>`}<div><b>${esc(m ? m.title : SP_KIND[spKind(uri)] || "Spotify")}</b><small>Tocando pela sua conta do Spotify</small></div></div>` : "";
    if (uri && !m) spMeta(uri).then(() => { if (alive && lastUri === uri) drawNow(uri); });
  }
  function startSdk() {
    creating = true;
    spSdkController().then(c => {
      if (!alive) { c.destroy(); return; }
      dropCtl();
      ctl = c; ready = true;
      wire(c); drawLogin(); sync();
    }).catch(e => {
      creating = false; sdkFailed = true;
      toast(SP_ERR[e.message] || "Spotify: " + e.message, "warn", 7000);
      drawLogin(); ensureEmbed(); sync();
    });
  }
  function wire(c) {
    c.addListener("playback_update", e => {
      const d = e && e.data;
      if (!d) return;
      const ended = pb.dur > 0 && !pb.paused && d.isPaused && d.position === 0 && pb.pos > 1000;
      pb = { paused: d.isPaused, pos: d.position || 0, dur: d.duration || 0 };
      // acabou: quem "lidera" a call passa para a próxima da fila
      if (ended && isLeader()) { const s = st(); if (s && s.playing && (s.queue || []).length) next(); else if (s && s.playing) push({ ...s, playing: false, pos: 0 }); }
    });
  }
  // o player só é criado quando já existe algo para tocar
  function create(uri) {
    if (creating || ctl) return;
    if (useSdk()) { startSdk(); return; }
    if (!api) return;
    creating = true;
    api.createController(frame(), { width: "100%", height: "100%", uri }, c => {
      ctl = c;
      if (!alive) { try { c.destroy(); } catch {} return; }
      lastUri = uri;
      c.addListener("ready", () => { ready = true; const s = st(); if (s && s.playing) { c.play(); const w = posOf(s); if (spSingle(s.uri) && w > 2) setTimeout(() => c.seek(w), 900); } });
      wire(c);
      drawLogin();
    });
  }
  function drawQueue(s) {
    const q = s.queue || [];
    el.querySelector(".yt-queue").innerHTML = q.length ? `<span class="label">Na fila — ${q.length}</span><div class="yt-qs">${q.map((u, i) => { const m = spInfo.get(u); return `<div class="yt-q sp-q" data-tip="${esc(m ? m.title : SP_KIND[spKind(u)] || "Spotify")}">${m && m.img ? `<img src="${esc(m.img)}" alt="" referrerpolicy="no-referrer">` : `<span class="sp-ph">${ic("music")}</span>`}<button class="icon-btn" data-sp-del="${i}" data-tip="Tirar da fila">${ic("x", "xs")}</button></div>`; }).join("")}</div>` : "";
    for (const u of q) if (!spInfo.has(u)) spMeta(u).then(() => { const s2 = st(); if (s2) drawQueue(s2); });
  }
  function sync() {
    const s = st();
    if (!s) return;
    el.querySelector(".sp-empty").classList.toggle("hidden", !!s.uri);
    el.querySelector('[data-sp="toggle"]').innerHTML = ic(s.playing ? "pause" : "play");
    el.querySelector(".yt-seek").disabled = !spSingle(s.uri);
    drawQueue(s);
    if (s.uri && !ctl) { create(s.uri); return; }
    if (!ready || !ctl || !s.uri) { if (ready && ctl && !s.uri && !pb.paused) ctl.pause(); return; }
    if (s.uri !== lastUri) {
      lastUri = s.uri;
      ctl.loadUri(s.uri);
      drawNow(s.uri);
      if (s.playing) setTimeout(() => { if (!alive) return; ctl.play(); const w = posOf(s); if (spSingle(s.uri) && w > 2) setTimeout(() => ctl.seek(w), 900); }, 600);
      return;
    }
    if (s.playing && pb.paused && !musicMuted()) ctl.resume();
    if ((!s.playing || musicMuted()) && !pb.paused) ctl.pause();
    if (s.playing && !musicMuted() && spSingle(s.uri) && pb.dur) {
      const want = posOf(s);
      if (want * 1000 < pb.dur && Math.abs(pb.pos / 1000 - want) > 2.5) ctl.seek(want);
    }
  }
  const timer = setInterval(() => {
    const s = st();
    const dur = pb.dur / 1000, cur = s && s.uri ? (spSingle(s.uri) ? Math.min(posOf(s), dur || Infinity) : pb.pos / 1000) : 0;
    const seek = el.querySelector(".yt-seek");
    if (!seeking) { seek.max = Math.max(1, dur); seek.value = Math.min(cur, dur || cur); }
    el.querySelector(".yt-time").textContent = fmtSec(cur);
    el.querySelector(".yt-dur").textContent = fmtSec(dur);
    if (ctl && ready && (S.deaf || musicMuted()) && !pb.paused) ctl.pause();
  }, 500);
  const drift = setInterval(() => { if (!S.deaf) sync(); }, 4000);
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-sp]"), del = e.target.closest("[data-sp-del]");
    const s = st();
    if (!s) return;
    if (del) { const q = (s.queue || []).slice(); q.splice(+del.dataset.spDel, 1); push({ ...s, pos: posOf(s), queue: q }); return; }
    if (!b) return;
    if (b.dataset.sp === "toggle" && s.uri) push({ ...s, playing: !s.playing, pos: spSingle(s.uri) ? posOf(s) : 0 });
    if (b.dataset.sp === "skip") next();
    if (b.dataset.sp === "full") { spotifyToFull(s); return; }
    if (b.dataset.sp === "login") spotifyConnect(() => {
      if (!alive) return;
      if (spConnected()) { sdkFailed = false; drawLogin(); if (s2u()) { dropCtl(); startSdk(); } return; }
      if (ctl && s2u()) { lastUri = ""; sync(); }
    });
    if (b.dataset.sp === "logout") {
      store.del("spTok");
      if (ctl && ctl.sdk) dropCtl();
      sdkFailed = false; drawLogin(); ensureEmbed(); sync();
      toast("Conta do Spotify desconectada.", "info");
    }
    if (b.dataset.sp === "vol-" || b.dataset.sp === "vol+") setVol(+el.querySelector(".sp-vol").value + (b.dataset.sp === "vol+" ? 10 : -10));
  });
  const s2u = () => { const s2 = st(); return !!(s2 && s2.uri); };
  function setVol(v) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    el.querySelector(".sp-vol").value = v;
    store.set("spVol", v);
    if (ctl && ctl.sdk) ctl.setVolume(v / 100);
  }
  el.querySelector(".sp-vol").addEventListener("input", e => setVol(+e.target.value));
  el.addEventListener("pointerdown", () => { if (ctl && ctl.activate) ctl.activate(); });
  drawLogin();
  const seek = el.querySelector(".yt-seek");
  seek.addEventListener("input", () => { seeking = true; });
  seek.addEventListener("change", () => { seeking = false; const s = st(); if (s && s.uri && spSingle(s.uri)) push({ ...s, pos: +seek.value }); });
  el.querySelector(".yt-add").addEventListener("submit", e => {
    e.preventDefault();
    const inp = e.target.querySelector("input"), uri = spUri(inp.value), s = st();
    if (!uri) { toast("Cole um link do Spotify (música, álbum, playlist ou podcast).", "warn"); return; }
    if (!s) return;
    inp.value = "";
    spMeta(uri);
    if (!s.uri) push({ ...s, uri, pos: 0, playing: true });
    else { push({ ...s, pos: posOf(s), queue: [...(s.queue || []), uri].slice(0, 50) }); toast("Adicionado à fila. 🎧", "ok"); }
  });
  el._update = () => sync();
  el._destroy = () => { alive = false; clearInterval(timer); clearInterval(drift); try { if (ctl) ctl.destroy(); } catch {} };
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
  popover(anchor, `${bannerHTML(u)}<div class="pc">${avatar(u, 76, true)}${badges(u)}<h3>${nameHTML(u)}${u.pron ? `<small class="pron">${esc(u.pron)}</small>` : ""}</h3><div class="status-line"><i class="dot st-${esc(u.status)}"></i>${STATUS[u.status] || ""}${f === "friend" ? " · Amigo" : ""}</div>${u.cs ? `<div class="cs-bubble">${csText(u)}</div>` : ""}${game}${u.about ? `<div class="sec"><span class="label">Sobre mim</span>${esc(u.about)}</div>` : ""}${steam}<div class="sec"><span class="label">No Auryx Nexos desde</span>${u.created ? new Date(u.created).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>${v ? `<div class="sec"><span class="label">Em chamada</span><a data-go-voice="${v.channelId}" style="cursor:pointer">${esc(chan(v.channelId)?.name || "Sala de voz")}</a>${v.screen ? ' <b class="live-tag">AO VIVO</b>' : ""}</div>` : ""}<div class="sec" style="display:flex;gap:8px;flex-wrap:wrap">${acts}</div></div>`, "profile-pop" + (u.pfx ? " pfx-" + u.pfx : ""), (el, close) => {
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
  let link = LOCAL ? r.code : `${location.origin}/convite/${r.code}`;
  const invHint = x => `Código: <span class="kbd">${esc(x.code)}</span> · ${x.exp ? "vale até " + new Date(x.exp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "não expira"} · ${x.max ? `até ${x.max} ${x.max === 1 ? "pessoa" : "pessoas"} (${x.uses || 0} usado${(x.uses || 0) === 1 ? "" : "s"})` : "sem limite de pessoas"}`;
  const online = s.members.filter(id => user(id).status !== "offline").length;
  modal({
    title: `Convidar amigos para ${esc(s.name)}`, sub: "Quem abrir o link entra direto no servidor.",
    body: `<div class="invite-card" style="--c:${esc(s.color)}">${serverIcon(s)}<div><b>${esc(s.name)}</b><small><span><i class="dot st-online"></i> ${online} online</span><span><i class="dot st-offline"></i> ${s.members.length} membros</span></small></div></div>
      <span class="label">Link de convite</span>
      <div class="invite-box" style="margin-top:8px"><input readonly value="${esc(link)}"><button class="btn primary sm" type="button" data-copy>Copiar</button></div>
      <div class="hint" style="margin:10px 0 0" data-invhint>${invHint(r)}</div>
      <div class="inv-opts"><label class="field"><span>Expira em</span><select data-hours><option value="0">Nunca</option><option value="1">1 hora</option><option value="6">6 horas</option><option value="24">1 dia</option><option value="168">7 dias</option></select></label><label class="field"><span>Máximo de pessoas</span><select data-uses><option value="0">Sem limite</option><option value="1">1</option><option value="5">5</option><option value="10">10</option><option value="25">25</option><option value="100">100</option></select></label><button class="btn sm" type="button" data-newinv>Gerar link</button></div>
      ${navigator.share ? `<button class="btn ghost" style="margin-top:12px" type="button" data-share>${ic("link", "sm")}Compartilhar…</button>` : ""}`,
    onMount(m) {
      const b = m.querySelector("[data-copy]"), inp = m.querySelector(".invite-box input");
      b.onclick = async () => {
        try { await navigator.clipboard.writeText(link); } catch { inp.select(); document.execCommand("copy"); }
        b.textContent = "Copiado!"; b.classList.add("green");
        setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("green"); }, 1800);
      };
      inp.addEventListener("focus", () => inp.select());
      m.querySelector("[data-newinv]").onclick = async () => {
        const nr = await emit("invite:create", { serverId: sid, hours: +m.querySelector("[data-hours]").value, maxUses: +m.querySelector("[data-uses]").value });
        if (nr.error) { toast(nr.error, "error"); return; }
        link = LOCAL ? nr.code : `${location.origin}/convite/${nr.code}`;
        inp.value = link;
        m.querySelector("[data-invhint]").innerHTML = invHint(nr);
        toast("Link novo gerado.", "ok");
      };
      const sh = m.querySelector("[data-share]");
      if (sh) sh.onclick = () => navigator.share({ title: `Entre no ${s.name} na Auryx Nexos`, url: link }).catch(() => {});
    }
  });
}
// emoji do canal e categoria (organização visual da lista de canais)
const serverCats = sid => [...new Set((S.servers.get(sid)?.channels || []).map(c => c.cat).filter(Boolean))];
const chDecorFields = (sid, emoji, cat) => `<div class="ch-decor"><label class="field" style="flex:none"><span>Emoji</span><button type="button" class="btn emo-pick" data-emo>${emoji ? esc(emoji) : "＋"}</button></label>
  <label class="field" style="flex:1"><span>Categoria (opcional)</span><input data-cat list="catList" maxlength="30" placeholder="Ex.: Geral, Jogos, Eventos" value="${esc(cat || "")}"><datalist id="catList">${serverCats(sid).map(c => `<option value="${esc(c)}">`).join("")}</datalist></label></div>`;
function bindDecor(m, st) {
  const b = m.querySelector("[data-emo]");
  b.onclick = () => emojiPicker(b, e => { st.emoji = e; b.textContent = e; });
  b.oncontextmenu = e => { e.preventDefault(); st.emoji = ""; b.textContent = "＋"; };
}
function channelModal(type = "text", sid = S.serverId, cat = "") {
  let t = type;
  const deco = { emoji: "" };
  modal({
    title: "Criar canal", sub: `em ${esc(S.servers.get(sid)?.name || "")}`,
    body: `<span class="label">Tipo de canal</span>
      <div style="margin:8px 0 16px">
        <label class="radio-card${t === "text" ? " on" : ""}">${ic("hash", "lg")}<span><b>Texto</b><small>Mensagens, imagens, opiniões e memes</small></span><input type="radio" name="ct" value="text" ${t === "text" ? "checked" : ""}></label>
        <label class="radio-card${t === "voice" ? " on" : ""}">${ic("volume", "lg")}<span><b>Voz</b><small>Conversem por voz, câmera e tela</small></span><input type="radio" name="ct" value="voice" ${t === "voice" ? "checked" : ""}></label>
      </div>
      <label class="field"><span>Nome do canal</span><input id="cName" maxlength="32" placeholder="${t === "text" ? "novo-canal" : "Nova sala"}" autofocus></label>
      <label class="field" data-topic ${t === "voice" ? 'style="display:none"' : ""}><span>Tópico (opcional)</span><input id="cTopic" maxlength="160" placeholder="Sobre o que se conversa aqui?"></label>
      ${chDecorFields(sid, "", cat)}
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Criar canal</button></div>`,
    onMount(m, close) {
      bindDecor(m, deco);
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
        const r = await emit("channel:create", { serverId: sid, name, type: t, topic: m.querySelector("#cTopic").value, emoji: deco.emoji, cat: m.querySelector("[data-cat]").value });
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
  const deco = { emoji: c.emoji || "" };
  const sid = serverOf(cid)?.id;
  modal({
    title: "Editar canal", sub: `${c.type === "text" ? "#" : "🔊 "}${esc(c.name)}`,
    body: `<label class="field"><span>Nome</span><input id="eName" maxlength="32" value="${esc(c.name)}"></label>
      ${c.type === "text" ? `<label class="field"><span>Tópico</span><textarea id="eTopic" maxlength="160" placeholder="Explique para que serve o canal">${esc(c.topic || "")}</textarea></label>` : ""}
      ${chDecorFields(sid, c.emoji, c.cat)}<small class="hint" style="display:block;margin:-6px 0 14px">Clique com o botão direito no emoji para tirar.</small>
      <div class="danger-zone" style="margin-top:6px"><span><b>Excluir canal</b><small>${c.type === "text" ? "Todas as mensagens serão apagadas." : "Quem estiver na sala será desconectado."}</small></span><button class="btn danger sm" data-del>Excluir</button></div>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Salvar</button></div>`,
    onMount(m, close) {
      bindDecor(m, deco);
      m.querySelector("[data-go]").onclick = async () => {
        const r = await emit("channel:update", { channelId: cid, name: m.querySelector("#eName").value, topic: m.querySelector("#eTopic")?.value, emoji: deco.emoji, cat: m.querySelector("[data-cat]").value });
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
      ${live ? "" : `<div class="toggle-row" style="border:0"><span><b>Transmitir áudio</b><small>${ANDROID && ANDROID.screenAudio ? "Som do celular (jogos, vídeos e música) — Android 10 ou mais novo. As vozes da call não vão junto." : "Som da aba ou do PC. As vozes da call não vão junto."}</small></span><label class="switch"><input type="checkbox" id="shAudio" ${S.settings.shareAudio ? "checked" : ""}><i></i></label></div>`}
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
  // menu com ícones do mesmo estilo (sem emojis misturados) e marca no item aberto
  const SEC_IC = { account: "users", security: "shield", turbo: "sparkles", plans: "gem", voice: "mic", stream: "monitorUp", app: "download", games: "gamepad", overlay: "grid", remote: "monitor", look: "brush", notif: "bell", keys: "settings", overview: "settings", roles: "shield", members: "users", bans: "x", log: "receipt", delete: "trash", invites: "link" };
  const secName = n => String(n).replace(/^[^\p{L}\p{N}]+/u, "").trim();
  wrap.innerHTML = `<div class="settings-nav"><nav>${sections.map(s => s === "-" ? "<hr>" : s.label ? `<span class="label">${esc(s.label)}</span>` : `<button type="button" data-sec="${s.id}" class="${s.danger ? "danger" : ""}">${ic(SEC_IC[s.id] || "settings", "sm")}<span>${esc(secName(s.name))}</span></button>`).join("")}</nav></div><div class="settings-main"></div><div class="settings-close"><button type="button" data-close aria-label="Fechar">${ic("x")}</button><small>ESC</small></div>`;
  $("#layer").append(wrap);
  const main = wrap.querySelector(".settings-main");
  let cleanup = null;
  const show = id => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    if (sec.action) { sec.action(close); return; }
    if (cleanup) { cleanup(); cleanup = null; }
    $$(".settings-nav button", wrap).forEach(b => b.classList.toggle("on", b.dataset.sec === id));
    main.innerHTML = `<div class="pane"><h2>${esc(String(sec.name).replace(/^[^\p{L}\p{N}]+/u, "").trim())}</h2>${sec.render()}</div>`;
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
/* Cor de destaque em camadas: cor temática do servidor aberto > Aurys da conta (Pro/Max) > cor escolhida neste aparelho */
function applyAccent() {
  const root = document.documentElement, s = (S.view === "chat" || S.view === "stage") ? srv() : null;
  const aur = S.me && S.me.accent;   // o servidor só manda se o plano libera
  const a1 = (s && s.accent) || (aur && aur[0]) || S.settings.accent || "#7c5cff";
  const a2 = (s && s.accent) ? `color-mix(in srgb, ${s.accent} 55%, #22d3ee)` : (aur && aur[1]) || "#22d3ee";
  root.style.setProperty("--accent", a1);
  root.style.setProperty("--accent-2", a2);
  root.classList.toggle("aurys", !!aur);
}
function applySettings() {
  const st = S.settings, root = document.documentElement;
  root.dataset.theme = st.theme;
  applyAccent();
  root.classList.toggle("reduce-motion", !!st.reduceMotion);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = st.theme === "light" ? "#e4e6ef" : st.theme === "midnight" ? "#000000" : "#0b0c14";
}
function userSettings(initial) {
  settingsShell([
    { label: "Configurações do usuário" },
    { id: "account", name: "Minha conta", render: renderAccount, mount: mountAccount },
    ...(LOCAL ? [] : [{ id: "security", name: "🔒 Segurança", render: () => `<div id="secRoot"><p style="color:var(--muted)">Carregando…</p></div>`, mount: p => { mountSecurity(p); } }]),
    { id: "turbo", name: "⚡ Perfil Turbo", render: () => `<div id="turboRoot"></div>`, mount: mountTurbo },
    { id: "plans", name: "💎 Planos e pagamentos", action: close => { close(); goPremium(); } },
    { id: "voice", name: "Voz e vídeo", render: renderVoiceSettings, mount: mountVoiceSettings },
    { id: "stream", name: "Transmissão", render: () => `<p style="color:var(--muted);margin-top:-8px">Padrão usado ao entrar ao vivo. Você pode mudar durante a transmissão.</p><span class="label">Qualidade padrão</span><div class="qgrid" style="margin-top:8px">${Object.entries(QUALITY).map(([k, v]) => `<button type="button" class="qopt${k === S.settings.shareQuality ? " on" : ""}" data-q="${k}">${v.tag ? `<span class="tag">${v.tag}</span>` : ""}<b>${v.label}</b><small>${v.sub}</small></button>`).join("")}</div>${toggleRow("shareAudio", "Transmitir áudio por padrão", "Inclui o som da aba ou do sistema", S.settings.shareAudio)}<div class="hint" style="margin-top:16px">Como a Auryx Nexos economiza recursos: a tela só é codificada para quem está assistindo, a taxa de bits se divide entre os espectadores, o codec é escolhido pelo modo (VP9 para texto nítido, H.264 com aceleração por hardware para movimento) e o áudio usa Opus com supressão de silêncio.</div>`, mount: p => { p.addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) { S.settings.shareQuality = b.dataset.q; saveSettings(); $$("[data-q]", p).forEach(x => x.classList.toggle("on", x === b)); } }); bindToggles(p); } },
    { id: "app", name: "Baixar o app", render: renderAppDl, mount: mountAppDl },
    { id: "games", name: "Jogos e Steam", render: renderGames, mount: mountGames },
    { id: "overlay", name: "🎮 Sobreposição de jogo", render: renderOverlaySettings, mount: mountOverlaySettings },
    { id: "remote", name: "Controle remoto", render: renderRemote, mount: mountRemote },
    { label: "Aplicativo" },
    { id: "look", name: "Aparência", render: renderLook, mount: mountLook },
    { id: "notif", name: "Notificações", render: () => toggleRow("sounds", "Sons do aplicativo", "Entrar/sair da sala, menções, mutar", S.settings.sounds) + (ANDROID ? `<p class="hint" style="margin-top:14px">No app Android os avisos chegam pela notificação do próprio celular.</p>` : toggleRow("notify", "Notificações (mesmo com o app fechado)", "Mensagens privadas, menções, pedidos de amizade e atendimento", S.settings.notify && "Notification" in window && Notification.permission === "granted") + `<p class="hint" style="margin-top:12px">No iPhone, as notificações só funcionam com o app instalado na Tela de Início (Compartilhar › Adicionar à Tela de Início).</p>`), mount: p => bindToggles(p, async (k, v, inp) => { if (k === "notify" && v) { if (!("Notification" in window)) { inp.checked = false; S.settings.notify = false; saveSettings(); toast("Seu navegador não suporta notificações.", "warn"); return; } const perm = await Notification.requestPermission(); if (perm !== "granted") { inp.checked = false; S.settings.notify = false; saveSettings(); toast("Permissão de notificação negada.", "warn"); } else if (await setupPush(false)) toast("Notificações ligadas! Elas chegam mesmo com o app fechado. 🔔", "ok"); } }) },
    { id: "keys", name: "Atalhos", render: () => [["Ctrl + K", "Ir para servidor ou canal"], ["Ctrl + Shift + M", "Silenciar / ativar microfone"], ["Ctrl + Shift + D", "Desativar / ativar áudio"], ["↑ (caixa vazia)", "Editar sua última mensagem"], ["Shift + Enter", "Nova linha"], ["Esc", "Fechar janela / cancelar resposta"], ["Shift + clique na lixeira", "Apagar sem confirmar"]].map(([k, d]) => `<div class="toggle-row"><span>${d}</span><span class="kbd">${k}</span></div>`).join("") },
    "-",
    { id: "logout", name: "Sair", danger: true, action: async close => { if (await confirmBox({ title: "Sair", html: "Tem certeza de que quer sair da sua conta?", ok: "Sair" })) { close(); logout(); } } }
  ], initial);
}
/* Perfil Turbo: tudo liberado, com prévia ao vivo */
function mountTurbo(p) {
  const me = S.me;
  let saved = false;
  const d = { avatar: me.avatar || "", banner: me.banner || "", bannerStill: me.bannerStill || "", theme: me.theme || [me.color || "#7c5cff", "#22d3ee"], useTheme: !!me.theme, pron: me.pron || "", cs: { e: (me.cs && me.cs.e) || "", t: (me.cs && me.cs.t) || "" }, fx: me.fx || "", pfx: me.pfx || "", ring: me.ringPref || "", bp: bpOf(me), ap: { x: 50, y: 50, z: 100, ...(me.ap || {}) },
    accent: me.accentSaved || [S.settings.accent || "#7c5cff", "#22d3ee"], useAccent: !!me.accentSaved };
  const root = p.querySelector("#turboRoot");
  const FX = [["", "Normal"], ["grad", "Degradê"], ["glow", "Brilho"], ["rainbow", "Arco-íris"]];
  const PFX = [["", "Nenhum"], ["aurora", "Aurora"], ["stars", "Estrelas"], ["fire", "Fogo"], ["neon", "Neon"], ["galaxy", "Galáxia"], ["sakura", "Sakura"], ["snow", "Neve"], ["hearts", "Corações"]];
  const RINGS = [["", "Nenhuma", 0], ["spin", "Giratória", 2], ["pulse", "Pulsante", 2], ["rainbow", "Arco-íris", 2], ["gold", "Ouro", 3], ["aurora", "Aurora", 3]];
  const AURYS = [["#7c5cff", "#22d3ee"], ["#ff4d8d", "#ffb86b"], ["#00c6a7", "#1e90ff"], ["#f59e0b", "#ef4444"], ["#a855f7", "#ec4899"], ["#22c55e", "#06b6d4"], ["#e11d48", "#7c3aed"], ["#64748b", "#e2e8f0"]];
  const preview = () => {
    const u = { ...me, avatar: d.avatar, banner: d.banner, bannerStill: d.bannerStill, bp: d.bp, ap: d.avatar && d.avatar.startsWith("/f/") ? d.ap : null, theme: d.useTheme ? d.theme : null, pron: d.pron, cs: d.cs.t || d.cs.e ? d.cs : null, fx: d.fx, pfx: d.pfx, ring: d.ring, status: me.statusPref === "invisible" ? "offline" : me.statusPref };
    return `<div class="popover profile-pop turbo-preview${d.pfx ? " pfx-" + d.pfx : ""}">${bannerHTML(u)}<div class="pc">${avatar(u, 76, true)}${badges(u)}<h3>${nameHTML(u)}${u.pron ? `<small class="pron">${esc(u.pron)}</small>` : ""}</h3><div class="status-line"><i class="dot st-${esc(u.status)}"></i>${STATUS[u.status] || ""}</div>${u.cs ? `<div class="cs-bubble">${csText(u)}</div>` : ""}${u.about ? `<div class="sec"><span class="label">Sobre mim</span>${esc(u.about)}</div>` : ""}</div></div>`;
  };
  const R = myRank(), PN = ["", "VIP", "Pro", "Max"];
  // seção bloqueada: mostra o cadeado e o plano necessário (o servidor também confere)
  const sec = (need, html) => R >= need ? `<div class="tsec">${html}</div>` : `<div class="tsec locked"><div class="lock-tag" data-act="premium">${ic("gem", "xs")} Plano ${PN[need]}</div>${html}</div>`;
  const draw = () => {
    root.innerHTML = `<p style="color:var(--muted);margin-top:-8px">${R ? `Seu plano <b>${PN[R]}</b> está ativo. ✨` : `Personalize seu perfil com os planos <b>Premium</b>. <a data-act="premium" style="cursor:pointer">Ver planos →</a>`}</p>
      <div class="turbo">
        <div class="turbo-form">
          ${sec(2, `<span class="label">Avatar animado</span>
          <div class="row-btns"><button class="btn sm" data-up="avatar">${ic("image", "sm")}Enviar imagem ou GIF</button>${d.avatar ? `<button class="btn sm ghost" data-clear="avatar">Remover</button>` : ""}</div>
          ${d.avatar && d.avatar.startsWith("/f/") ? `<div class="bp-ctl"><span class="label">Enquadramento do avatar</span>
          <label class="bp-range"><span>Zoom <b data-av="z">${d.ap.z}%</b></span><input type="range" min="100" max="300" step="5" data-k="az" value="${d.ap.z}"></label>
          <label class="bp-range"><span>Horizontal <b data-av="x">${d.ap.x}%</b></span><input type="range" min="0" max="100" data-k="ax" value="${d.ap.x}"></label>
          <label class="bp-range"><span>Vertical <b data-av="y">${d.ap.y}%</b></span><input type="range" min="0" max="100" data-k="ay" value="${d.ap.y}"></label>
          <div class="row-btns"><button type="button" class="btn sm ghost" data-ap-reset>Centralizar</button></div>
          <small class="hint" style="display:block;margin:-4px 0 12px">Dica: arraste o avatar na prévia para escolher a parte do GIF que aparece no círculo.</small></div>` : ""}
          <span class="label">Banner (imagem ou GIF animado)</span>
          <div class="row-btns"><button class="btn sm" data-up="banner">${ic("image", "sm")}Enviar banner</button>${d.banner ? `<button class="btn sm ghost" data-clear="banner">Remover</button>` : ""}</div>
          <small class="hint" style="display:block;margin:-4px 0 12px">GIF de até 6 MB, de preferência 600×240. Quem usa "reduzir animações" vê o 1º quadro.</small>
          ${d.banner && d.banner.startsWith("/f/") ? `<div class="bp-ctl"><span class="label">Enquadramento do banner</span>
          <div class="chips">${[["s", "Baixo"], ["m", "Médio"], ["l", "Alto"]].map(([k, n]) => `<button type="button" class="chip${d.bp.h === k ? " on" : ""}" data-bh="${k}">${n}</button>`).join("")}</div>
          <label class="bp-range"><span>Zoom <b data-bv="z">${d.bp.z}%</b></span><input type="range" min="100" max="300" step="5" data-k="bz" value="${d.bp.z}"></label>
          <label class="bp-range"><span>Horizontal <b data-bv="x">${d.bp.x}%</b></span><input type="range" min="0" max="100" data-k="bx" value="${d.bp.x}"></label>
          <label class="bp-range"><span>Vertical <b data-bv="y">${d.bp.y}%</b></span><input type="range" min="0" max="100" data-k="by" value="${d.bp.y}"></label>
          <div class="row-btns"><button type="button" class="btn sm ghost" data-bp-reset>Centralizar</button></div>
          <small class="hint" style="display:block;margin:-4px 0 12px">Dica: arraste a imagem na prévia para mudar o ponto que aparece.</small></div>` : ""}
          <span class="label">Moldura do avatar</span>
          <div class="chips">${RINGS.map(([k, n, need]) => `<button class="chip${d.ring === k ? " on" : ""}${need > R ? " locked-chip" : ""}" data-ring="${k}" ${need > R ? `data-tip="Plano ${PN[need]}"` : ""}>${n}${need > R ? " 🔒" : ""}</button>`).join("")}</div>`)}
          ${sec(2, `<div class="toggle-row"><span><b>Aurys · cor do app inteiro</b><small>Botões, destaques e degradês na sua cor, em todos os seus aparelhos</small></span><label class="switch"><input type="checkbox" data-k="useAccent" ${d.useAccent ? "checked" : ""}><i></i></label></div>
          <div ${d.useAccent ? "" : 'style="opacity:.4;pointer-events:none"'}><div class="aurys-presets">${AURYS.map(([a, b]) => `<button type="button" class="aurys-sw${d.accent[0] === a && d.accent[1] === b ? " on" : ""}" style="--a:${a};--b:${b}" data-aurys="${a},${b}"></button>`).join("")}</div>
          <div class="row-btns"><label class="color-in">Principal<input type="color" data-k="a0" value="${esc(d.accent[0])}"></label><label class="color-in">Degradê<input type="color" data-k="a1" value="${esc(d.accent[1])}"></label></div></div>`)}
          ${sec(1, `<div class="toggle-row"><span><b>Cores do perfil</b><small>Degradê usado no banner e no efeito do nome</small></span><label class="switch"><input type="checkbox" data-k="useTheme" ${d.useTheme ? "checked" : ""}><i></i></label></div>
          <div class="row-btns" ${d.useTheme ? "" : 'style="opacity:.4;pointer-events:none"'}><label class="color-in">Cor 1<input type="color" data-k="t0" value="${esc(d.theme[0])}"></label><label class="color-in">Cor 2<input type="color" data-k="t1" value="${esc(d.theme[1])}"></label></div>`)}
          ${sec(2, `<span class="label">Efeito no nome</span>
          <div class="chips">${FX.map(([k, n]) => `<button class="chip${d.fx === k ? " on" : ""}" data-fx="${k}">${k ? `<span class="nm fx-${k}" style="--n1:${esc(d.theme[0])};--n2:${esc(d.theme[1])}">${n}</span>` : n}</button>`).join("")}</div>`)}
          ${sec(3, `<span class="label">Efeito do perfil</span>
          <div class="chips">${PFX.map(([k, n]) => `<button class="chip${d.pfx === k ? " on" : ""}" data-pfx="${k}">${n}</button>`).join("")}</div>`)}
          ${sec(1, `<label class="field" style="margin-top:14px"><span>Status personalizado</span><div class="cs-in"><button type="button" class="btn sm" data-cs-emoji>${d.cs.e ? esc(d.cs.e) : "😀"}</button><input data-k="cst" maxlength="60" placeholder="O que está rolando?" value="${esc(d.cs.t)}"></div></label>`)}
          <label class="field"><span>Pronomes</span><input data-k="pron" maxlength="24" placeholder="ex.: ele/dele, ela/dela" value="${esc(d.pron)}"></label>
          <button class="btn primary" data-save>Salvar Perfil Turbo</button>
        </div>
        <div class="turbo-prev"><span class="label">Prévia</span>${preview()}</div>
      </div>`;
  };
  const apPaint = () => {
    const im = root.querySelector(".turbo-prev .pc .av-im img");
    if (!im) { refreshPrev(); return; }
    im.style.cssText = bpImgStyle(d.ap);
    for (const k of ["x", "y", "z"]) {
      const b = root.querySelector(`[data-av="${k}"]`), r = root.querySelector(`[data-k="a${k}"]`);
      if (b) b.textContent = d.ap[k] + "%";
      if (r && document.activeElement !== r) r.value = d.ap[k];
    }
  };
  const bpPaint = () => {
    const pb = root.querySelector(".turbo-prev .pb-img"), im = pb && pb.querySelector("img");
    if (!im) { refreshPrev(); return; }
    pb.style.setProperty("--bh", (BANNER_H[d.bp.h] || BANNER_H.m) + "px");
    im.style.cssText = bpImgStyle(d.bp);
    for (const k of ["x", "y", "z"]) {
      const b = root.querySelector(`[data-bv="${k}"]`), r = root.querySelector(`[data-k="b${k}"]`);
      if (b) b.textContent = d.bp[k] + "%";
      if (r && document.activeElement !== r) r.value = d.bp[k];
    }
  };
  // arrastar a imagem na prévia: move o ponto que fica no centro
  root.addEventListener("pointerdown", e => {
    const avEl = e.target.closest(".turbo-prev .pc .av");
    const pb = avEl && avEl.querySelector(".av-im") ? avEl : e.target.closest(".turbo-prev .pb-img");
    if (!pb || e.button) return;
    e.preventDefault();
    const o = pb === avEl ? d.ap : d.bp, paint = pb === avEl ? apPaint : bpPaint;
    const w = pb.clientWidth, h = pb.clientHeight, x0 = o.x, y0 = o.y, sx = e.clientX, sy = e.clientY;
    try { pb.setPointerCapture(e.pointerId); } catch {}
    pb.classList.add("dragging");
    const move = ev => {
      const k = 100 / (o.z / 100);
      o.x = Math.round(Math.min(100, Math.max(0, x0 - (ev.clientX - sx) / w * k)));
      o.y = Math.round(Math.min(100, Math.max(0, y0 - (ev.clientY - sy) / h * k)));
      paint();
    };
    const up = () => { pb.classList.remove("dragging"); pb.removeEventListener("pointermove", move); pb.removeEventListener("pointerup", up); pb.removeEventListener("pointercancel", up); };
    pb.addEventListener("pointermove", move); pb.addEventListener("pointerup", up); pb.addEventListener("pointercancel", up);
  });
  const refreshPrev = () => { const pv = root.querySelector(".turbo-prev"); if (pv) pv.innerHTML = `<span class="label">Prévia</span>${preview()}`; };
  draw();
  // prévia ao vivo da Aurys no app inteiro (volta ao normal se sair sem salvar)
  const liveAccent = () => { const r = document.documentElement.style; if (d.useAccent) { r.setProperty("--accent", d.accent[0]); r.setProperty("--accent-2", d.accent[1]); } else applyAccent(); };
  root.addEventListener("input", e => {
    const k = e.target.dataset.k;
    if (k === "a0" || k === "a1") { d.accent[+k[1]] = e.target.value; liveAccent(); return; }
    if (k === "bx" || k === "by" || k === "bz") { d.bp[k[1]] = +e.target.value; bpPaint(); return; }
    if (k === "ax" || k === "ay" || k === "az") { d.ap[k[1]] = +e.target.value; apPaint(); return; }
    if (k === "t0" || k === "t1") d.theme[+k[1]] = e.target.value;
    else if (k === "cst") d.cs.t = e.target.value;
    else if (k === "pron") d.pron = e.target.value;
    else return;
    refreshPrev();
  });
  root.addEventListener("change", e => {
    if (e.target.dataset.k === "useTheme") { d.useTheme = e.target.checked; draw(); }
    if (e.target.dataset.k === "useAccent") { d.useAccent = e.target.checked; draw(); liveAccent(); }
  });
  root.addEventListener("click", async e => {
    const t = e.target;
    const au = t.closest("[data-aurys]"); if (au) { d.accent = au.dataset.aurys.split(","); draw(); liveAccent(); return; }
    const rg = t.closest("[data-ring]"); if (rg) { const need = (RINGS.find(x => x[0] === rg.dataset.ring) || [0, 0, 0])[2]; if (need > R) { toast(`A moldura ${rg.textContent.replace(" 🔒", "")} é do plano ${PN[need]}.`, "info"); return; } d.ring = rg.dataset.ring; draw(); return; }
    const fx = t.closest("[data-fx]"); if (fx) { d.fx = fx.dataset.fx; draw(); return; }
    const pfx = t.closest("[data-pfx]"); if (pfx) { d.pfx = pfx.dataset.pfx; draw(); return; }
    const bh = t.closest("[data-bh]"); if (bh) { d.bp.h = bh.dataset.bh; root.querySelectorAll("[data-bh]").forEach(b => b.classList.toggle("on", b === bh)); bpPaint(); return; }
    if (t.closest("[data-ap-reset]")) { Object.assign(d.ap, { x: 50, y: 50, z: 100 }); apPaint(); return; }
    if (t.closest("[data-bp-reset]")) { Object.assign(d.bp, { x: 50, y: 50, z: 100 }); bpPaint(); return; }
    const cl = t.closest("[data-clear]"); if (cl) { d[cl.dataset.clear] = ""; if (cl.dataset.clear === "banner") { d.bannerStill = ""; d.bp = bpOf({}); } if (cl.dataset.clear === "avatar") d.ap = { x: 50, y: 50, z: 100 }; draw(); return; }
    const em = t.closest("[data-cs-emoji]"); if (em) { emojiPicker(em, v => { d.cs.e = v; draw(); }); return; }
    const up = t.closest("[data-up]");
    if (up) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif";
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        const isBanner = up.dataset.up === "banner", gif = f.type === "image/gif";
        if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast("Envie PNG, JPG, WEBP ou GIF.", "warn"); return; }
        if (isBanner && gif && f.size > 6 * 1048576) { toast(`Esse GIF tem ${fmtSize(f.size)} — o banner aceita até 6 MB. Diminua ou corte o GIF.`, "warn", 6000); return; }
        up.classList.add("loading");
        try {
          // banner animado: tira o 1º quadro (imagem leve) para quem prefere sem animação e enquanto o GIF carrega
          const still = isBanner && gif ? await gifStill(f).catch(() => null) : null;
          const r = await uploadBlob(f);
          d[up.dataset.up] = r.url;
          if (isBanner) Object.assign(d.bp, { x: 50, y: 50, z: 100 }); else d.ap = { x: 50, y: 50, z: 100 };
          if (isBanner) d.bannerStill = still ? (await uploadBlob(still).catch(() => ({ url: "" }))).url : "";
          draw();
          toast(gif ? (isBanner ? "Banner animado enviado! ✨ Clique em Salvar." : "GIF enviado — seu avatar vai ficar animado! ✨") : "Imagem enviada.", "ok");
        } catch (err) { toast(err.message, "error"); up.classList.remove("loading"); }
      };
      inp.click();
      return;
    }
    if (t.closest("[data-save]")) {
      // só envia o que o plano libera (o resto fica guardado como está)
      const data = { pron: d.pron };
      if (R >= 1) Object.assign(data, { theme: d.useTheme ? d.theme : null, cs: d.cs });
      if (R >= 2) Object.assign(data, { avatar: d.avatar, banner: d.banner, bannerStill: d.bannerStill, bp: d.banner && d.banner.startsWith("/f/") ? d.bp : null, ap: d.avatar && d.avatar.startsWith("/f/") ? d.ap : null, fx: d.fx, ring: d.ring, accent: d.useAccent ? d.accent : null });
      if (R >= 3) data.pfx = d.pfx;
      const r = await emit("profile:update", data);
      if (r.error) toast(r.error, "error"); else { saved = true; toast("Perfil Turbo salvo! ⚡", "ok"); confetti(); }
    }
  });
  return () => { if (!saved) applyAccent(); };
}
/* 1º quadro de um GIF como PNG leve (fallback estático do banner animado) */
function gifStill(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const w = Math.min(img.naturalWidth || 600, 1200), h = Math.round(w * (img.naturalHeight || 240) / (img.naturalWidth || 600));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(new File([b], "banner-estatico.jpg", { type: "image/jpeg" })) : reject(new Error("still"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("still")); };
    img.src = url;
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
    if (r && r.outcome === "accepted") toast("Auryx Nexos instalado! 🎉", "ok");
    return true;
  }
  return false;
}
function renderAppDl() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent), android = /Android/i.test(navigator.userAgent);
  const pwaState = DESKTOP ? "Você já está usando o app de PC. 😎" : isStandalone() ? "✅ A Auryx Nexos já está instalado neste aparelho." : installPrompt ? "" : ios ? "No iPhone/iPad: toque em <b>Compartilhar</b> ⬆️ e depois em <b>Adicionar à Tela de Início</b>." : android ? "No Android: toque no menu ⋮ do Chrome e em <b>Instalar app</b>." : "No Chrome ou Edge: clique no ícone de instalar ⊕ na barra de endereço (ou menu ⋮ › <b>Instalar Auryx Nexos</b>).";
  return `<p style="color:var(--muted);margin-top:-8px">Use a Auryx Nexos como um app de verdade: janela própria, ícone na área de trabalho e notificações.</p>
    <div class="steps">
      <div class="step"><b>${ic("monitor", "sm")}</b><div><b>App para Windows</b><small>Programa completo: seletor de tela próprio, fica na bandeja e já vem com o controle remoto embutido (não precisa do Agente Auryx).</small>${DESKTOP ? `<small style="color:var(--green)">✅ Instalado — você está nele agora.</small>` : `<a class="btn primary sm" href="${DESKTOP_URL}" target="_blank" rel="noopener">${ic("arrowDown", "sm")}Baixar Auryx-Nexos-Setup.exe</a><small>Se o Windows avisar "O Windows protegeu o computador", clique em <b>Mais informações › Executar assim mesmo</b>.</small>`}</div></div>
      <div class="step"><b>${ic("gamepad", "sm")}</b><div><b>App para Android (APK)</b><small>Transmite a tela do celular, mantém a chamada com a tela bloqueada e avisa de mensagens.</small>${ANDROID ? `<small style="color:var(--green)">✅ Instalado — você está nele agora.</small>` : `<a class="btn primary sm" href="${ANDROID_URL}" target="_blank" rel="noopener">${ic("arrowDown", "sm")}Baixar Auryx-Nexos.apk</a><small>No Android, permita "instalar apps desconhecidos" para o navegador quando pedir. Não está na Play Store.</small>`}</div></div>
      <div class="step"><b>${ic("users", "sm")}</b><div><b>Instalar pelo navegador (PC e celular)</b><small>Leve e sem baixar nada: vira um app com ícone, direto do site.</small>${installPrompt && !DESKTOP ? `<button class="btn primary sm" data-install>${ic("plus", "sm")}Instalar Auryx Nexos</button>` : ""}${pwaState ? `<small>${pwaState}</small>` : ""}</div></div>
    </div>`;
}
function mountAppDl(p, rerender) {
  const b = p.querySelector("[data-install]");
  if (b) b.onclick = async () => { await installApp(); rerender(); };
}
// Co-op de verdade: cada amigo vira um controle de Xbox virtual (precisa do driver ViGEmBus neste PC)
function remotePads() {
  const st = agentOk() ? AG.pad : "";
  const status = st === "ok" ? `<small style="color:var(--green)">✅ Driver pronto — cada amigo vira um controle de Xbox (Jogador 2, 3, 4).</small>`
    : st === "nodriver" ? `<small style="color:var(--yellow)">⚠️ Driver não encontrado neste PC.</small>`
    : st === "erro" ? `<small style="color:var(--yellow)">⚠️ O driver respondeu com erro. Reinstale o ViGEmBus e reinicie o PC.</small>`
    : agentOk() && AG.ver < 2 ? `<small style="color:var(--yellow)">⚠️ Seu Agente Auryx é antigo: baixe de novo (ou atualize o app de PC).</small>` : "";
  return `<span class="label" style="margin-top:18px;display:block">Co-op com controle (Jogador 2, 3, 4)</span>
    <div class="steps"><div class="step"><b>${ic("gamepad", "sm")}</b><div><b>Driver de controle virtual (ViGEmBus)</b><small>Para o jogo reconhecer cada amigo como um controle diferente (LEGO, luta, corrida em tela dividida…), instale uma vez neste PC o driver gratuito ViGEmBus. Sem ele, o controle do amigo vira teclado e o jogo acha que é o Jogador 1.</small>${status}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><a class="btn sm" href="${VIGEM_URL}" target="_blank" rel="noopener">${ic("arrowDown", "sm")}Baixar ViGEmBus</a><button class="btn sm" data-pad-check>Verificar driver</button></div><small>Depois de instalar, reinicie o PC. Quem joga de longe pode usar controle de Xbox, PlayStation, genérico ou o teclado (opção "Teclado como controle").</small></div></div></div>`;
}
// Segurança e histórico do controle remoto (vale para o app de PC e para o Agente Auryx)
function remoteSafety() {
  const log = store.get("ctrlLog", []).slice(0, 10);
  const when = t => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dur = e => { const m = Math.max(1, Math.round(((e.end || Date.now()) - e.at) / 60e3)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const why = { inativo: " · terminou por inatividade" };
  return `<span class="label" style="margin-top:18px;display:block">Segurança</span>
    ${toggleRow("noCtrl", "Bloquear pedidos de controle", "Ninguém consegue pedir para controlar seu PC enquanto isto estiver ligado.", !!S.settings.noCtrl)}
    <div class="hint" style="margin-top:8px">Nada acontece sem você aceitar. O controle termina sozinho depois de 15 minutos sem uso, quando você para de transmitir ou quando clica em <b>Encerrar</b> na barra de controle.</div>
    <span class="label" style="margin-top:18px;display:block">Histórico neste aparelho</span>
    ${log.length ? `<div class="steps">${log.map(e => `<div class="step"><b>${ic(e.mode === "full" ? "pointer" : "gamepad", "sm")}</b><div><b>${esc(e.name || "?")}</b><small>${e.mode === "full" ? "Controle total" : "Co-op"} · ${when(e.at)} · ${e.end ? dur(e) : "em andamento"}${why[e.why] || ""}</small></div></div>`).join("")}</div>` : `<small style="color:var(--muted)">Ninguém controlou este PC ainda.</small>`}`;
}
function renderRemote() {
  const local = LOCAL || location.protocol === "file:";
  if (DESKTOP) return `<p style="color:var(--muted);margin-top:-8px">Deixe um amigo controlar seu PC (como AnyDesk) ou jogar com você em co-op local pela transmissão.</p>
    <div class="steps"><div class="step"><b>✓</b><div><b>Já está pronto!</b><small>O app de PC tem o controle remoto embutido. Quando alguém clicar em ${ic("gamepad", "xs")} <b>Pedir controle</b> na sua transmissão, é só escolher <b>Co-op</b> ou <b>Controle total</b>.</small><small>Para jogos que rodam como administrador, abra a Auryx Nexos como administrador também.</small></div></div></div>${remotePads()}${remoteSafety()}`;
  return `<p style="color:var(--muted);margin-top:-8px">Deixe um amigo controlar seu PC (como AnyDesk) ou jogar com você em co-op local pela transmissão — como o Remote Play Together da Steam.</p>
    <div class="steps">
      <div class="step"><b>1</b><div><b>Baixe o Agente Auryx</b><small>Um programinha do Windows que move o mouse e o teclado quando você permite. Não precisa instalar.</small>${local ? `<small style="color:var(--yellow)">Disponível na versão online da Auryx Nexos.</small>` : `<a class="btn sm" href="/agente/Auryx-Agente.zip" download>${ic("arrowDown", "sm")}Baixar Auryx-Agente.zip</a>`}</div></div>
      <div class="step"><b>2</b><div><b>Abra o agente</b><small>Descompacte e dê dois cliques em <span class="kbd">Auryx-Agente.bat</span>. Ele mostra um código de 6 números.</small></div></div>
      <div class="step"><b>3</b><div><b>Conecte aqui</b><div class="invite-box" style="margin-top:8px"><input id="agCode" inputmode="numeric" maxlength="6" placeholder="Código de 6 números" value="${esc(S.settings.agentCode || "")}"><button class="btn primary sm" data-ag>Conectar</button></div><small data-ag-status style="margin-top:6px;display:block">${agentOk() ? "✅ Agente conectado" : "Agente desconectado"}</small></div></div>
      <div class="step"><b>4</b><div><b>Transmita a tela e aceite</b><small>Quando alguém clicar em ${ic("gamepad", "xs")} <b>Pedir controle</b> na sua transmissão, você escolhe: <b>Co-op</b> (só teclado/controle) ou <b>Controle total</b> (mouse e teclado). Fechar a janela do agente corta tudo na hora.</small></div></div>
    </div>
    <div class="hint" style="margin-top:16px">Para jogar co-op: transmita no modo <b>Movimento</b> com <b>720p ou 1080p 60 FPS</b>. Quem joga pode usar controle ou teclado — com o driver ViGEmBus (abaixo), cada controle vira um jogador separado no jogo.</div>${remotePads()}${remoteSafety()}`;
}
function mountRemote(p, rerender) {
  bindToggles(p, (k, on) => { if (k === "noCtrl" && on) toast("Pedidos de controle bloqueados.", "ok"); });
  const chk = p.querySelector("[data-pad-check]");
  if (chk) chk.onclick = async () => {
    chk.classList.add("loading");
    try { await agentConnect(); }
    catch (e) { chk.classList.remove("loading"); toast(e.message, "error", 6000); return; }
    const okPad = AG.pad === "ok";
    toast(okPad ? "Driver de controle virtual pronto! Seus amigos vão aparecer como Jogador 2, 3 e 4." : AG.ver < 2 ? "Seu Agente Auryx é antigo: baixe de novo (ou atualize o app de PC)." : "Driver ViGEmBus não encontrado neste PC. Instale e reinicie o PC.", okPad ? "ok" : "warn", 7000);
    ctrlWatch();
    rerender();
  };
  const btn = p.querySelector("[data-ag]");
  if (!btn) return;
  btn.onclick = async () => {
    const code = p.querySelector("#agCode").value.replace(/\D/g, "");
    if (code.length !== 6) { toast("O código tem 6 números.", "warn"); return; }
    S.settings.agentCode = code; saveSettings();
    if (AG.ws) { try { AG.ws.close(); } catch {} AG.ws = null; }
    try { await agentConnect(code); toast("Agente Auryx conectado!", "ok"); rerender(); }
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
  return `<div class="profile-card" style="--c:${esc(me.color)}"><div class="pb"${me.banner ? ` style="${bannerStyle(me)}"` : ""}></div><div class="pc"><span data-pick-avatar data-tip="Trocar avatar">${avatar({ ...me, status: me.statusPref === "invisible" ? "offline" : me.statusPref }, 92, true)}</span><div class="info"><b>${esc(me.username)}</b><small>No Auryx Nexos desde ${new Date(me.created).toLocaleDateString("pt-BR")}</small></div><button class="btn sm" data-rename-me>Trocar nome</button><button class="btn sm" data-pick-avatar>Alterar avatar</button></div></div>
    ${LOCAL ? "" : `<div class="email-box"><span>${ic("bell", "sm")}<b>E-mail</b>${me.email ? `<small>${esc(me.email)} ${me.emailVerified ? `<span class="ost st-ok">confirmado</span>` : `<span class="ost st-pend">não confirmado</span>`}</small>` : `<small>Nenhum e-mail — adicione para poder recuperar a senha.</small>`}</span><button class="btn sm" data-email>${me.email ? "Trocar e-mail" : "Adicionar e-mail"}</button></div>`}
    <span class="label">Cor do perfil</span>
    <div class="swatches" style="margin:8px 0 18px">${COLORS.map(c => `<button type="button" class="swatch${c === me.color ? " on" : ""}" style="--c:${c}" data-color="${c}"></button>`).join("")}</div>
    <span class="label">Status</span>
    <div class="qgrid" style="margin-top:8px">${["online", "idle", "dnd", "invisible"].map(s => `<button type="button" class="qopt${me.statusPref === s ? " on" : ""}" data-status="${s}"><b><i class="dot st-${s === "invisible" ? "offline" : s}"></i> ${STATUS[s]}</b><small>${{ online: "Todos veem que você está online", idle: "Você aparece como ausente", dnd: "Sem sons de menção", invisible: "Aparece offline, mas usa tudo" }[s]}</small></button>`).join("")}</div>
    <label class="field"><span>Sobre mim</span><textarea id="about" maxlength="190" placeholder="Conte algo sobre você">${esc(me.about || "")}</textarea></label>
    <button class="btn primary" data-save-about>Salvar</button>`;
}
function emailModal(done) {
  let step = 1;
  modal({
    title: "E-mail da conta", sub: "Usado para confirmar sua conta e recuperar a senha.",
    body: `<div data-step1><label class="field"><span>Novo e-mail</span><input data-em type="email" maxlength="200" autocomplete="email"></label><label class="field"><span>Sua senha atual</span><input data-pw type="password" autocomplete="current-password"></label></div>
      <div data-step2 class="hidden"><p data-msg style="color:var(--text-2)"></p><label class="field"><span>Código de 6 números</span><input data-code class="code-in" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label></div>
      <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" data-go>Enviar código</button></div>`,
    onMount(m, close) {
      const go = m.querySelector("[data-go]");
      go.onclick = async () => {
        go.classList.add("loading");
        try {
          if (step === 1) {
            const r = await emit("account:email", { email: m.querySelector("[data-em]").value.trim(), password: m.querySelector("[data-pw]").value });
            if (r.error) throw new Error(r.error);
            step = 2;
            m.querySelector("[data-step1]").classList.add("hidden");
            m.querySelector("[data-step2]").classList.remove("hidden");
            m.querySelector("[data-msg]").textContent = `Enviamos um código para ${r.email}. Confira o spam também.`;
            go.textContent = "Confirmar";
            m.querySelector("[data-code]").focus();
          } else {
            await authApi("account/verify", { code: m.querySelector("[data-code]").value.replace(/\D/g, "") }, true);
            close(); toast("E-mail confirmado! ✅", "ok");
            setTimeout(done, 300);
          }
        } catch (err) { toast(err.message, "error"); }
        finally { go.classList.remove("loading"); }
      };
    }
  });
}
/* --- Segurança: trocar senha e aparelhos conectados --- */
async function mountSecurity(p) {
  const root = p.querySelector("#secRoot");
  const draw = async () => {
    const r = await emit("account:sessions", {});
    if (r.error) { root.innerHTML = esc(r.error); return; }
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; };
    root.innerHTML = `<span class="label">Senha</span>
      <form class="sec-pass" data-pass><label class="field"><span>Senha atual</span><input type="password" data-cur autocomplete="current-password" maxlength="128"></label><label class="field"><span>Nova senha</span><input type="password" data-new autocomplete="new-password" maxlength="128" placeholder="8+ caracteres, letras e números"></label><button class="btn primary">Trocar senha</button></form>
      <small style="color:var(--muted);display:block;margin:-4px 0 22px">Ao trocar, os outros aparelhos saem da conta. Esqueceu a senha? Saia e use "Esqueci a senha".</small>
      <span class="label">Aparelhos conectados (${r.list.length})</span>
      <div class="sec-list">${r.list.map(x => `<div class="sec-dev${x.current ? " cur" : ""}"><span class="sec-ico">${ic(/Android|iPhone/.test(x.dev) ? "phone" : "monitor")}</span><div class="who"><b>${esc(x.dev)}${x.current ? ` <span class="ost st-ok">este aparelho</span>` : x.online ? ` <span class="ost st-rev">online</span>` : ""}</b><small>Entrou em ${new Date(x.created).toLocaleDateString("pt-BR")} · ativo ${ago(x.last)}</small></div>${x.current ? "" : `<button class="btn sm danger" data-end="${esc(x.id)}">Desconectar</button>`}</div>`).join("")}</div>
      ${r.list.length > 1 ? `<button class="btn danger" style="margin-top:12px" data-endall>Desconectar todos os outros</button>` : ""}
      <small style="color:var(--muted);display:block;margin-top:10px">Não reconhece algum aparelho? Desconecte e troque a senha.</small>`;
  };
  root.addEventListener("submit", async e => {
    e.preventDefault();
    const cur = root.querySelector("[data-cur]").value, nx = root.querySelector("[data-new]").value;
    const r = await emit("account:password", { current: cur, next: nx });
    if (r.error) { toast(r.error, "error"); return; }
    toast(`Senha trocada!${r.ended ? ` ${r.ended} outro${r.ended > 1 ? "s aparelhos saíram" : " aparelho saiu"} da conta.` : ""}`, "ok", 5000);
    draw();
  });
  root.addEventListener("click", async e => {
    const b = e.target.closest("[data-end]"), all = e.target.closest("[data-endall]");
    if (!b && !all) return;
    if (all && !confirm("Desconectar todos os outros aparelhos?")) return;
    const r = await emit("account:session:end", all ? { others: true } : { id: b.dataset.end });
    if (r.error) { toast(r.error, "error"); return; }
    toast(r.ended ? "Aparelho desconectado." : "Esse aparelho já tinha saído.", "ok");
    draw();
  });
  draw();
}
function mountAccount(p, rerender) {
  const upd = async data => { const r = await emit("profile:update", data); if (r.error) toast(r.error, "error"); else setTimeout(rerender, 80); };
  p.addEventListener("click", e => {
    if (e.target.closest("[data-email]")) { emailModal(rerender); return; }
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
      ${[["ai", "IA da Auryx Nexos (recomendado)", "RNNoise: tira ventilador, teclado, cachorro, trânsito — deixa só a sua voz"], ["browser", "Padrão do navegador", "Mais leve, remove só ruído constante"], ["off", "Desligada", "Som cru do microfone (bom para música)"]].map(([k, t, d]) => `<label class="radio-card${nsMode() === k ? " on" : ""}"><span><b>${t}</b><small>${d}</small></span><input type="radio" name="nsm" value="${k}" ${nsMode() === k ? "checked" : ""}></label>`).join("")}
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
  if (!s || !canManage(s)) return;
  const st = { icon: s.icon, color: s.color, banner: s.banner || "", accent: s.accent || "" };
  settingsShell([
    { label: s.name },
    canDo(s, "server") && {
      id: "overview", name: "Visão geral",
      render: () => `<div class="icon-pick"><div data-icon-prev data-tip="Trocar ícone"></div><div style="flex:1"><label class="field" style="margin:0"><span>Nome do servidor</span><input id="ssName" maxlength="40" value="${esc(s.name)}"></label></div></div>
        <span class="label">Cor</span><div class="swatches" style="margin:8px 0 18px">${COLORS.map(c => `<button type="button" class="swatch${c === st.color ? " on" : ""}" style="--c:${c}" data-color="${c}"></button>`).join("")}</div>
        <span class="label">Banner do servidor</span>
        <div class="srv-banner-prev" data-bprev></div>
        <div class="row-btns" style="margin:8px 0 18px"><button type="button" class="btn sm" data-sbanner>${ic("image", "sm")}Enviar banner (imagem ou GIF)</button><button type="button" class="btn sm ghost" data-sbanner-clear>Remover</button></div>
        <div class="toggle-row"><span><b>Cor temática</b><small>Botões e destaques do app mudam para esta cor enquanto alguém está no servidor</small></span><label class="switch"><input type="checkbox" id="ssAccentOn" ${st.accent ? "checked" : ""}><i></i></label></div>
        <div class="row-btns" style="margin:-4px 0 18px" data-accrow ${st.accent ? "" : 'hidden'}><label class="color-in">Cor<input type="color" id="ssAccent" value="${esc(st.accent || st.color || "#7c5cff")}"></label></div>
        <label class="field"><span>Descrição</span><textarea id="ssDesc" maxlength="200" placeholder="Conte do que se trata o servidor">${esc(s.description || "")}</textarea></label>
        <div class="toggle-row"><span><b>Servidor público</b><small>Aparece em Explorar e qualquer pessoa pode entrar</small></span><label class="switch"><input type="checkbox" id="ssPublic" ${s.public ? "checked" : ""}><i></i></label></div>
        <div style="margin-top:18px;display:flex;gap:10px"><button class="btn primary" data-save>Salvar alterações</button><button class="btn" data-invite>${ic("userPlus", "sm")}Convidar pessoas</button></div>`,
      mount(p) {
        const prev = p.querySelector("[data-icon-prev]");
        const bprev = p.querySelector("[data-bprev]");
        const draw = () => {
          prev.innerHTML = serverIcon({ name: p.querySelector("#ssName").value || s.name, icon: st.icon, color: st.color });
          bprev.style.cssText = st.banner ? `background-image:url('${esc(st.banner)}')` : `background:linear-gradient(135deg, ${esc(st.accent || st.color)}, color-mix(in srgb, ${esc(st.accent || st.color)} 35%, #000))`;
          bprev.innerHTML = `<b>${esc(p.querySelector("#ssName").value || s.name)}</b>`;
        };
        draw();
        p.querySelector("#ssName").addEventListener("input", draw);
        prev.addEventListener("click", () => iconMenu(prev, v => { st.icon = v; draw(); }));
        p.querySelector("#ssAccentOn").addEventListener("change", e => { st.accent = e.target.checked ? p.querySelector("#ssAccent").value : ""; p.querySelector("[data-accrow]").hidden = !e.target.checked; draw(); });
        p.querySelector("#ssAccent").addEventListener("input", e => { st.accent = e.target.value; draw(); });
        p.addEventListener("click", async e => {
          const col = e.target.closest("[data-color]");
          if (col) { st.color = col.dataset.color; $$("[data-color]", p).forEach(b => b.classList.toggle("on", b === col)); draw(); }
          if (e.target.closest("[data-sbanner-clear]")) { st.banner = ""; draw(); }
          const sb = e.target.closest("[data-sbanner]");
          if (sb) {
            const inp = document.createElement("input");
            inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif";
            inp.onchange = async () => {
              const f = inp.files[0];
              if (!f) return;
              if (f.size > 6 * 1048576) { toast("O banner pode ter até 6 MB.", "warn"); return; }
              sb.classList.add("loading");
              try { st.banner = (await uploadBlob(f)).url; draw(); toast("Banner enviado — clique em Salvar alterações.", "ok"); }
              catch (err) { toast(err.message, "error"); }
              sb.classList.remove("loading");
            };
            inp.click();
          }
          if (e.target.closest("[data-invite]")) inviteModal(sid);
          if (e.target.closest("[data-save]")) {
            const r = await emit("server:update", { serverId: sid, name: p.querySelector("#ssName").value, icon: st.icon, color: st.color, description: p.querySelector("#ssDesc").value, isPublic: p.querySelector("#ssPublic").checked, banner: st.banner, accent: st.accent });
            if (r.error) toast(r.error, "error"); else toast("Servidor atualizado.", "ok");
          }
        });
      }
    },
    canDo(s, "roles") && rolesSection(s, sid),
    membersSection(s, sid),
    canDo(s, "ban") && bansSection(sid),
    logSection(sid),
    s.ownerId === S.me.id && "-",
    s.ownerId === S.me.id && {
      id: "delete", name: "Excluir servidor", danger: true,
      action: async close => {
        if (await confirmBox({ title: `Excluir "${s.name}"`, html: `Todos os canais e mensagens serão apagados para sempre. Isso não pode ser desfeito.`, ok: "Excluir servidor" })) {
          const r = await emit("server:delete", { serverId: sid });
          if (r.error) toast(r.error, "error"); else close();
        }
      }
    }
  ].filter(Boolean), initial);
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
    canManage(s) && { label: "Configurações do servidor", icon: "settings", run: () => serverSettings(sid) },
    canDo(s, "roles") && { label: "Cargos", icon: "shield", run: () => serverSettings(sid, "roles") },
    canDo(s, "channels") && { label: "Criar canal", icon: "plus", run: () => channelModal("text", sid) },
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
    canDo(s, "channels") && "-",
    canDo(s, "channels") && { label: "Editar canal", icon: "settings", run: () => channelSettings(cid) },
    canDo(s, "channels") && { label: "Mover para cima", icon: "arrowUp", run: () => emit("channel:move", { channelId: cid, dir: -1 }) },
    canDo(s, "channels") && { label: "Mover para baixo", icon: "arrowDown", run: () => emit("channel:move", { channelId: cid, dir: 1 }) },
    canDo(s, "channels") && { label: "Excluir canal", icon: "trash", danger: true, run: () => channelSettings(cid) }
  ]);
}
/* ---------- mensagens fixadas e pesquisa na conversa ---------- */
S.pins = new Map();   // canal -> ids fixados (vem do servidor ao abrir a lista ou quando alguém fixa)
const canPinHere = () => { const c = chan(); if (!c || c.ticket) return false; return c.dm ? true : canDo(srv(), "messages"); };
const pinnedHere = id => (S.pins.get(S.channelId) || []).includes(id);
async function pinMsg(id, want) {
  const r = await emit("pin", { channelId: S.channelId, id, on: want });
  if (r.error) { toast(r.error, "error"); return; }
  S.pins.set(S.channelId, r.pins);
  toast(want ? "Mensagem fixada." : "Mensagem desafixada.", "ok");
}
// mensagem em formato de lista (fixadas e resultados da pesquisa)
function msgCard(m, extra = "") {
  const u = user(m.a);
  const when = new Date(m.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const files = m.f && m.f.length ? `<small>📎 ${m.f.map(f => esc(f.n)).join(", ")}</small>` : "";
  return `<div class="step"><b>${avatar(u, 28)}</b><div style="min-width:0;flex:1"><b style="color:${esc(u.color)}">${esc(u.username)}</b> <small style="display:inline">${when}</small><div class="msg-text">${m.t ? renderText(m.t).html : ""}</div>${files}<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn ghost sm" data-go="${esc(m.id)}">Ir até a mensagem</button>${extra}</div></div></div>`;
}
// leva até a mensagem: carrega páginas mais antigas até achar (no máximo ~1.000 mensagens para trás)
async function goToMsg(id) {
  const cid = S.channelId;
  for (let i = 0; i < 20 && !msgNode(id); i++) {
    const b = S.msgs.get(cid);
    if (!b || !b.more || S.channelId !== cid) break;
    const n = b.list.length;
    await loadHistory(cid, true);
    if (b.list.length === n) break;
  }
  const n = msgNode(id);
  if (!n) { toast("Não deu para chegar nessa mensagem — ela é muito antiga.", "info"); return; }
  n.scrollIntoView({ behavior: S.settings.reduceMotion ? "auto" : "smooth", block: "center" });
  n.classList.remove("highlight"); void n.offsetWidth; n.classList.add("highlight");
}
async function pinsModal() {
  const cid = S.channelId;
  const r = await emit("pins:list", { channelId: cid });
  if (r.error) { toast(r.error, "error"); return; }
  S.pins.set(cid, r.pins.map(m => m.id));
  modal({
    title: "Mensagens fixadas", sub: r.canPin ? "Fixe pelo menu de qualquer mensagem (até 50)." : "Só quem pode gerenciar mensagens fixa e desafixa.",
    body: r.pins.length ? `<div class="steps">${r.pins.map(m => msgCard(m, r.canPin ? `<button type="button" class="btn ghost sm" data-unpin="${esc(m.id)}">Desafixar</button>` : "")).join("")}</div>` : `<div class="empty">${ic("pin")}<p>Nenhuma mensagem fixada aqui ainda.</p></div>`,
    onMount(m, close) {
      m.addEventListener("click", async e => {
        const go = e.target.closest("[data-go]"), un = e.target.closest("[data-unpin]");
        if (go) { close(); goToMsg(go.dataset.go); }
        if (un) { await pinMsg(un.dataset.unpin, false); un.closest(".step").remove(); }
      });
    }
  });
}
function searchModal() {
  const cid = S.channelId;
  modal({
    title: "Pesquisar nesta conversa", sub: "Procura no histórico inteiro, inclusive nas mensagens antigas.",
    body: `<div class="invite-box"><input data-sq maxlength="100" placeholder="O que você procura?" autocomplete="off"><button class="btn primary sm" data-sgo>Pesquisar</button></div><div data-sres style="margin-top:12px"></div>`,
    onMount(m, close) {
      const inp = m.querySelector("[data-sq]"), out = m.querySelector("[data-sres]");
      const run = async () => {
        const q = inp.value.trim();
        if (q.length < 2) { toast("Digite pelo menos 2 letras.", "warn"); return; }
        out.innerHTML = `<small style="color:var(--muted)">Procurando…</small>`;
        const r = await emit("search", { channelId: cid, q });
        if (r.error) { out.innerHTML = ""; toast(r.error, "error"); return; }
        out.innerHTML = r.results.length ? `<small style="color:var(--muted)">${r.results.length >= 50 ? "50 mais recentes" : r.results.length + (r.results.length === 1 ? " resultado" : " resultados")}</small><div class="steps" style="margin-top:8px">${r.results.map(x => msgCard(x)).join("")}</div>` : `<div class="empty">${ic("fileSearch")}<p>Nada encontrado.</p></div>`;
      };
      m.querySelector("[data-sgo]").onclick = run;
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); run(); } });
      out.addEventListener("click", e => { const go = e.target.closest("[data-go]"); if (go) { close(); goToMsg(go.dataset.go); } });
      setTimeout(() => inp.focus(), 50);
    }
  });
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
    canPinHere() && { label: pinnedHere(id) ? "Desafixar mensagem" : "Fixar mensagem", icon: "pin", run: () => pinMsg(id, !pinnedHere(id)) },
    (mine || canDo(s, "messages")) && "-",
    (mine || canDo(s, "messages")) && { label: "Apagar mensagem", icon: "trash", danger: true, run: e => deleteMsg(id, e && e.shiftKey) }
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
    s && !mine && s.members.includes(uid) && canDo(s, "roles") && uid !== s.ownerId && myTopPos(s, uid) < myTopPos(s) && { label: "Cargos…", icon: "shield", run: () => memberRolesMenu(s.id, uid, at) },
    s && !mine && s.members.includes(uid) && canDo(s, "ban") && uid !== s.ownerId && myTopPos(s, uid) < myTopPos(s) && { label: `Banir ${u.username}`, icon: "x", danger: true, run: () => banModal(s.id, u) },
    canDo(s, "kick") && !mine && uid !== (s && s.ownerId) && s.members.includes(uid) && myTopPos(s, uid) < myTopPos(s) && "-",
    canDo(s, "kick") && !mine && uid !== (s && s.ownerId) && s.members.includes(uid) && myTopPos(s, uid) < myTopPos(s) && { label: `Expulsar ${u.username}`, icon: "logout", danger: true, run: async () => { if (await confirmBox({ title: "Expulsar membro", html: `Expulsar <b>${esc(u.username)}</b> de ${esc(s.name)}?`, ok: "Expulsar" })) { const r = await emit("server:kick", { serverId: s.id, userId: uid }); if (r.error) toast(r.error, "error"); } } }
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
  premium: () => goPremium(),
  admin: () => goAdmin(),
  "buy-plan": a => buyModal(a.dataset.tier, a.dataset.cycle || S.cycle || "m"),
  "plan-cycle": a => { S.cycle = a.dataset.c; renderPremium(); },
  "open-ticket": a => openTicket(a.dataset.id),
  "admin-tab": a => { S.adminTab = a.dataset.tab; renderAdmin(true); },
  "audit-a": a => { S.auditA = a.dataset.a; renderAdmin(true); },
  "admin-mod-set": async a => {
    const name = a.dataset.name;
    if (!(await confirmBox({ title: "Tirar MOD", html: `<b>${esc(name)}</b> deixa de ser Moderador na hora.`, ok: "Tirar MOD", danger: true }))) return;
    const r = await emit("admin:mod:set", { userId: a.dataset.uid, on: false });
    if (r.error) toast(r.error, "error"); else { toast(`${name} não é mais Moderador.`, "ok"); renderAdmin(true); }
  },
  "admin-adm-set": async a => {
    const give = a.dataset.on === "1", name = a.dataset.name;
    if (!(await confirmBox({ title: give ? "Tornar ADM" : "Tirar ADM", html: give ? `<b>${esc(name)}</b> vai poder aprovar pagamentos, dar planos, suspender contas e bloquear servidores. Só você (ADM Supremo) mexe no Sistema e na equipe.` : `<b>${esc(name)}</b> deixa de ser ADM na hora.`, ok: give ? "Tornar ADM" : "Tirar ADM", danger: !give }))) return;
    const r = await emit("admin:admin:set", { userId: a.dataset.uid, on: give });
    if (r.error) toast(r.error, "error"); else { toast(give ? `${name} agora é ADM. 🛡️` : `${name} não é mais ADM.`, "ok"); renderAdmin(true); }
  },
  "sys-save": async a => {
    const root = $("#adminView"), part = a.dataset.part, data = {};
    if (part === "access") { data.regOpen = root.querySelector('[data-sys="regOpen"]').checked; data.maintenance = root.querySelector('[data-sys="maintenance"]').value.trim(); }
    if (part === "pay") { data.pixKey = root.querySelector('[data-sys="pixKey"]').value.trim(); data.links = Object.fromEntries($$("[data-link]", root).map(i => [i.dataset.link, i.value.trim()])); }
    if (part === "min") data.minApp = { android: root.querySelector('[data-min="android"]').value.trim(), desktop: root.querySelector('[data-min="desktop"]').value.trim(), graceMin: +root.querySelector('[data-min="grace"]').value || 0 };
    if (part === "min-off") data.minApp = null;
    if (data.maintenance && !(await confirmBox({ title: "Ligar manutenção", html: "Todo mundo que não é ADM vai ser desconectado agora e só volta quando você desligar.", ok: "Ligar manutenção" }))) return;
    const r = await emit("admin:settings:save", data);
    if (r.error) toast(r.error, "error"); else { toast("Sistema atualizado.", "ok"); renderAdmin(true); }
  },
  "sys-ann-clear": async () => { const r = await emit("admin:announce:clear", {}); if (r.error) toast(r.error, "error"); else { toast("Aviso fixado removido.", "ok"); renderAdmin(true); } },
  "sys-logout-all": () => {
    modal({
      title: "🔐 Desconectar todo mundo", sub: "Todas as contas, em todos os aparelhos (menos este)",
      body: `<p style="color:var(--text-2)">Todo mundo vai precisar entrar de novo com usuário e senha. Chamadas em andamento caem. Use depois de uma atualização importante ou se suspeitar de invasão.</p><label class="field"><span>Para confirmar, digite DESCONECTAR TODOS</span><input data-c autocomplete="off"></label><div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" data-go>Desconectar todos</button></div>`,
      onMount(m, close) {
        m.querySelector("[data-go]").onclick = async () => {
          const r = await emit("admin:logout:all", { confirm: m.querySelector("[data-c]").value });
          if (r.error) { toast(r.error, "error"); return; }
          close(); toast(`${r.ended} sessões encerradas. Todo mundo vai precisar entrar de novo.`, "ok", 6000);
        };
      }
    });
  },
  "admin-user": a => adminUserCard(a.dataset.uid),
  "admin-filter": a => { S.adminFilter = a.dataset.f; renderAdmin(true); },
  games: () => goGames(),
  ai: () => goAI(),
  "ai-clear": () => clearAI(),
  "games-cat": a => { S.gameCat = a.dataset.cat || ""; if (S.view !== "games") goGames(); else { renderGamesView(); renderSide(); } },
  "game-play": a => playGame(a.dataset.id),
  "game-tab": a => openGameTab(gameById(a.dataset.id) || GP.game),
  "game-resume": () => showGame(),
  "game-min": () => minimizeGame(),
  "game-close": () => askCloseGame(),
  "game-full": () => gameFullscreen(),
  "game-reload": () => { const f = GP.el && GP.el.querySelector("iframe"); if (f) { GP.el.classList.remove("ready"); GP.loaded = false; f.src = GP.game.url; } },
  "admin-game-edit": a => adminGameEdit(a.dataset.id),
  "admin-srv-f": a => { S.adminSrvF = a.dataset.f; renderAdmin(true); },
  "admin-srv-block": a => adminSrvBlock(a.dataset.id, a.dataset.name),
  "admin-srv-unblock": a => admRun("admin:server:unblock", { serverId: a.dataset.id }, "Servidor desbloqueado e de volta para os membros."),
  "admin-srv-del": a => adminSrvDelete(a.dataset.id, a.dataset.name),
  "admin-pass": a => adminSetPass(a.dataset.uid, a.dataset.name),
  "admin-backup-now": async a => { a.disabled = true; const r = await emit("admin:backup:now", {}); if (r.error) { toast(r.error, "error"); a.disabled = false; return; } toast(`Backup feito (${fmtSize(r.backup.size)}).`, "ok"); renderAdmin(true); },
  "admin-backup-dl": async a => {
    a.disabled = true;
    try {
      const res = await fetch("/api/admin/backup/" + encodeURIComponent(a.dataset.id), { headers: { authorization: "Bearer " + S.token } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Não deu para baixar.");
      const url = URL.createObjectURL(await res.blob()), link = document.createElement("a");
      link.href = url; link.download = a.dataset.id + (a.dataset.enc === "1" ? ".axb" : ".json.gz"); document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast(e.message, "error"); }
    a.disabled = false;
  },
  "admin-ban": a => adminBan(a.dataset.uid, a.dataset.name),
  "admin-unban": a => admRun("admin:unban", { userId: a.dataset.uid }, `Conta de ${a.dataset.name} reativada.`),
  "admin-broadcast": () => adminBroadcast(),
  "admin-game-del": a => adminGameDel(a.dataset.id),
  "receipt-view": a => { const lb = document.createElement("div"); lb.className = "lightbox"; lb.innerHTML = `<img src="${esc(a.dataset.src)}" alt="Comprovante">`; lb.onclick = () => lb.remove(); document.body.append(lb); },
  "order-review": async a => { const r = await emit("order:review", { id: a.dataset.id }); if (r.error) toast(r.error, "error"); },
  "order-approve": a => adminApprove(a.dataset.id),
  "order-reject": a => adminReject(a.dataset.id),
  "admin-grant": a => adminGrant(a.dataset.uid, a.dataset.name),
  "admin-revoke": a => adminRevoke(a.dataset.uid, a.dataset.name),
  attach: () => $("#fileInput").click(),
  "new-group": () => groupModal(),
  "act-menu": a => actMenu(a),
  "sound-menu": a => soundMenu(a),
  "react-menu": a => reactMenu(a),
  "call-chat": toggleCallChat,
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
  "ctrl-lock": () => toggleMouseLock(),
  "pad-preset": a => {
    const c = V.controlling;
    if (!c) return;
    // PC de quem transmite com controle virtual: o controle vai inteiro (analógicos e gatilhos); o teclado pode virar controle também
    if (c.pad) return menu(a, [
      { label: "Controle → controle de Xbox (outro jogador)", icon: "check", run: () => toast("Seu controle aparece no PC de quem transmite como um controle de Xbox. No jogo, aperte Start para entrar como outro jogador.", "info", 6000) },
      { label: c.kbPad ? "Teclado como controle: ligado" : "Teclado como controle: desligado", icon: c.kbPad ? "check" : null, run: () => {
        releaseKeys();
        c.kbPad = !c.kbPad; store.set("kbPad", c.kbPad);
        if (!c.kbPad && c.padSent.has(KB_PAD)) { dcSend(`px ${KB_PAD}`); c.padSent.delete(KB_PAD); }
        toast(c.kbPad ? "Agora o teclado vira um controle de Xbox (outro jogador). Clique na transmissão para jogar." : "O teclado voltou a ser teclado.", "ok");
        renderCtrlBar();
      } },
      { label: "Ver teclas do teclado-controle", icon: "info", run: kbPadHelp }
    ]);
    menu(a, Object.entries(PAD_PRESETS).map(([k, p]) => ({ label: p.name, icon: c.preset === k ? "check" : null, run: () => { c.preset = k; store.set("padPreset", k); renderCtrlBar(); } })));
  },
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
  "new-channel": (a, e) => { e && e.stopPropagation(); channelModal(a.dataset.type, S.serverId, a.dataset.cat || ""); },
  "cat-fold": a => { const f = store.get("catFold", {}); if (f[a.dataset.key]) delete f[a.dataset.key]; else f[a.dataset.key] = 1; store.set("catFold", f); renderSide(); },
  "join-voice": a => joinVoice(a.dataset.id),
  "dm-call": a => openDMCall(a.dataset.id, true),
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
  // resposta a uma mensagem antiga: carrega o histórico até chegar nela
  "jump-to": a => goToMsg(a.dataset.ref),
  pins: () => pinsModal(),
  "msg-search": () => searchModal(),
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

/* ------------------------------------------------------------------ */
/* Navegação no celular (Android): botão voltar e gestos               */
/* O app Android só sabe "voltar no histórico" — antes, sem histórico, */
/* o voltar fechava o app mesmo com um menu ou janela aberta.          */
/* Agora cada tela "fechável" ganha uma entrada no histórico:          */
/*   janela/menu aberto → voltar fecha · no chat → voltar abre o menu  */
/*   de canais · com o menu de canais aberto → voltar sai do app.      */
/* ------------------------------------------------------------------ */
const BACK = { armed: false, silent: false };
const isPhone = () => innerWidth <= 760;
const overlayOpen = () => !!($("#layer").children.length || document.querySelector("body > .menu, body > .popover, .lightbox") || $("#app").classList.contains("show-members"));
function syncBack() {
  if (!S.ready && !$("#layer").children.length) return;
  const app = $("#app");
  const want = isPhone() && !app.classList.contains("hidden") && (overlayOpen() || !app.classList.contains("drawer"));
  if (want && !BACK.armed) { try { history.pushState({ ax: Date.now() }, ""); BACK.armed = true; } catch {} }
  else if (!want && BACK.armed) { BACK.armed = false; BACK.silent = true; history.back(); }
}
function onBack() {
  const app = $("#app");
  if (closeTop()) return;
  if (document.querySelector("body > .menu, body > .popover")) { closeMenus(); return; }
  if (app.classList.contains("show-members")) { app.classList.remove("show-members"); return; }
  if (!app.classList.contains("drawer")) { app.classList.add("drawer"); return; }
}
function setupMobileNav() {
  window.addEventListener("popstate", () => {
    BACK.armed = false;
    if (BACK.silent) { BACK.silent = false; return; }
    if (isPhone()) onBack();
    setTimeout(syncBack, 30);
  });
  const later = debounce(syncBack, 60);
  new MutationObserver(later).observe($("#app"), { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(later).observe($("#layer"), { childList: true });
  new MutationObserver(later).observe(document.body, { childList: true });
  window.addEventListener("resize", later, { passive: true });
  // gesto: arrastar da borda esquerda abre o menu; arrastar para a esquerda fecha
  let t0 = null;
  document.addEventListener("touchstart", e => {
    if (!isPhone() || e.touches.length !== 1 || $("#layer").children.length) { t0 = null; return; }
    const p = e.touches[0], open = $("#app").classList.contains("drawer");
    t0 = (open || p.clientX < 28) && !e.target.closest("input, textarea, .stage-grid, .board, canvas, iframe, .ttt") ? { x: p.clientX, y: p.clientY, open, at: Date.now() } : null;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!t0) return;
    const p = e.changedTouches[0], dx = p.clientX - t0.x, dy = Math.abs(p.clientY - t0.y), app = $("#app");
    if (Date.now() - t0.at < 600 && dy < 60) {
      if (!t0.open && dx > 60) app.classList.add("drawer");
      else if (t0.open && dx < -60) app.classList.remove("drawer");
    }
    t0 = null;
  }, { passive: true });
}
function wire() {
  wireControlInput();
  document.addEventListener("submit", e => {
    const ss = e.target.closest("[data-ssearch]");
    if (ss) { e.preventDefault(); S.adminSrvQ = ss.querySelector("input").value.trim(); renderAdmin(true); return; }
    const ma = e.target.closest("[data-modadd]");
    if (ma) { e.preventDefault(); const n = ma.querySelector("input").value.trim(); if (!n) return; emit("admin:mod:set", { name: n, on: true }).then(r => { if (r.error) toast(r.error, "error"); else { toast(n + " agora é Moderador. 🛡️", "ok"); renderAdmin(true); } }); return; }
    const as = e.target.closest("[data-asearch]");
    if (as) { e.preventDefault(); S.auditQ = as.querySelector("input").value.trim(); renderAdmin(true); return; }
    const f = e.target.closest("[data-usearch]");
    if (!f) return;
    e.preventDefault();
    S.adminQ = f.querySelector("input").value.trim();
    renderAdmin(true);
  });
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
  setupMobileNav();
  document.addEventListener("mouseover", e => {
    // no celular o toque dispara "mouseover": a dica ficava presa na tela e o primeiro toque parecia não funcionar
    if (!matchMedia("(hover: hover)").matches) return;
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
  document.addEventListener("visibilitychange", () => {
    if (S.socket) {
      S.socket.emit("vis", { hidden: document.hidden });            // o servidor só manda push se você não estiver olhando
      if (!document.hidden && !S.socket.connected && !LOCAL) S.socket.connect();   // voltou ao app: reconecta na hora
    }
    if (!document.hidden) maybeRead();
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
    if (e.data && e.data.type === "open") openFromUrl(e.data.url);
    if (e.data && e.data.type === "update") showUpdateBar();
  });
  window.__axOpen = url => openFromUrl(url);   // usado pelo app Android ao tocar numa notificação
  // fechou a aba/janela de verdade: sai da sala na hora (queda de conexão é diferente: o lugar fica guardado)
  window.addEventListener("pagehide", e => { if (!e.persisted && V.channelId && S.socket && S.socket.connected) S.socket.emit("voice:leave", {}); });

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
let authMode = "login", authEmail = "";
const AUTH_MODES = {
  login: { f: ["user", "pass"], btn: "Entrar", sub: "Que bom te ver de novo!", links: ["forgot"] },
  register: { f: ["user", "email", "pass"], btn: "Criar conta", sub: "Crie sua conta em segundos.", links: [], hint: "Senha com 8+ caracteres, usando letras e números." },
  verify: { f: ["code"], btn: "Confirmar e-mail", sub: "Confirme seu e-mail", links: ["resend", "back"] },
  forgot: { f: ["email"], btn: "Enviar código", sub: "Recuperar a senha", links: ["back"], hint: "Vamos mandar um código para o e-mail da sua conta." },
  reset: { f: ["email", "code", "newpass"], btn: "Salvar nova senha", sub: "Criar uma nova senha", links: ["resend-reset", "back"] }
};
function setAuthMode(m, hint) {
  authMode = m;
  const md = AUTH_MODES[m];
  const tabs = m === "login" || m === "register";
  $(".seg").classList.toggle("hidden", !tabs);
  $$(".seg button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  $(".seg").classList.toggle("right", m === "register");
  const fields = LOCAL ? md.f.filter(f => f !== "email") : md.f;
  $$("#authForm [data-f]").forEach(el => el.classList.toggle("hidden", !fields.includes(el.dataset.f)));
  $("#userLabel").textContent = m === "register" ? "Nome de usuário" : LOCAL ? "Usuário" : "Usuário ou e-mail";
  $("#authSubmit span").textContent = md.btn;
  $("#authSub").textContent = md.sub;
  $("#password").autocomplete = m === "login" ? "current-password" : "new-password";
  $("#authHint").textContent = hint || md.hint || "";
  $$(".auth-links [data-auth]").forEach(a => {
    const k = a.dataset.auth;
    a.classList.toggle("hidden", LOCAL || !(md.links.includes(k) || (k === "resend" && md.links.includes("resend-reset"))));
  });
  $("#authError").textContent = "";
  if (m === "reset" || m === "forgot") $("#email").value = authEmail || $("#email").value;
  setTimeout(() => { const first = $(`#authForm [data-f="${fields[0]}"] input`); if (first) first.focus(); }, 30);
}
async function authApi(path, body, withToken) {
  const headers = { "content-type": "application/json" };
  if (withToken && S.token) headers.authorization = "Bearer " + S.token;
  let r;
  try { r = await fetch("/api/" + path, { method: "POST", headers, body: JSON.stringify(body || {}) }); }
  catch { throw new Error("Não foi possível falar com o servidor."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Algo deu errado. Tente de novo.");
  return j;
}
async function authLink(k) {
  const err = $("#authError");
  err.textContent = "";
  try {
    if (k === "forgot") { authEmail = ($("#username").value.includes("@") && $("#username").value.trim()) || ""; setAuthMode("forgot"); }
    else if (k === "back") { if (authMode === "verify") { store.del("token"); S.token = null; } setAuthMode("login"); }
    else if (k === "resend") {
      if (authMode === "reset") { await authApi("account/forgot", { email: $("#email").value.trim() }); toast("Se o e-mail tiver conta, enviamos um novo código.", "ok"); }
      else { const j = await authApi("account/resend", {}, true); toast(`Novo código enviado para ${j.email}.`, "ok"); }
    }
  } catch (x) { err.textContent = x.message; }
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
  const email = $("#email").value.trim(), code = $("#code").value.replace(/\D/g, ""), np = $("#newPassword").value;
  err.textContent = "";
  const startApp = token => { S.token = token; store.set("token", token); $("#password").value = ""; $("#newPassword").value = ""; $("#code").value = ""; connect(); };
  if ((authMode === "login" || authMode === "register") && u.length < 3) { err.textContent = "Digite seu usuário."; return; }
  if ((authMode === "login" || authMode === "register") && p.length < 8) { err.textContent = "A senha precisa de pelo menos 8 caracteres."; return; }
  if (!LOCAL && authMode === "register" && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Digite um e-mail válido."; return; }
  if ((authMode === "verify" || authMode === "reset") && code.length !== 6) { err.textContent = "O código tem 6 números."; return; }
  btn.classList.add("loading");
  try {
    if (LOCAL) { S.token = await localAuth(authMode, u, p); store.set("token", S.token); $("#password").value = ""; connect(); return; }
    if (authMode === "login" || authMode === "register") {
      const j = await authApi(authMode, authMode === "login" ? { username: u, password: p } : { username: u, email, password: p });
      if (j.verify) {
        S.token = j.token; store.set("token", j.token); $("#password").value = "";
        setAuthMode("verify", `Enviamos um código para ${j.email}. Confira também a caixa de spam.`);
        if (j.mailError) err.textContent = j.mailError;
        return;
      }
      startApp(j.token);
    } else if (authMode === "verify") {
      await authApi("account/verify", { code }, true);
      toast("E-mail confirmado! 🎉", "ok");
      startApp(S.token);
    } else if (authMode === "forgot") {
      authEmail = email;
      await authApi("account/forgot", { email });
      setAuthMode("reset", "Se existir uma conta com esse e-mail, o código chegou lá. Confira o spam também.");
    } else if (authMode === "reset") {
      if (np.length < 8 || !/[A-Za-z]/.test(np) || !/\d/.test(np)) { err.textContent = "A nova senha precisa de 8+ caracteres, com letras e números."; return; }
      const j = await authApi("account/reset", { email, code, password: np });
      toast("Senha trocada! Você saiu dos outros aparelhos por segurança.", "ok", 5000);
      startApp(j.token);
    }
  } catch (x) {
    err.textContent = x.message;
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
  $$("[data-logo]").forEach(e => (e.innerHTML = LOGO()));
  $(".boot-logo").innerHTML = LOGO();
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
  if (/[?&](c|abrir|atender)=/.test(location.search)) S.openUrl = location.href;
  if (!LOCAL && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  if (DESKTOP) document.documentElement.classList.add("desktop-app");
  // App de PC antigo (NEXORA): bloqueado — só funciona depois de instalar o Auryx Nexos novo
  if (DESKTOP && /\bNEXORA\/\d/.test(navigator.userAgent)) {
    hideBoot();
    document.body.innerHTML = `<div class="auth" style="position:fixed;inset:0;display:grid;place-items:center;background:#08090f"><div class="auth-card" style="text-align:center"><div class="brand"><span class="logo">${LOGO()}</span><h1>Auryx Nexos</h1></div><p class="auth-sub">Este aplicativo (NEXORA) está desatualizado e foi desativado.</p><p style="color:var(--text-2)">Baixe e instale o app novo para continuar. Suas contas, servidores e mensagens continuam iguais.</p><a class="btn primary big" href="${DESKTOP_URL}" target="_blank" rel="noopener">Baixar Auryx Nexos</a><p style="color:var(--muted);font-size:13px;margin-top:14px">Depois de instalar, pode desinstalar o NEXORA antigo em Configurações do Windows › Aplicativos.</p></div></div>`;
    return;
  }
  $$(".seg button").forEach(b => (b.onclick = () => setAuthMode(b.dataset.mode)));
  $("#authForm").addEventListener("submit", doAuth);
  $("#authForm").addEventListener("click", e => { const a = e.target.closest("[data-auth]"); if (a) { e.preventDefault(); authLink(a.dataset.auth); } });
  setAuthMode("login");
  wire();
  if (S.token) connect(); else showAuth();
}
// Nunca deixar a tela de carregamento presa: se algo falhar ou o servidor demorar, mostra o login.
// Logado e o servidor demorando (ele "dorme" no plano grátis do Render): avisa na tela de abertura e continua tentando.
// Sem login salvo: mostra a tela de entrar. Nunca fica uma tela escura parada.
setTimeout(() => {
  if (S.ready || !$("#auth").classList.contains("hidden")) return;
  if (!S.token || LOCAL) { showAuth(LOCAL ? "" : "O servidor está demorando para responder. Aguarde uns segundos e tente entrar."); return; }
  const b = $("#boot");
  if (b && !b.querySelector(".boot-msg")) b.insertAdjacentHTML("beforeend", `<p class="boot-msg">Acordando o servidor… pode levar até 1 minuto na primeira abertura.</p><button class="btn sm ghost boot-out" type="button">Sair da conta</button>`);
  const out = b && b.querySelector(".boot-out");
  if (out) out.onclick = () => { store.del("token"); location.reload(); };
}, 4000);
try { boot(); } catch (e) { console.error(e); try { showAuth("Erro ao iniciar: " + e.message); } catch {} }
})();
