/* Auryx Nexavória — service worker
   Guarda só a "casca" do app (HTML, CSS, JS, ícones) para abrir rápido.
   Mensagens, login e voz sempre vão direto para o servidor. */
const CACHE = "auryx-v11";
const SHELL = ["/", "/style.css", "/app.js", "/socket.io/socket.io.min.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const cacheable = p => SHELL.includes(p) || p.startsWith("/icons/") || p.startsWith("/vendor/") || p === "/noise-worklet.js";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* Abertura instantânea: entrega a "casca" guardada na hora (mesmo com o servidor dormindo)
   e busca a versão nova em segundo plano. Se mudou, avisa a página para oferecer "Atualizar". */
let warned = false;
async function warnUpdate() {
  if (warned) return;
  warned = true;
  for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ type: "update" });
}
async function fromCacheThenNetwork(e, req, key) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  const network = fetch(req).then(async res => {
    if (res && res.ok && res.status === 200) {
      const oldTag = cached && cached.headers.get("etag"), newTag = res.headers.get("etag");
      await cache.put(key, res.clone());
      if (oldTag && newTag && oldTag !== newTag && (key === "/" || key === "/app.js" || key === "/style.css")) warnUpdate();
    }
    return res;
  }).catch(() => null);
  if (cached) { e.waitUntil(network); return cached; }
  const res = await network;
  return res || Response.error();
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const p = url.pathname;
  // dados ao vivo, login, arquivos privados e o agente: sempre direto no servidor
  if ((p.startsWith("/socket.io") && p !== "/socket.io/socket.io.min.js") || p.startsWith("/api/") || p.startsWith("/f/") || p === "/health" || p.startsWith("/agente/")) return;
  if (req.mode === "navigate" && /^\/(site|baixar|download|sobre)\/?$/.test(p)) return;   // site de apresentação: sempre do servidor
  if (req.mode === "navigate") { e.respondWith(fromCacheThenNetwork(e, req, "/")); return; }
  if (cacheable(p)) e.respondWith(fromCacheThenNetwork(e, req, p));
});

/* Notificações push: chegam mesmo com o app fechado */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Auryx Nexavória", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Auryx Nexavória", {
    body: d.body || "", icon: d.icon || "/icons/icon-192.png", badge: "/icons/icon-192.png",
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "/" }, vibrate: [80, 40, 80]
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        w.postMessage({ type: "open", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
