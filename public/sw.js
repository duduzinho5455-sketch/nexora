/* NEXORA — service worker
   Guarda só a "casca" do app (HTML, CSS, JS, ícones) para abrir rápido.
   Mensagens, login e voz sempre vão direto para o servidor. */
const CACHE = "nexora-v3";
const SHELL = ["/", "/style.css", "/app.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/socket.io") || url.pathname.startsWith("/api/") || url.pathname === "/health" || url.pathname.startsWith("/agente/")) return;
  // Rede primeiro (sempre a versão mais nova); cache só se estiver sem internet.
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && (SHELL.includes(url.pathname) || url.pathname.startsWith("/icons/"))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
