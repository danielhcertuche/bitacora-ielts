/* Modo sin conexión: la app y los archivos cifrados se sirven desde caché y se refrescan
 * en segundo plano (stale-while-revalidate). Las llamadas a Google nunca se cachean.
 * Subir VERSION cuando cambie la lista de archivos.
 */
var VERSION = "bitacora-v3";
var ARCHIVOS = ["./", "index.html", "estilos.css", "config.js", "cripto.js", "metricas.js", "voz.js", "drive.js",
  "contenido.js", "app.js", "manifest.webmanifest", "icono.svg", "icono-192.png", "icono-512.png",
  "privado/sal.json", "privado/perfil.json.enc", "privado/tarjetas.html.enc", "privado/discurso.html.enc",
  "privado/build_a_sentence.html.enc", "privado/test_2_datecol.html.enc"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  var propio = u.origin === self.location.origin, fuentes = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!propio && !fuentes) return;
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(e.request, {ignoreSearch: true}).then(function (hit) {
      var red = fetch(e.request).then(function (r) { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(function () { return hit; });
      return hit || red;
    });
  }));
});
