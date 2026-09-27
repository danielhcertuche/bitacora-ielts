/* Google Drive como almacenamiento, sin servidor.
 *
 * Autorización con Google Identity Services (flujo de token en el navegador) y el permiso
 * `drive.file`: la app sólo ve los archivos y carpetas que ella misma creó en tu Drive,
 * nada más. El CLIENT_ID de OAuth no es secreto; se configura en config.js.
 *
 * Estructura en Drive:
 *   Bitácora IELTS/
 *     bitacora.json        estado completo (se fusiona, nunca se pisa a ciegas)
 *     grabaciones/         audios de Speaking
 *     notas_voz/           notas dictadas sin conexión
 */
(function (raiz) {
  var API = "https://www.googleapis.com/drive/v3", UP = "https://www.googleapis.com/upload/drive/v3";
  var SCOPE = "https://www.googleapis.com/auth/drive.file";
  var RAIZ = "Bitácora IELTS";
  var token = null, caduca = 0, cliente = null, espera = null;

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function configurado() { return !!(raiz.CONFIG && raiz.CONFIG.GOOGLE_CLIENT_ID); }

  function cargarGIS() {
    if (raiz.google && raiz.google.accounts) return Promise.resolve();
    return new Promise(function (ok, mal) {
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = ok; s.onerror = function () { mal(new Error("sin conexión con Google")); };
      document.head.appendChild(s);
    });
  }
  /* interactivo=true sólo desde un clic: el navegador bloquea la ventana si no. */
  function autorizar(interactivo) {
    if (token && Date.now() < caduca - 60000) return Promise.resolve(token);
    if (!configurado()) return Promise.reject(new Error("falta GOOGLE_CLIENT_ID en config.js"));
    if (espera) return espera;
    espera = cargarGIS().then(function () {
      return new Promise(function (ok, mal) {
        cliente = raiz.google.accounts.oauth2.initTokenClient({
          client_id: raiz.CONFIG.GOOGLE_CLIENT_ID, scope: SCOPE,
          callback: function (r) {
            if (r.error) { mal(new Error(r.error)); return; }
            token = r.access_token; caduca = Date.now() + (+r.expires_in || 3600) * 1000;
            ls("drive_consentido", "1"); ok(token);
          },
          error_callback: function (e) { mal(new Error(e && e.type || "autorización cancelada")); }
        });
        if (!interactivo && ls("drive_consentido") !== "1") { mal(new Error("necesita_clic")); return; }
        cliente.requestAccessToken({prompt: ls("drive_consentido") === "1" ? "" : "consent"});
      });
    });
    return espera.finally(function () { espera = null; });
  }

  async function llamar(url, opt) {
    var t = await autorizar(false);
    opt = opt || {}; opt.headers = Object.assign({Authorization: "Bearer " + t}, opt.headers || {});
    var r = await fetch(url, opt);
    if (r.status === 401) { token = null; t = await autorizar(false); opt.headers.Authorization = "Bearer " + t; r = await fetch(url, opt); }
    if (!r.ok) throw new Error("Drive " + r.status + ": " + (await r.text()).slice(0, 160));
    return r;
  }
  function q(s) { return encodeURIComponent(s); }

  async function carpeta(nombre, padre) {
    var k = "drive_dir_" + (padre || "root") + "_" + nombre, id = ls(k);
    if (id) return id;
    var cond = "name='" + nombre.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false" +
      (padre ? " and '" + padre + "' in parents" : "");
    var r = await (await llamar(API + "/files?fields=files(id)&q=" + q(cond))).json();
    if (r.files && r.files.length) id = r.files[0].id;
    else {
      var cuerpo = {name: nombre, mimeType: "application/vnd.google-apps.folder"};
      if (padre) cuerpo.parents = [padre];
      id = (await (await llamar(API + "/files?fields=id", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(cuerpo)})).json()).id;
    }
    ls(k, id); return id;
  }
  async function buscar(nombre, padre) {
    var cond = "name='" + nombre + "' and '" + padre + "' in parents and trashed=false";
    var r = await (await llamar(API + "/files?fields=files(id,modifiedTime)&q=" + q(cond))).json();
    return r.files && r.files[0] || null;
  }
  async function subir(nombre, padre, blob, tipo, idExistente) {
    var meta = idExistente ? {} : {name: nombre, parents: [padre]};
    var limite = "b" + Math.random().toString(36).slice(2);
    var cuerpo = new Blob(["--" + limite + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) +
      "\r\n--" + limite + "\r\nContent-Type: " + tipo + "\r\n\r\n", blob, "\r\n--" + limite + "--"]);
    var url = idExistente ? UP + "/files/" + idExistente + "?uploadType=multipart&fields=id" : UP + "/files?uploadType=multipart&fields=id";
    return (await (await llamar(url, {method: idExistente ? "PATCH" : "POST", headers: {"Content-Type": "multipart/related; boundary=" + limite}, body: cuerpo})).json()).id;
  }

  raiz.DRIVE = {
    configurado: configurado,
    conectar: function () { return autorizar(true); },
    conectado: function () { return !!token && Date.now() < caduca; },
    consentidoAntes: function () { return ls("drive_consentido") === "1"; },
    /* Lee bitacora.json (o null si aún no existe). */
    leerEstado: async function () {
      var dir = await carpeta(RAIZ), f = await buscar("bitacora.json", dir);
      if (!f) return null;
      return (await llamar(API + "/files/" + f.id + "?alt=media")).json();
    },
    escribirEstado: async function (obj) {
      var dir = await carpeta(RAIZ), f = await buscar("bitacora.json", dir);
      await subir("bitacora.json", dir, new Blob([JSON.stringify(obj)], {type: "application/json"}), "application/json", f && f.id);
    },
    subirAudio: async function (subcarpeta, nombre, blob) {
      var dir = await carpeta(subcarpeta, await carpeta(RAIZ));
      return subir(nombre, dir, blob, blob.type || "audio/webm");
    }
  };
})(window);
