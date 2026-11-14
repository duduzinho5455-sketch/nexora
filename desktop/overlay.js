"use strict";
// Sobreposição de jogo: mostra quem está na call e acende quem está falando.
const root = document.getElementById("root");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MAX = 10;
const svg = d => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block">${d}</svg>`;
const MIC_OFF = svg('<path d="M2 2l20 20M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7"/><path d="M17 16.9A7 7 0 0 1 5 12v-2m14 0v2c0 .8-.1 1.5-.4 2.2M12 19v3"/>');
const HEAD_OFF = svg('<path d="M2 2l20 20"/><path d="M3 18v-6a9 9 0 0 1 14.5-7.1M21 12v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>');
function avatar(p) {
  const img = /^(https:|data:image\/)/.test(p.av || "") ? `<img src="${esc(p.av)}" alt="">` : "";
  const txt = img ? "" : esc(p.av && !/^(https?:|data:|\/)/.test(p.av) ? p.av : ([...(p.name || "?")][0] || "?").toUpperCase());
  return `<span class="av" style="--c:${esc(/^#[0-9a-f]{3,8}$/i.test(p.color || "") ? p.color : "#555")}">${img}${txt}</span>`;
}
window.auryxOverlay.onState(st => {
  if (!st || !st.on) { root.innerHTML = ""; return; }
  root.className = /r$/.test(st.pos || "") ? "right" : "";
  const people = (st.people || []).slice().sort((a, b) => (b.speaking - a.speaking));
  const shown = people.slice(0, MAX);
  root.innerHTML = `<div class="head"><i></i><span>${esc(st.title || "Call")}</span></div>` +
    shown.map(p => `<div class="p${p.speaking ? " speaking" : ""}">${avatar(p)}<span class="nm">${esc(p.name)}</span>${p.live ? `<span class="live">AO VIVO</span>` : ""}${p.deaf ? `<span class="ic">${HEAD_OFF}</span>` : p.muted ? `<span class="ic">${MIC_OFF}</span>` : ""}</div>`).join("") +
    (people.length > MAX ? `<div class="more">+${people.length - MAX} na call</div>` : "");
  const h = Math.ceil(root.getBoundingClientRect().height) + 4;
  window.auryxOverlay.size(h);
});
