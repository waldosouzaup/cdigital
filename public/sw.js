/*
 * Service worker do Comitê Campo — Fase 4, item 2.
 *
 * Mínimo e escrito à mão (mesma linha das decisões pdf-lib/exceljs: evitar plugin
 * de build). Faz duas coisas:
 *  1. Torna o app instalável (requisito de PWA junto com o manifest).
 *  2. Serve a casca de /atividades quando não há rede, para o registro em modo
 *     avião continuar abrindo. A fila em si é IndexedDB (fila-offline.ts), não o SW.
 *
 * Nunca faz cache de /api/* nem de respostas não-GET.
 */
const CACHE = "comite-campo-v2";
const CASCA = ["/atividades", "/offline", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CASCA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navegação: tenta a rede; se cair, entrega a casca de /atividades (ou /offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const ativ = await caches.match("/atividades");
        if (ativ) return ativ;
        const off = await caches.match("/offline");
        if (off) return off;
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }),
    );
    return;
  }

  // Assets estáticos: cache primeiro, rede como preenchimento.
  event.respondWith(
    caches.match(req).then((cacheado) => {
      if (cacheado) return cacheado;
      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copia = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copia));
          }
          return res;
        })
        .catch(() => {
          return new Response(null, { status: 404, statusText: "Not Found" });
        });
    }),
  );
});
