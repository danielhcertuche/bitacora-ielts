/* Cifrado de los archivos privados.
 * AES-GCM 256 con clave derivada por PBKDF2-SHA256 de una frase de paso.
 * La sal es común a todos los archivos (privado/sal.json) para derivar la clave una sola vez;
 * cada archivo lleva su propio IV. El mismo código corre en el navegador y en Node 22,
 * que es con lo que se generan los .enc.
 */
(function (raiz) {
  var ITER = 310000;
  var sub = raiz.crypto.subtle;

  function b64(buf) {
    var s = "", a = new Uint8Array(buf);
    for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return raiz.btoa ? raiz.btoa(s) : Buffer.from(s, "binary").toString("base64");
  }
  function deB64(t) {
    var s = raiz.atob ? raiz.atob(t) : Buffer.from(t, "base64").toString("binary");
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }

  async function derivar(frase, salB64) {
    var base = await sub.importKey("raw", new TextEncoder().encode(frase), "PBKDF2", false, ["deriveKey"]);
    return sub.deriveKey({name: "PBKDF2", hash: "SHA-256", salt: deB64(salB64), iterations: ITER},
      base, {name: "AES-GCM", length: 256}, true, ["encrypt", "decrypt"]);
  }
  async function cifrar(clave, texto) {
    var iv = raiz.crypto.getRandomValues(new Uint8Array(12));
    var ct = await sub.encrypt({name: "AES-GCM", iv: iv}, clave, new TextEncoder().encode(texto));
    return {v: 1, iv: b64(iv), ct: b64(ct)};
  }
  async function descifrar(clave, sobre) {
    var pt = await sub.decrypt({name: "AES-GCM", iv: deB64(sobre.iv)}, clave, deB64(sobre.ct));
    return new TextDecoder().decode(pt);
  }
  /* La clave se guarda exportada en el dispositivo para no pedir la frase cada vez. */
  async function exportar(clave) { return b64(await sub.exportKey("raw", clave)); }
  async function importar(b) { return sub.importKey("raw", deB64(b), "AES-GCM", false, ["decrypt"]); }

  raiz.CRIPTO = {derivar: derivar, cifrar: cifrar, descifrar: descifrar, exportar: exportar, importar: importar,
    nuevaSal: function () { return b64(raiz.crypto.getRandomValues(new Uint8Array(16))); }, ITER: ITER};
})(typeof window !== "undefined" ? window : globalThis);
