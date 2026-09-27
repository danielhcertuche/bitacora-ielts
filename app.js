/* Bitácora IELTS — lógica de la app.
 *
 * El estado vive primero en este dispositivo (localStorage + IndexedDB para audios) y se
 * sincroniza con tu Google Drive cuando hay conexión. La sincronización fusiona: une las
 * entradas de los dos lados y respeta los borrados, así que móvil y portátil no se pisan.
 */

/* ════════════════════════════════════════════════════════════════════
   1 · METAS (la evidencia personal llega descifrada desde privado/perfil.json.enc)
   ════════════════════════════════════════════════════════════════════ */
var GAPS = [
  {id:"writing_t1", prio:1, t:"Writing Task 1: describir gráficos", meta:"6 gráficos de 150 palabras o más",
   cuenta:function(S,T){ return [T.filter(function(x){ return x.tipo==="t1" && x.m && x.m.pal>=150; }).length, 6]; }},
  {id:"writing_t2", prio:1, t:"Ensayo de 250 palabras con contraste, consecuencia y cierre", meta:"8 ensayos completos",
   cuenta:function(S,T){ return [T.filter(function(x){ return x.tipo==="t2" && x.m && x.m.pal>=250 && x.m.contraste>0 && x.m.consecuencia>0 && x.m.cierre>0; }).length, 8]; }},
  {id:"speaking", prio:1, t:"Part 2 cerrado y sin cambiar de idioma", meta:"10 cue cards con cierre, reparación y 0 español",
   cuenta:function(S){ return [S.filter(function(x){ return x.act==="s_p2" && x.det && x.det.cierre && x.det.reparacion && x.det.espanol===0; }).length, 10]; }},
  {id:"listening", prio:2, t:"Listening en formato IELTS", meta:"3 tests oficiales puntuados",
   cuenta:function(S){ return [S.filter(function(x){ return x.act==="l_full" && x.total; }).length, 3]; }},
  {id:"reading_full", prio:2, t:"Reading completo: 3 pasajes en 60′", meta:"2 simulacros de 40 preguntas",
   cuenta:function(S){ return [S.filter(function(x){ return x.act==="r_full" && x.total; }).length, 2]; }},
  {id:"pronunciacion", prio:2, t:"Pronunciación con shadowing", meta:"6 sesiones de shadowing en 14 días",
   cuenta:function(S){ return [S.filter(function(x){ return x.act==="shadow" && diasDesde(x.fecha) < 14; }).length, 6]; }},
  {id:"gramatica", prio:3, t:"Concordancia al producir", meta:"Build a Sentence ≥ 85 % dos veces",
   cuenta:function(S){ var ok = S.filter(function(x){ return x.act==="build" && x.total && x.score/x.total >= .85; }).length; return [Math.min(ok,2), 2]; }},
  {id:"inventario", prio:3, t:"Expresiones de cierre, reparación y hedging", meta:"Tarjetas 10 de los últimos 14 días",
   cuenta:function(S){ return [S.filter(function(x){ return x.act==="tarjetas" && diasDesde(x.fecha) < 14; }).length, 10]; }},
  {id:"produccion", prio:3, t:"Producir algo propio casi a diario", meta:"5 textos en los últimos 7 días",
   cuenta:function(S,T){ return [T.filter(function(x){ return diasDesde(x.fecha) < 7; }).length, 5]; }}
];
var GAP_ACT = {writing_t1:"w_t1", writing_t2:"w_t2", speaking:"s_p2", listening:"l_full", reading_full:"r_full",
  pronunciacion:"shadow", gramatica:"build", inventario:"tarjetas", produccion:"lect"};

/* ════════════════════════════════════════════════════════════════════
   2 · UTILIDADES
   ════════════════════════════════════════════════════════════════════ */
function $(s, r){ return (r || document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function isoDe(d){ return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2); }
function hoy(){ return isoDe(new Date()); }
function diasEntre(a, b){ return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
function diasDesde(f){ return diasEntre(f, hoy()); }
var MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
var DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
function fCorta(f){ var p = f.split("-"); return +p[2] + " " + MESES[+p[1]-1]; }
function lsGet(k, def){ try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch(e){ return def; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function toast(msg){ var t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function(){ t.hidden = true; }, 2800); }
function bandaDe(score, total, skill){
  if (!total) return null;
  var s = Math.round(score * 40 / total);
  var R = [[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3]];
  var L = [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[8,3.5],[6,3]];
  var tab = skill === "listening" ? L : R;
  for (var i = 0; i < tab.length; i++) if (s >= tab[i][0]) return tab[i][1];
  return 2.5;
}

/* ════════════════════════════════════════════════════════════════════
   3 · ESTADO LOCAL Y FUSIÓN
   ════════════════════════════════════════════════════════════════════ */
var KEY = "bitacora_ielts_v1";
var CFG0 = {fecha:"", cierre:"", banda:6.5, meta:420, upd:0};
var ST = lsGet(KEY, null) || {v:1, s:{}, t:{}, cfg:Object.assign({}, CFG0), del:{}};
var S = [], T = [], CFG = ST.cfg, PERFIL = null;

function reconstruir(){
  S = Object.keys(ST.s).map(function(k){ return ST.s[k]; }).sort(function(a,b){ return b.ts - a.ts; });
  T = Object.keys(ST.t).map(function(k){ return ST.t[k]; }).sort(function(a,b){ return b.ts - a.ts; });
  CFG = Object.assign({}, CFG0, ST.cfg);
}
function commit(){ lsSet(KEY, ST); reconstruir(); pintarTodo(); programarSync(); }
function agregar(col, obj){ obj.id = obj.id || uid(); obj.ts = obj.ts || Date.now(); ST[col][obj.id] = obj; commit(); return obj; }
function borrar(col, id){ delete ST[col][id]; ST.del[id] = Date.now(); commit(); }

function fusionar(a, b){
  var del = Object.assign({}, a.del || {}, b.del || {});
  function une(x, y){
    var r = {};
    [x || {}, y || {}].forEach(function(src){ Object.keys(src).forEach(function(k){ if (!r[k] || (src[k].ts || 0) > (r[k].ts || 0)) r[k] = src[k]; }); });
    Object.keys(del).forEach(function(k){ delete r[k]; });
    return r;
  }
  var cfg = (b.cfg && (b.cfg.upd || 0) > ((a.cfg && a.cfg.upd) || 0)) ? b.cfg : a.cfg;
  return {v:1, s:une(a.s, b.s), t:une(a.t, b.t), cfg:Object.assign({}, CFG0, cfg), del:del};
}

function registrar(o){
  var a = ACT[o.act] || ACT.otro;
  var e = {fecha: o.fecha || hoy(), act: a.id, skill: a.skill, min: +o.min || a.min};
  if (o.score != null && o.score !== "" && o.total){ e.score = +o.score; e.total = +o.total; }
  if (o.nota) e.nota = String(o.nota).slice(0, 300);
  if (o.det) e.det = o.det;
  if (o.origen) e.origen = o.origen;
  agregar("s", e);
  toast("Registrado: " + a.t + " · " + e.min + "′");
  return e;
}

/* ════════════════════════════════════════════════════════════════════
   4 · COLA DE AUDIOS (IndexedDB) Y SINCRONIZACIÓN CON DRIVE
   ════════════════════════════════════════════════════════════════════ */
var IDB = (function(){
  var p = null;
  function abrir(){
    if (p) return p;
    p = new Promise(function(ok, mal){
      var r = indexedDB.open("bitacora_ielts", 1);
      r.onupgradeneeded = function(){ r.result.createObjectStore("cola", {keyPath:"id"}); };
      r.onsuccess = function(){ ok(r.result); }; r.onerror = function(){ mal(r.error); };
    });
    return p;
  }
  function tx(modo, fn){ return abrir().then(function(db){ return new Promise(function(ok, mal){
    var t = db.transaction("cola", modo), st = t.objectStore("cola"), res = fn(st);
    t.oncomplete = function(){ ok(res && res.result !== undefined ? res.result : undefined); }; t.onerror = function(){ mal(t.error); };
  }); }); }
  return {
    poner: function(o){ return tx("readwrite", function(st){ st.put(o); }); },
    todos: function(){ return tx("readonly", function(st){ return st.getAll(); }); },
    quitar: function(id){ return tx("readwrite", function(st){ st.delete(id); }); }
  };
})();

function encolarAudio(carpeta, nombre, blob){
  return IDB.poner({id:uid(), carpeta:carpeta, nombre:nombre, blob:blob, ts:Date.now()})
    .then(function(){ pintarCola(); programarSync(); })
    .catch(function(){ toast("No se pudo guardar el audio en este dispositivo."); });
}
async function subirCola(){
  var L = await IDB.todos();
  for (var i = 0; i < L.length; i++){ await DRIVE.subirAudio(L[i].carpeta, L[i].nombre, L[i].blob); await IDB.quitar(L[i].id); }
  pintarCola();
  return L.length;
}

var syncT = null, sincronizando = false, ultimaSync = lsGet("ui_ultima_sync", 0);
function estadoSync(clase, txt){ $("#sync").innerHTML = '<span class="dot ' + clase + '"></span><span>' + esc(txt) + '</span>'; }
function programarSync(){ clearTimeout(syncT); syncT = setTimeout(function(){ sincronizar(false); }, 2500); }
async function sincronizar(interactivo){
  if (!DRIVE.configurado()){ estadoSync("off", "solo en este dispositivo"); return; }
  if (!navigator.onLine){ estadoSync("off", "sin conexión · se sube después"); return; }
  if (!interactivo && !DRIVE.conectado() && !DRIVE.consentidoAntes()){ estadoSync("off", "toca para conectar Drive"); return; }
  if (sincronizando) return;
  sincronizando = true; estadoSync("", "sincronizando…");
  try {
    if (interactivo) await DRIVE.conectar();
    var remoto = await DRIVE.leerEstado();
    if (remoto && remoto.s) { ST = fusionar(ST, remoto); lsSet(KEY, ST); reconstruir(); pintarTodo(); }
    await DRIVE.escribirEstado(ST);
    var n = await subirCola();
    ultimaSync = Date.now(); lsSet("ui_ultima_sync", ultimaSync);
    var h = new Date(); estadoSync("on", "Drive · " + ("0"+h.getHours()).slice(-2) + ":" + ("0"+h.getMinutes()).slice(-2) + (n ? " · " + n + " audio" + (n > 1 ? "s" : "") + " subido" + (n > 1 ? "s" : "") : ""));
    $("#driveMsg").textContent = "Última sincronización: " + h.toLocaleString();
  } catch(e){
    var m = String(e && e.message || e);
    if (/necesita_clic|popup/.test(m)) estadoSync("off", "toca para sincronizar");
    else { estadoSync("off", "Drive no respondió · toca para reintentar"); $("#driveMsg").textContent = m; }
  } finally { sincronizando = false; }
}
$("#sync").addEventListener("click", function(){ sincronizar(true); });
$("#driveBtn").addEventListener("click", function(){ sincronizar(true); });
$("#syncBtn").addEventListener("click", function(){ sincronizar(true); });
window.addEventListener("online", function(){ programarSync(); });

function pintarDrive(){
  $("#driveTxt").innerHTML = DRIVE.configurado()
    ? "La bitácora y tus audios se guardan en tu Drive, en la carpeta <b>Bitácora IELTS</b>. La app sólo puede ver lo que ella misma creó."
    : "Drive no está configurado todavía (falta el identificador de cliente en <span class=\"mono\">config.js</span>). Mientras tanto todo se guarda en este dispositivo.";
  $("#driveBtn").hidden = !DRIVE.configurado() || DRIVE.conectado();
  $("#syncBtn").hidden = !DRIVE.configurado();
}

/* ════════════════════════════════════════════════════════════════════
   5 · CONTENIDO PRIVADO CIFRADO
   ════════════════════════════════════════════════════════════════════ */
var CLAVE = null;
async function cargarPerfil(clave){
  var sobre = await (await fetch("privado/perfil.json.enc", {cache:"no-cache"})).json();
  return JSON.parse(await CRIPTO.descifrar(clave, sobre));
}
async function iniciarPrivado(){
  var b = lsGet("clave_priv", null);
  if (!b) return pintarClave();
  try { CLAVE = await CRIPTO.importar(b); PERFIL = await cargarPerfil(CLAVE); }
  catch(e){ CLAVE = null; PERFIL = null; }
  pintarClave(); pintarTodo();
}
function pintarClave(){
  var ok = !!PERFIL;
  $("#claveFila").hidden = ok; $("#claveOlvidar").hidden = !ok;
  $("#claveMsg").textContent = ok ? "Desbloqueado en este dispositivo." : "";
  $("#gapsNota").textContent = ok ? "Cada meta sale de un fallo medido. Se llenan solas con lo que registras."
    : "Las metas se llenan solas con lo que registras. Desbloquea el contenido privado para ver la evidencia de cada una.";
}
$("#fClave").addEventListener("submit", async function(ev){
  ev.preventDefault();
  var frase = $("#clave").value; if (!frase) return;
  $("#claveMsg").textContent = "Comprobando…";
  try {
    var sal = await (await fetch("privado/sal.json", {cache:"no-cache"})).json();
    var k = await CRIPTO.derivar(frase, sal.sal);
    PERFIL = await cargarPerfil(k);
    lsSet("clave_priv", await CRIPTO.exportar(k)); CLAVE = await CRIPTO.importar(lsGet("clave_priv"));
    $("#clave").value = ""; pintarClave(); pintarTodo(); toast("Contenido privado desbloqueado");
  } catch(e){ $("#claveMsg").textContent = "La frase no abre el contenido. Revisa mayúsculas y espacios."; }
});
$("#claveOlvidar").addEventListener("click", function(){ try { localStorage.removeItem("clave_priv"); } catch(e){} CLAVE = null; PERFIL = null; pintarClave(); pintarTodo(); });

async function abrirPrivado(id){
  if (!PERFIL){ location.hash = "#progreso"; toast("Primero desbloquea el contenido privado"); return; }
  var h = (PERFIL.herramientas || []).filter(function(x){ return x.id === id; })[0];
  if (!h) return;
  try {
    var sobre = await (await fetch("privado/" + h.archivo + ".enc")).json();
    var html = await CRIPTO.descifrar(CLAVE, sobre);
    $("#visorTit").textContent = h.t;
    $("#visorFrame").srcdoc = html;
    $("#visor").hidden = false;
    VISOR = {id:id, t0:Date.now()};
  } catch(e){ toast("No se pudo abrir " + h.t + ". ¿Hay conexión la primera vez?"); }
}
/* Al cerrar una herramienta se registra sola: minutos de uso y, si la herramienta lo muestra,
   la puntuación. Se puede deshacer desde el aviso. */
var VISOR = null;
function totalesTarjetas(){
  var e = lsGet("tarjetas_v1", null), n = 0, ok = 0;
  if (e && e.c) Object.keys(e.c).forEach(function(k){ n += e.c[k].n || 0; ok += e.c[k].ok || 0; });
  return {n:n, ok:ok};
}
/* Compara con lo último visto: así también entran las sesiones hechas antes de esta función. */
function revisarTarjetas(min){
  var t = totalesTarjetas(), base = lsGet("ui_tarj_base", {n:0, ok:0});
  if (t.n <= base.n) { lsSet("ui_tarj_base", t); return null; }
  var e = registrar({act:"tarjetas", min:min || ACT.tarjetas.min, score:t.ok - base.ok, total:t.n - base.n, origen:"auto",
    nota:(t.n - base.n) + " tarjetas vistas"});
  lsSet("ui_tarj_base", t);
  return e;
}
function resultadoEn(doc, sel){
  var el = doc && doc.querySelector(sel), m = el && el.textContent.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? [+m[1], +m[2]] : null;
}
function avisoDeshacer(e){
  if (!e) return;
  var t = $("#toast"), a = ACT[e.act];
  t.innerHTML = "Registrado: " + esc(a.t) + " · " + e.min + "′" + (e.total ? " · " + e.score + "/" + e.total : "") + ' <button type="button" id="deshacer">Deshacer</button>';
  t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function(){ t.hidden = true; }, 7000);
  $("#deshacer").onclick = function(){ borrar("s", e.id); t.hidden = true; if (e.act === "tarjetas") lsSet("ui_tarj_base", totalesTarjetas()); };
}
$("#visorCerrar").addEventListener("click", function(){
  var v = VISOR, doc = null;
  try { doc = $("#visorFrame").contentDocument; } catch(err){}
  var min = v ? Math.round((Date.now() - v.t0) / 60000) : 0, e = null;
  if (v && v.id === "tarjetas") e = revisarTarjetas(Math.max(1, min));
  else if (v){
    var sc = v.id === "build" ? resultadoEn(doc, "#res .big") : v.id === "r_test2" ? resultadoEn(doc, "#result") : null;
    if (sc || min >= 2) e = registrar({act:v.id, min:Math.max(1, min), score:sc ? sc[0] : "", total:sc ? sc[1] : "", origen:"auto"});
  }
  $("#visor").hidden = true; $("#visorFrame").srcdoc = ""; VISOR = null;
  avisoDeshacer(e);
});

/* ════════════════════════════════════════════════════════════════════
   6 · REGISTRO POR VOZ
   ════════════════════════════════════════════════════════════════════ */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var reco = null, grabNota = null, props = [];
var LANG = lsGet("ui_lang", "es-CO");

function opcionesAct(sel){
  return '<option value="">— elige actividad —</option>' + ACTS.map(function(a){ return '<option value="' + a.id + '"' + (a.id === sel ? " selected" : "") + '>' + esc(a.t) + '</option>'; }).join("");
}
function pintarProps(){
  if (!props.length){ $("#props").innerHTML = ""; return; }
  $("#props").innerHTML = props.map(function(p, i){
    return '<div class="prop" data-i="' + i + '"><p class="small muted">«' + esc(p.frase) + '»</p><div class="row">' +
      '<select data-k="act">' + opcionesAct(p.act) + '</select>' +
      '<label class="f">min<input data-k="min" type="number" min="1" max="300" value="' + (p.min || (ACT[p.act] ? ACT[p.act].min : 15)) + '"></label>' +
      '<label class="f">aciertos<input data-k="score" type="number" min="0" value="' + (p.score != null ? p.score : "") + '"></label>' +
      '<label class="f">de<input data-k="total" type="number" min="1" value="' + (p.total || "") + '"></label>' +
      '<label class="f">día<input data-k="fecha" type="date" value="' + p.fecha + '"></label>' +
      '<button type="button" class="ghost" data-quitar="' + i + '">Quitar</button></div></div>';
  }).join("") + '<div class="row" style="margin-top:8px"><button type="button" class="primary" id="propsOk">Registrar ' + props.length + (props.length > 1 ? " actividades" : " actividad") + '</button><button type="button" class="ghost" id="propsNo">Descartar</button></div>';
}
function proponer(texto, origen){
  var nuevas = VOZ.interpretar(texto, hoy());
  if (!nuevas.length){ $("#transcrito").textContent = "«" + texto + "» — no reconocí ninguna actividad. Elige una:"; nuevas = [{act:null, min:null, fecha:hoy(), frase:texto}]; }
  nuevas.forEach(function(n){ n.origen = origen; });
  props = props.concat(nuevas); pintarProps();
}
$("#props").addEventListener("input", function(ev){
  var el = ev.target, row = el.closest(".prop"); if (!row || !el.dataset.k) return;
  var p = props[+row.dataset.i]; p[el.dataset.k] = el.value;
  if (el.dataset.k === "act" && ACT[el.value]){ var a = ACT[el.value]; if (!p.min) row.querySelector('[data-k="min"]').value = a.min; if (a.total && !p.total) row.querySelector('[data-k="total"]').value = a.total; }
});
$("#props").addEventListener("click", function(ev){
  var q = ev.target.closest("[data-quitar]");
  if (q){ props.splice(+q.dataset.quitar, 1); pintarProps(); return; }
  if (ev.target.id === "propsNo"){ props = []; pintarProps(); $("#transcrito").textContent = ""; return; }
  if (ev.target.id === "propsOk"){
    var falta = props.filter(function(p){ return !p.act; }).length;
    if (falta){ toast("Elige la actividad de " + (falta > 1 ? "las marcadas" : "la marcada")); return; }
    $$(".prop").forEach(function(row){ var p = props[+row.dataset.i]; ["min","score","total","fecha"].forEach(function(k){ p[k] = row.querySelector('[data-k="' + k + '"]').value; }); });
    props.forEach(function(p){ registrar({act:p.act, min:p.min, score:p.score, total:p.total, fecha:p.fecha, origen:p.origen, nota:p.origen === "voz" ? "dictado: " + p.frase.slice(0, 120) : ""}); });
    props = []; pintarProps(); $("#transcrito").textContent = "";
  }
});
$("#fTexto").addEventListener("submit", function(ev){ ev.preventDefault(); var t = $("#texto").value.trim(); if (!t) return; $("#texto").value = ""; proponer(t, "texto"); });

function micVisual(on){ $("#micBtn").classList.toggle("on", on); }
$("#micBtn").addEventListener("click", function(){
  if (reco){ reco.stop(); return; }
  if (grabNota){ grabNota.stop(); return; }
  if (SR && navigator.onLine){
    reco = new SR(); reco.lang = LANG; reco.interimResults = true; reco.continuous = false; reco.maxAlternatives = 1;
    var final = "";
    reco.onresult = function(e){ var t = ""; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; final = t; $("#transcrito").textContent = "«" + t + "»"; };
    reco.onerror = function(e){ $("#transcrito").textContent = e.error === "not-allowed" ? "El navegador no dio permiso al micrófono." : "No te escuché bien (" + e.error + "). Prueba otra vez o escríbelo."; };
    reco.onend = function(){ micVisual(false); reco = null; if (final.trim()) proponer(final.trim(), "voz"); };
    micVisual(true); $("#transcrito").textContent = "Escuchando…"; reco.start();
    return;
  }
  /* sin conexión o sin reconocimiento: se graba la nota y sube a Drive → notas_voz */
  grabar(function(blob, ext){
    var n = hoy() + "_" + new Date().toTimeString().slice(0,5).replace(":", "") + "_nota." + ext;
    encolarAudio("notas_voz", n, blob);
    $("#transcrito").textContent = "Nota guardada (" + n + "). Sin conexión no puedo transcribirla: escribe abajo qué hiciste, o díctalo al volver la señal.";
  }, function(r){ grabNota = r; micVisual(!!r); if (r) $("#transcrito").textContent = "Grabando nota… toca otra vez para parar."; });
});
$("#micAyuda").addEventListener("click", function(){
  LANG = LANG === "es-CO" ? "en-US" : "es-CO"; lsSet("ui_lang", LANG);
  toast("Dictado en " + (LANG === "es-CO" ? "español" : "inglés"));
});

/* Grabación genérica con MediaRecorder: cb(blob, ext) al parar; estado(r|null) para la UI. */
function grabar(cb, estado){
  if (!navigator.mediaDevices || !window.MediaRecorder){ toast("Este navegador no permite grabar audio."); return; }
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    var tipo = ["audio/webm;codecs=opus","audio/mp4","audio/webm"].filter(function(t){ return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || "";
    var r = new MediaRecorder(stream, tipo ? {mimeType:tipo} : undefined), trozos = [];
    r.ondataavailable = function(e){ if (e.data.size) trozos.push(e.data); };
    r.onstop = function(){ stream.getTracks().forEach(function(t){ t.stop(); }); estado(null);
      var b = new Blob(trozos, {type: r.mimeType || "audio/webm"}); cb(b, /mp4/.test(b.type) ? "m4a" : "webm"); };
    r.start(); estado(r);
  }).catch(function(){ toast("Sin permiso para el micrófono."); estado(null); });
}
async function pintarCola(){
  var L = []; try { L = await IDB.todos(); } catch(e){}
  var notas = L.filter(function(x){ return x.carpeta === "notas_voz"; }).length, grab = L.length - notas;
  $("#notasCola").textContent = L.length ? "Pendiente de subir a Drive: " + (grab ? grab + " grabación" + (grab > 1 ? "es" : "") : "") + (grab && notas ? " y " : "") + (notas ? notas + " nota" + (notas > 1 ? "s" : "") + " de voz" : "") + "." : "";
}

/* ════════════════════════════════════════════════════════════════════
   7 · HOY
   ════════════════════════════════════════════════════════════════════ */
var budget = lsGet("ui_budget", 75);
function hechoHoy(id){ var h = hoy(); return S.some(function(x){ return x.fecha === h && x.act === id; }); }
function ultimaVez(id){ for (var i = 0; i < S.length; i++) if (S[i].act === id) return S[i].fecha; return null; }
function cierre(){ return CFG.cierre || (PERFIL && PERFIL.cierre_solicitud) || ""; }

function focoDelDia(){
  var cand = null;
  GAPS.filter(function(g){ return g.prio === 1; }).forEach(function(g){
    var c = g.cuenta(S, T); if (c[0] >= c[1]) return;
    var id = GAP_ACT[g.id], u = ultimaVez(id), d = u ? diasDesde(u) : 99;
    if (d >= 4 && (!cand || d > cand.d)) cand = {id:id, d:d, g:g};
  });
  if (cand) return {id:cand.id, why:(cand.d >= 99 ? "Nunca registrado" : "Hace " + cand.d + " días") + " · " + cand.g.t.toLowerCase()};
  return {id:FOCO[new Date().getDay()], why:"Rotación del " + DIAS[new Date().getDay()]};
}

function pintarCuenta(){
  var h = hoy(), out = [], c = cierre();
  if (CFG.fecha){
    var dEx = diasEntre(h, CFG.fecha), fase;
    if (dEx < 0) fase = "El examen ya pasó. Registra la banda y fija la siguiente fecha si hace falta.";
    else if (dEx > 42) fase = "Fase 1 · construir: Writing y Speaking todos los días hábiles, un simulacro al mes.";
    else if (dEx > 14) fase = "Fase 2 · simulacros: uno completo cada sábado, el resto del tiempo a los fallos que salgan.";
    else if (dEx > 0) fase = "Fase 3 · afinar: nada nuevo; repetir formato y dormir bien la semana del examen.";
    else fase = "Hoy es el examen.";
    out.push('<div class="aviso info"><div class="row" style="justify-content:space-between"><b>Examen: ' + fCorta(CFG.fecha) +
      '</b><span class="mono">' + (dEx >= 0 ? dEx + " días" : "") + '</span></div><p class="small" style="margin-top:4px">' + esc(fase) + '</p></div>');
  } else {
    out.push('<div class="aviso"><b>Sin fecha de examen.</b> <span class="small">' + (c ? "La solicitud cierra el " + fCorta(c) + " (" + diasEntre(h, c) + " días). " : "") +
      'Resérvalo y apunta la fecha en <a href="#progreso">Progreso → Ajustes</a> para que el plan cambie de fase solo.</span></div>');
  }
  $("#cuenta").innerHTML = out.join("");

  var est = null;
  for (var i = 0; i < S.length; i++){ var x = S[i]; if ((x.act === "r_full" || x.act === "l_full") && x.total){ est = {b:bandaDe(x.score, x.total, x.skill), s:x.skill, f:x.fecha}; break; } }
  var pos = function(b){ return ((b - 3) / 6 * 100).toFixed(1) + "%"; };
  var ticks = ""; for (var b = 3; b <= 9; b++) ticks += '<div class="tick" style="left:' + pos(b) + '"><span>' + b + '</span></div>';
  var marks = '<div class="mark meta" style="left:' + pos(CFG.banda) + '">meta ' + CFG.banda + '</div>';
  if (est && Math.abs(est.b - CFG.banda) >= 0.5) marks += '<div class="mark est" style="left:' + pos(Math.max(3, est.b)) + '">' + est.b + '</div>';
  $("#banda").innerHTML = '<div class="scale">' + ticks + marks + '</div><p class="legend small muted">' +
    (est ? "Última estimación: " + SKILLS[est.s] + " " + est.b + " (" + fCorta(est.f) + ", tabla orientativa)." :
      "Aún no hay simulacro puntuado. El primero de Reading o Listening aparece aquí.") + '</p>';
}

function enlace(a){
  if (!a.url) return "";
  if (a.url.indexOf("priv:") === 0) return '<button type="button" data-priv="' + a.url.slice(5) + '">Abrir</button>';
  return '<a class="btn" href="' + esc(a.url) + '"' + (/^https?:/.test(a.url) ? ' target="_blank" rel="noopener"' : "") + '>Abrir</a>';
}
function pintarPlan(){
  $("#budgets").innerHTML = PRESUPUESTOS.map(function(p){
    return '<button type="button" class="chip" data-min="' + p.min + '" aria-pressed="' + (p.min === budget) + '">' + p.t + '</button>';
  }).join("");
  var P = PRESUPUESTOS.filter(function(p){ return p.min === budget; })[0] || PRESUPUESTOS[3];
  $("#budgetNota").textContent = P.nota;
  var foco = focoDelDia();
  var items = P.items.map(function(id){ return id === "FOCO" ? {id:foco.id, why:foco.why} : {id:id}; });
  $("#plan").innerHTML = items.map(function(it){
    var a = ACT[it.id], hecho = hechoHoy(a.id), u = ultimaVez(a.id);
    var sub = [it.why, a.d, u ? "última vez: " + fCorta(u) : "sin registros"].filter(Boolean).join(" · ");
    return '<div class="it' + (hecho ? " hecho" : "") + '"><div class="min">' + a.min + '′</div><div>' +
      '<div class="row" style="gap:8px"><h3 class="grow">' + esc(a.t) + '</h3><span class="pill ' + a.donde + '">' + a.donde + '</span></div>' +
      '<p class="why">' + esc(sub) + '</p><div class="acts">' + enlace(a) +
      (hecho ? '<span class="small" style="color:var(--ok);align-self:center">Hecho hoy</span>' :
        '<button type="button" data-hecho="' + a.id + '">Marcar hecho</button>') + '</div></div></div>';
  }).join("");
}
function filaHist(x){
  var a = ACT[x.act] || ACT.otro;
  var sc = x.total ? ' · <span class="mono">' + x.score + "/" + x.total + '</span>' : "";
  var o = x.origen === "voz" ? ' <span class="pill web">voz</span>' : "";
  return '<div class="h"><span class="d">' + fCorta(x.fecha) + '</span><span><span class="sk" style="background:var(--s-' + (x.skill || "otros") + ')"></span>' +
    esc(a.t) + ' · <span class="mono">' + x.min + '′</span>' + sc + o + (x.nota ? '<br><span class="small muted">' + esc(x.nota) + '</span>' : "") +
    '</span><span class="confirm"><button type="button" class="ghost" data-del="' + esc(x.id) + '">Borrar</button></span></div>';
}
function pintarHistHoy(){
  var h = hoy(), ay = isoDe(new Date(Date.now() - 86400000));
  var L = S.filter(function(x){ return x.fecha === h || x.fecha === ay; });
  $("#histHoy").innerHTML = L.length ? L.map(filaHist).join("") :
    '<div class="h"><span class="d">—</span><span class="muted">Nada registrado hoy ni ayer.</span><span></span></div>';
}

document.addEventListener("click", function(ev){
  var b = ev.target.closest("[data-min]");
  if (b && b.parentNode.id === "budgets"){ budget = +b.dataset.min; lsSet("ui_budget", budget); pintarPlan(); return; }
  var h = ev.target.closest("[data-hecho]");
  if (h){ var a = ACT[h.dataset.hecho]; registrar({act:a.id, min:a.min}); return; }
  var pv = ev.target.closest("[data-priv]");
  if (pv){ abrirPrivado(pv.dataset.priv); return; }
  var d = ev.target.closest("[data-del]");
  if (d){ d.parentNode.innerHTML = '<span class="small">¿Borrar?</span><button type="button" data-delok="' + esc(d.dataset.del) + '">Sí</button><button type="button" class="ghost" data-delno="1">No</button>'; return; }
  var ok = ev.target.closest("[data-delok]");
  if (ok){ borrar("s", ok.dataset.delok); toast("Borrado"); return; }
  if (ev.target.closest("[data-delno]")){ pintarTodo(); return; }
  var dt = ev.target.closest("[data-deltxt]");
  if (dt){ dt.outerHTML = '<span class="confirm"><span class="small">¿Borrar el texto?</span><button type="button" data-deltxtok="' + esc(dt.dataset.deltxt) + '">Sí</button><button type="button" class="ghost" data-delno="1">No</button></span>'; return; }
  var dto = ev.target.closest("[data-deltxtok]");
  if (dto){ borrar("t", dto.dataset.deltxtok); pintarListaW(); toast("Texto borrado"); }
});

/* ════════════════════════════════════════════════════════════════════
   8 · WRITING
   ════════════════════════════════════════════════════════════════════ */
var W = {tipo: lsGet("ui_wtipo", "t2"), pid: null, t0: null, rest: 0, int: null};
var W_MIN = {t1:20, t2:40, res:10}, W_PAL = {t1:150, t2:250, res:80};
function listaW(){ return W.tipo === "t1" ? T1 : W.tipo === "t2" ? T2 : RES; }
function cuentaPids(){ var c = {}; T.forEach(function(x){ c[x.pid] = (c[x.pid] || 0) + 1; }); return c; }
function siguientePrompt(){
  var L = listaW(), hechos = cuentaPids(), min = Infinity, best = L[0];
  L.forEach(function(p){ var n = hechos[p.id] || 0; if (n < min){ min = n; best = p; } });
  return best.id;
}
function pintarWriting(conservar){
  $$("#wTipo .chip").forEach(function(c){ c.setAttribute("aria-pressed", c.dataset.t === W.tipo); });
  var L = listaW(), hechos = cuentaPids();
  if (!conservar || !L.some(function(p){ return p.id === W.pid; })) W.pid = siguientePrompt();
  $("#wPrompt").innerHTML = L.map(function(p){
    var lab = (p.k ? p.k + " · " : "") + p.t.slice(0, 70) + (p.t.length > 70 ? "…" : "");
    return '<option value="' + p.id + '"' + (p.id === W.pid ? " selected" : "") + '>' + (hechos[p.id] ? "✓ " : "") + esc(lab) + '</option>';
  }).join("");
  var p = L.filter(function(x){ return x.id === W.pid; })[0];
  var body = '<p class="prompt"><b>' + esc(p.t) + '</b></p>';
  if (W.tipo === "t1") body += '<p class="small muted">Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words. <i>Datos de práctica inventados.</i></p><div class="chart">' + dibujar(p) + '</div>' +
    '<details class="card"><summary>Qué mira el examinador en Task 1</summary><ul class="small" style="margin:8px 0 0;padding-left:20px">' +
    '<li>Un <b>overview</b> (la tendencia principal) en su propio párrafo. Sin overview, la banda queda por debajo de 6 en Task Achievement.</li>' +
    '<li>Cifras concretas que respalden cada rasgo, sin listarlas todas.</li><li>Comparaciones: <i>whereas</i>, <i>compared with</i>, <i>twice as</i>.</li>' +
    '<li>Sin opinión y sin causas inventadas.</li></ul></details>';
  if (W.tipo === "t2") body += '<p class="small muted">Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.</p>' +
    '<details class="card"><summary>Esqueleto de 4 párrafos</summary><ol class="small" style="margin:8px 0 0;padding-left:20px">' +
    '<li>Parafrasea la pregunta y da tu posición en una frase.</li><li>Primer argumento con un ejemplo concreto.</li>' +
    '<li>Segundo argumento o la otra postura, abierto con un conector de contraste (<i>However</i>, <i>That said</i>).</li>' +
    '<li>Cierre explícito que retome la posición (<i>Overall</i>, <i>That is why</i>).</li></ol></details>';
  $("#wBody").innerHTML = body;
  if (!conservar) $("#wTxt").value = lsGet("draft_" + W.pid, "");
  if (!W.int){ W.rest = W_MIN[W.tipo] * 60; pintarReloj("#wClock", W.rest); }
  medirW(); pintarListaW();
}
function pintarReloj(sel, s){
  var el = $(sel), m = Math.floor(Math.abs(s) / 60), ss = Math.abs(s) % 60;
  el.textContent = (s < 0 ? "+" : "") + m + ":" + ("0" + ss).slice(-2);
  el.classList.toggle("low", s <= 60);
}
var wake = null;
function pedirWake(){ try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function(w){ wake = w; }).catch(function(){}); } catch(e){} }
function soltarWake(){ try { if (wake) wake.release(); } catch(e){} wake = null; }
$("#wStart").addEventListener("click", function(){
  if (W.int){ clearInterval(W.int); W.int = null; this.textContent = "Seguir"; soltarWake(); return; }
  W.t0 = Date.now() - (W_MIN[W.tipo] * 60 - W.rest) * 1000; this.textContent = "Pausar"; pedirWake();
  W.int = setInterval(function(){ W.rest = W_MIN[W.tipo] * 60 - Math.round((Date.now() - W.t0) / 1000); pintarReloj("#wClock", W.rest); }, 500);
});
$("#wReset").addEventListener("click", function(){ clearInterval(W.int); W.int = null; W.rest = W_MIN[W.tipo] * 60; pintarReloj("#wClock", W.rest); $("#wStart").textContent = "Empezar reloj"; soltarWake(); });
$("#wTipo").addEventListener("click", function(ev){ var c = ev.target.closest("[data-t]"); if (!c) return; W.tipo = c.dataset.t; lsSet("ui_wtipo", W.tipo); clearInterval(W.int); W.int = null; $("#wStart").textContent = "Empezar reloj"; pintarWriting(false); });
$("#wPrompt").addEventListener("change", function(){ W.pid = this.value; $("#wTxt").value = lsGet("draft_" + W.pid, ""); pintarWriting(true); });
$("#wTxt").addEventListener("input", function(){ lsSet("draft_" + W.pid, this.value); medirW(); });

function medirW(){
  var a = MET.analiza($("#wTxt").value), obj = W_PAL[W.tipo], R = [];
  R.push(["Palabras", a.pal + " / " + obj, a.pal >= obj]);
  R.push(["Párrafos", a.parrafos, W.tipo === "res" ? null : a.parrafos >= (W.tipo === "t1" ? 3 : 4)]);
  R.push(["Palabras por frase", a.lmf, a.frases ? (a.lmf >= 12 && a.lmf <= 26) : null]);
  if (W.tipo === "t1"){
    R.push(["Overview", a.over.total ? Object.keys(a.over.items).join(", ") : "falta", a.over.total > 0]);
    R.push(["Tendencia (tipos)", a.tend.tipos, a.tend.tipos >= 4]);
    R.push(["Comparación (tipos)", a.comp.tipos, a.comp.tipos >= 3]);
    R.push(["Cifras citadas", a.numeros, a.numeros >= 6]);
  } else {
    R.push(["Contraste", a.contraste, a.contraste >= 1]);
    R.push(["Consecuencia", a.consecuencia, a.consecuencia >= 1]);
    R.push(["Cierre explícito", a.cierre.total, a.cierre.total >= 1]);
    R.push(["Hedges", a.hed.total, a.hed.total >= 1]);
  }
  R.push(["Vaguedad", a.vag.total ? Object.keys(a.vag.items).join(", ") : 0, a.vag.total === 0]);
  $("#wMet").innerHTML = R.map(function(r){ return '<div class="m ' + (r[2] === true ? "ok" : r[2] === false && a.pal > 20 ? "bad" : "") + '">' + esc(r[0]) + '<b>' + esc(r[1]) + '</b></div>'; }).join("");
}
$("#wSave").addEventListener("click", function(){
  var txt = $("#wTxt").value.trim(); if (MET.pal(txt).length < 20){ $("#wMsg").textContent = "El texto tiene menos de 20 palabras."; return; }
  var a = MET.analiza(txt), usado = W_MIN[W.tipo] * 60 - W.rest;
  var min = usado > 30 ? Math.max(1, Math.round(usado / 60)) : W_MIN[W.tipo];
  var m = {pal:a.pal, parrafos:a.parrafos, lmf:a.lmf, contraste:a.contraste, consecuencia:a.consecuencia, cierre:a.cierre.total,
    hed:a.hed.total, vag:a.vag.total, over:a.over.total, tend:a.tend.tipos, comp:a.comp.tipos, ttr:a.ttr};
  agregar("t", {fecha:hoy(), tipo:W.tipo, pid:W.pid, texto:txt.slice(0, 12000), min:min, m:m});
  registrar({act: W.tipo === "t1" ? "w_t1" : W.tipo === "t2" ? "w_t2" : "lect", min: W.tipo === "res" ? 30 : min, nota: a.pal + " palabras"});
  lsSet("draft_" + W.pid, ""); $("#wTxt").value = "";
  $("#wMsg").textContent = "Guardado. Siguiente consigna seleccionada.";
  $("#wReset").click(); pintarWriting(false);
});
function pintarListaW(){
  var L = T.filter(function(x){ return x.tipo === W.tipo; }).slice(0, 20);
  var nom = {}; T1.concat(T2, RES).forEach(function(p){ nom[p.id] = p.t; });
  $("#wList").innerHTML = L.length ? L.map(function(x){
    var m = x.m || {};
    return '<details class="card"><summary>' + fCorta(x.fecha) + ' · <span class="mono">' + (m.pal || 0) + '</span> palabras · ' +
      '<span class="small muted">' + esc((nom[x.pid] || "").slice(0, 60)) + '…</span></summary>' +
      '<p class="small muted" style="margin-top:8px">contraste ' + m.contraste + ' · consecuencia ' + m.consecuencia + ' · cierre ' + m.cierre + ' · vaguedad ' + m.vag + ' · ' + x.min + '′</p>' +
      '<p style="white-space:pre-wrap;margin-top:8px">' + esc(x.texto) + '</p>' +
      '<div class="row" style="margin-top:8px"><button type="button" class="ghost" data-deltxt="' + esc(x.id) + '">Borrar texto</button></div></details>';
  }).join("") : '<p class="small muted">Todavía no has guardado textos de este tipo.</p>';
}

/* gráficos de Task 1 en SVG, coloreados con los tokens del tema */
var COLS = ["var(--s-reading)","var(--s-writing)","var(--s-listening)","var(--s-speaking)","var(--s-otros)"];
function leyenda(names, x0, y){ return names.map(function(n, i){ return '<rect x="' + (x0 + i * 170) + '" y="' + (y - 9) + '" width="12" height="12" rx="2" fill="' + COLS[i] + '"/><text x="' + (x0 + i * 170 + 18) + '" y="' + (y + 1) + '">' + esc(n) + '</text>'; }).join(""); }
function dibujar(p){
  if (p.tipo === "table"){
    return '<table><thead><tr><th></th>' + p.cols.map(function(c){ return "<th>" + c + "</th>"; }).join("") + '</tr></thead><tbody>' +
      p.rows.map(function(r){ return "<tr><td>" + esc(r[0]) + "</td>" + r[1].map(function(v){ return "<td>" + v + "</td>"; }).join("") + "</tr>"; }).join("") + '</tbody></table>';
  }
  var W_ = 600, H = 320, L = 56, R = 16, Tp = 20, B = 64, iw = W_ - L - R, ih = H - Tp - B, s = "";
  if (p.tipo === "line" || p.tipo === "bar"){
    var n = p.tipo === "line" ? p.x.length : p.cats.length, paso = p.max / 5;
    for (var g = 0; g <= 5; g++){ var y = Tp + ih - ih * g / 5; s += '<line class="grid" x1="' + L + '" x2="' + (W_ - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(paso * g) + '</text>'; }
    s += '<text x="14" y="' + (Tp + ih / 2) + '" transform="rotate(-90 14 ' + (Tp + ih / 2) + ')" text-anchor="middle">' + esc(p.y) + '</text>';
    s += '<line class="ax" x1="' + L + '" x2="' + (W_ - R) + '" y1="' + (Tp + ih) + '" y2="' + (Tp + ih) + '"/>';
    var Y = function(v){ return Tp + ih - ih * v / p.max; };
    if (p.tipo === "line"){
      var X = function(i){ return L + 20 + (iw - 40) * i / (n - 1); };
      p.x.forEach(function(v, i){ s += '<text x="' + X(i) + '" y="' + (Tp + ih + 18) + '" text-anchor="middle">' + v + '</text>'; });
      p.series.forEach(function(se, k){
        s += '<polyline fill="none" stroke="' + COLS[k] + '" stroke-width="2.5" points="' + se[1].map(function(v, i){ return X(i) + "," + Y(v); }).join(" ") + '"/>';
        se[1].forEach(function(v, i){ s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3.5" fill="' + COLS[k] + '"/>'; });
      });
    } else {
      var gw = iw / n, bw = Math.min(34, (gw - 20) / p.series.length);
      p.cats.forEach(function(c, i){
        var gx = L + gw * i + (gw - bw * p.series.length) / 2;
        p.series.forEach(function(se, k){ var v = se[1][i]; s += '<rect x="' + (gx + k * bw) + '" y="' + Y(v) + '" width="' + (bw - 3) + '" height="' + (Tp + ih - Y(v)) + '" fill="' + COLS[k] + '"/>'; });
        s += '<text x="' + (L + gw * i + gw / 2) + '" y="' + (Tp + ih + 18) + '" text-anchor="middle">' + esc(c) + '</text>';
      });
    }
    s += leyenda(p.series.map(function(x){ return x[0]; }), L, H - 14);
  }
  if (p.tipo === "pie"){
    H = 300; var r = 92;
    p.series.forEach(function(se, k){
      var cx = 150 + k * 300, cy = 130, a0 = -Math.PI / 2, tot = se[1].reduce(function(a, b){ return a + b; }, 0);
      se[1].forEach(function(v, i){
        var a1 = a0 + v / tot * 2 * Math.PI, big = a1 - a0 > Math.PI ? 1 : 0;
        s += '<path d="M' + cx + ',' + cy + ' L' + (cx + r * Math.cos(a0)) + ',' + (cy + r * Math.sin(a0)) + ' A' + r + ',' + r + ' 0 ' + big + ' 1 ' + (cx + r * Math.cos(a1)) + ',' + (cy + r * Math.sin(a1)) + ' Z" fill="' + COLS[i] + '" stroke="var(--panel)" stroke-width="2"/>';
        var am = (a0 + a1) / 2; s += '<text x="' + (cx + r * .64 * Math.cos(am)) + '" y="' + (cy + r * .64 * Math.sin(am) + 4) + '" text-anchor="middle" style="fill:var(--panel);font-weight:600">' + v + '%</text>';
        a0 = a1;
      });
      s += '<text x="' + cx + '" y="' + (cy + r + 24) + '" text-anchor="middle" style="font-weight:600">' + se[0] + '</text>';
    });
    s += p.cats.map(function(c, i){ return '<rect x="' + (8 + i * 118) + '" y="' + (H - 22) + '" width="12" height="12" rx="2" fill="' + COLS[i] + '"/><text x="' + (26 + i * 118) + '" y="' + (H - 12) + '">' + esc(c) + '</text>'; }).join("");
  }
  if (p.tipo === "process"){
    var cols = 4, bwp = 128, bh = 54, gx2 = 16, rows = Math.ceil(p.steps.length / cols); H = rows * 110 + 20;
    var pos = function(i){ var rr = Math.floor(i / cols), c = rr % 2 ? cols - 1 - (i % cols) : i % cols; return {x: 10 + c * (bwp + gx2), y: 14 + rr * 110}; };
    s += '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>';
    p.steps.forEach(function(st, i){
      var q = pos(i);
      s += '<rect x="' + q.x + '" y="' + q.y + '" width="' + bwp + '" height="' + bh + '" rx="6" fill="var(--acc-soft)" stroke="var(--acc)"/>';
      var w = st.split(" "), l1 = [], l2 = []; w.forEach(function(x){ (l1.join(" ").length + x.length < 18 && !l2.length ? l1 : l2).push(x); });
      s += '<text x="' + (q.x + bwp / 2) + '" y="' + (q.y + (l2.length ? 22 : 31)) + '" text-anchor="middle">' + esc(l1.join(" ")) + '</text>';
      if (l2.length) s += '<text x="' + (q.x + bwp / 2) + '" y="' + (q.y + 39) + '" text-anchor="middle">' + esc(l2.join(" ")) + '</text>';
      s += '<text x="' + (q.x + 8) + '" y="' + (q.y + 14) + '" style="font:600 10px var(--mono);fill:var(--muted)">' + (i + 1) + '</text>';
      if (i < p.steps.length - 1){
        var n2 = pos(i + 1);
        if (n2.y === q.y){ var dir = n2.x > q.x ? 1 : -1; var x1 = dir > 0 ? q.x + bwp : q.x, x2 = dir > 0 ? n2.x : n2.x + bwp;
          s += '<line x1="' + x1 + '" y1="' + (q.y + bh / 2) + '" x2="' + x2 + '" y2="' + (q.y + bh / 2) + '" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#ar)"/>'; }
        else s += '<line x1="' + (q.x + bwp / 2) + '" y1="' + (q.y + bh) + '" x2="' + (n2.x + bwp / 2) + '" y2="' + n2.y + '" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#ar)"/>';
      }
    });
    if (p.back){ var a1p = pos(p.back[0]), b1p = pos(p.back[1]), bx = a1p.x + bwp / 2;
      s += '<line x1="' + bx + '" y1="' + a1p.y + '" x2="' + bx + '" y2="' + (b1p.y + bh) + '" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ar)"/>' +
        '<text x="' + (bx + 6) + '" y="' + ((a1p.y + b1p.y + bh) / 2 + 4) + '" style="fill:var(--bad)">if it fails</text>'; }
  }
  return '<svg viewBox="0 0 600 ' + H + '" role="img" aria-label="' + esc(p.t) + '">' + s + '</svg>';
}

/* ════════════════════════════════════════════════════════════════════
   9 · SPEAKING
   ════════════════════════════════════════════════════════════════════ */
var SP = {part: lsGet("ui_spart", "p2"), id:null, fase:"prep", rest:60, int:null, t0:0, cnt:{}, rec:null, grabado:false};
var CONT = [["kind_of","kind of"],["whatever","whatever"],["idk","I don't know"],["espanol","español"],["pausa","pausa > 3 s"]];
function listaS(){ return SP.part === "p1" ? P1 : P2; }
function nombreGrab(ext){ return hoy() + "_" + SP.part + "_" + SP.id.replace(/^p\d_/, "") + "_" + new Date().toTimeString().slice(0,5).replace(":", "") + "." + ext; }
function pintarSpeaking(conservar){
  $$("#sPart .chip").forEach(function(c){ c.setAttribute("aria-pressed", c.dataset.p === SP.part); });
  var L = listaS(), cuenta = {}; S.forEach(function(x){ if (x.det && x.det.item) cuenta[x.det.item + "|" + x.act] = 1; });
  var act = "s_" + SP.part;
  if (!conservar || !L.some(function(p){ return p.id === SP.id; })){
    var libre = L.filter(function(p){ return !cuenta[p.id + "|" + act]; }); SP.id = (libre[0] || L[Math.floor(Math.random() * L.length)]).id;
  }
  $("#sItem").innerHTML = L.map(function(p){ return '<option value="' + p.id + '"' + (p.id === SP.id ? " selected" : "") + '>' + (cuenta[p.id + "|" + act] ? "✓ " : "") + esc(p.t) + '</option>'; }).join("");
  var p = L.filter(function(x){ return x.id === SP.id; })[0], h = "";
  if (SP.part === "p1") h = '<div class="card"><p class="label">Part 1 · ' + esc(p.t) + '</p><ol style="margin:8px 0 0;padding-left:20px">' + p.q.map(function(q){ return "<li>" + esc(q) + "</li>"; }).join("") + '</ol><p class="small muted" style="margin-top:8px">Respuestas de 2–3 frases: respuesta directa + razón + un detalle. Sin preparación.</p></div>';
  if (SP.part === "p2") h = '<div class="cue"><p><b>' + esc(p.t) + '</b></p><p class="small" style="margin-top:6px">You should say:</p><ul>' + p.b.map(function(x){ return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div><p class="small muted" style="margin-top:8px">Un minuto para tres notas de una palabra. Habla hasta que suene el reloj. Las dos últimas frases son el cierre.</p>';
  if (SP.part === "p3") h = '<div class="card"><p class="label">Part 3 · a partir de: ' + esc(p.t) + '</p><ol style="margin:8px 0 0;padding-left:20px">' + p.p3.map(function(q){ return "<li>" + esc(q) + "</li>"; }).join("") + '</ol><p class="small muted" style="margin-top:8px">Cada respuesta: posición → razón → ejemplo → matiz con contraste → cierre. 45–60 segundos por pregunta.</p></div>';
  $("#sCard").innerHTML = h;
  if (!SP.int) resetS();
  $("#sCount").innerHTML = CONT.map(function(c){ return '<button type="button" class="counter" data-c="' + c[0] + '"><b>' + (SP.cnt[c[0]] || 0) + '</b><span>' + esc(c[1]) + '</span></button>'; }).join("");
  $("#sChecks").innerHTML = [["cierre","Dije un cierre explícito (So, overall… / That's why…)"],["reparacion","Usé una fórmula de reparación en vez de parar o pasar al español"],
    ["completo", SP.part === "p2" ? "Hablé los 2 minutos completos" : "Respondí todas las preguntas"]]
    .map(function(c){ return '<label><input type="checkbox" id="chk_' + c[0] + '"> <span>' + esc(c[1]) + '</span></label>'; }).join("");
}
function resetS(){
  clearInterval(SP.int); SP.int = null; soltarWake();
  if (SP.part === "p2"){ SP.fase = "prep"; SP.rest = 60; $("#sStart").textContent = "Preparar 1′"; }
  else { SP.fase = "hablar"; SP.rest = 300; $("#sStart").textContent = "Empezar 5′"; }
  pintarReloj("#sClock", SP.rest);
}
function correrS(seg, fin){
  SP.t0 = Date.now(); SP.rest = seg; pintarReloj("#sClock", seg); pedirWake();
  SP.int = setInterval(function(){ SP.rest = seg - Math.round((Date.now() - SP.t0) / 1000); pintarReloj("#sClock", SP.rest); if (SP.rest <= 0){ clearInterval(SP.int); SP.int = null; fin(); } }, 250);
}
$("#sStart").addEventListener("click", function(){
  var b = this;
  if (SP.int){ resetS(); return; }
  if (SP.part === "p2" && SP.fase === "prep"){
    b.textContent = "Parar"; correrS(60, function(){ SP.fase = "hablar"; toast("Empieza a hablar: 2 minutos"); if (!SP.rec) $("#recBtn").click();
      correrS(120, function(){ b.textContent = "Otra vez"; SP.fase = "prep"; soltarWake(); if (SP.rec) SP.rec.stop(); toast("Tiempo. Cierra la idea y marca la lista."); }); });
  } else { b.textContent = "Parar"; correrS(SP.part === "p2" ? 120 : 300, function(){ b.textContent = "Otra vez"; soltarWake(); if (SP.rec) SP.rec.stop(); toast("Tiempo."); }); }
});
$("#recBtn").addEventListener("click", function(){
  if (SP.rec){ SP.rec.stop(); return; }
  grabar(function(blob, ext){
    var n = nombreGrab(ext); SP.grabado = true;
    var au = $("#recAudio"); au.src = URL.createObjectURL(blob); au.hidden = false;
    encolarAudio("grabaciones", n, blob);
    $("#recEstado").textContent = "Guardada: " + n + ". Escúchala antes de marcar la lista.";
  }, function(r){ SP.rec = r; $("#recBtn").textContent = r ? "Parar grabación" : "Grabar mi respuesta"; if (r) $("#recEstado").textContent = "Grabando…"; });
});
$("#sReset").addEventListener("click", function(){ resetS(); SP.cnt = {}; pintarSpeaking(true); });
$("#sPart").addEventListener("click", function(ev){ var c = ev.target.closest("[data-p]"); if (!c) return; SP.part = c.dataset.p; lsSet("ui_spart", SP.part); SP.cnt = {}; resetS(); pintarSpeaking(false); });
$("#sItem").addEventListener("change", function(){ SP.id = this.value; SP.cnt = {}; pintarSpeaking(true); });
$("#sCount").addEventListener("click", function(ev){ var c = ev.target.closest("[data-c]"); if (!c) return; SP.cnt[c.dataset.c] = (SP.cnt[c.dataset.c] || 0) + 1; c.querySelector("b").textContent = SP.cnt[c.dataset.c]; });
$("#sSave").addEventListener("click", function(){
  var det = {item:SP.id, kind_of:SP.cnt.kind_of || 0, whatever:SP.cnt.whatever || 0, idk:SP.cnt.idk || 0, espanol:SP.cnt.espanol || 0, pausas:SP.cnt.pausa || 0,
    cierre:$("#chk_cierre").checked, reparacion:$("#chk_reparacion").checked, completo:$("#chk_completo").checked, grabado:SP.grabado};
  var act = "s_" + SP.part;
  registrar({act:act, min:ACT[act].min, det:det, nota:(det.cierre ? "cierre ✓ " : "sin cierre ") + (det.reparacion ? "· reparación ✓ " : "") + (det.espanol ? "· español ×" + det.espanol : "") + (det.grabado ? " · grabada" : "")});
  SP.cnt = {}; SP.grabado = false; $("#recAudio").hidden = true; resetS(); pintarSpeaking(false); $("#sMsg").textContent = "Guardado. Siguiente tema seleccionado.";
});

/* ════════════════════════════════════════════════════════════════════
   10 · PROGRESO
   ════════════════════════════════════════════════════════════════════ */
function racha(){
  var dias = {}; S.forEach(function(x){ dias[x.fecha] = 1; });
  var d = new Date(), n = 0; if (!dias[isoDe(d)]) d.setDate(d.getDate() - 1);
  while (dias[isoDe(d)]){ n++; d.setDate(d.getDate() - 1); }
  return n;
}
function pintarProgreso(){
  var dow = (new Date().getDay() + 6) % 7, lunes = isoDe(new Date(Date.now() - dow * 86400000));
  var semana = S.filter(function(x){ return x.fecha >= lunes; }), minSem = semana.reduce(function(a, x){ return a + (+x.min || 0); }, 0);
  var diasSem = {}; semana.forEach(function(x){ diasSem[x.fecha] = 1; });
  var rc = racha();
  $("#kpis").innerHTML = [
    ["Racha", rc + (rc === 1 ? " día" : " días"), "días seguidos con algo registrado"],
    ["Minutos", minSem + " / " + CFG.meta, "desde el lunes"],
    ["Días activos", Object.keys(diasSem).length + " / 7", "esta semana"],
    ["Textos", T.filter(function(x){ return x.fecha >= lunes; }).length, "escritos esta semana"]
  ].map(function(k){ return '<div class="kpi"><div class="label">' + k[0] + '</div><div class="v">' + k[1] + '</div><div class="t">' + k[2] + '</div></div>'; }).join("");

  var desde = isoDe(new Date(Date.now() - 13 * 86400000)), por = {};
  S.forEach(function(x){ if (x.fecha >= desde) por[x.skill || "otros"] = (por[x.skill || "otros"] || 0) + (+x.min || 0); });
  var mx = Math.max(60, Math.max.apply(null, Object.keys(SKILLS).map(function(k){ return por[k] || 0; })));
  $("#barsSkill").innerHTML = Object.keys(SKILLS).map(function(k){
    var v = por[k] || 0;
    return '<div class="bar"><span>' + SKILLS[k].split(" ")[0] + '</span><div class="track"><div class="fill" style="width:' + (v / mx * 100).toFixed(1) + '%;background:var(--s-' + k + ')"></div></div><span class="n">' + v + '′</span></div>';
  }).join("") + '<p class="small muted">Una habilidad a cero en 14 días es la primera candidata para mañana.</p>';

  var ev = PERFIL && PERFIL.evidencia || {};
  $("#gaps").innerHTML = GAPS.map(function(g){
    var c = g.cuenta(S, T), pct = Math.min(100, c[0] / c[1] * 100), done = c[0] >= c[1];
    return '<div class="gap' + (done ? " done" : "") + '"><div><span class="prio">P' + g.prio + '</span> <b>' + esc(g.t) + '</b></div>' +
      '<span class="mono small">' + Math.min(c[0], c[1]) + '/' + c[1] + '</span><p class="ev">' + (ev[g.id] ? esc(ev[g.id]) + " " : "") + '<b>Meta:</b> ' + esc(g.meta) + '.</p>' +
      '<div class="meter"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
  }).join("");

  var M = S.filter(function(x){ return x.total; }).slice(0, 25);
  $("#scores").innerHTML = M.length ? '<table class="simple"><thead><tr><th>Fecha</th><th>Prueba</th><th>Aciertos</th><th>%</th><th>Banda aprox.</th></tr></thead><tbody>' +
    M.map(function(x){ var a = ACT[x.act] || ACT.otro, b = a.mock ? bandaDe(x.score, x.total, x.skill) : null;
      return '<tr><td class="mono">' + fCorta(x.fecha) + '</td><td>' + esc(a.t) + '</td><td class="n">' + x.score + '/' + x.total + '</td><td class="n">' + Math.round(x.score / x.total * 100) + '</td><td class="n">' + (b !== null ? b : "—") + '</td></tr>'; }).join("") +
    '</tbody></table><p class="small muted" style="margin-top:6px">La banda sólo se estima en pruebas de 40 preguntas, con la tabla orientativa de Academic.</p>' :
    '<p class="small muted">Dicta o escribe «listening oficial 31 de 40» al terminar un test y aparece aquí.</p>';

  var E2 = T.filter(function(x){ return x.tipo === "t2" || x.tipo === "t1"; }).slice(0, 12).reverse();
  $("#txtEvo").innerHTML = E2.length ? '<table class="simple"><thead><tr><th>Fecha</th><th>Tarea</th><th>Palabras</th><th>Contraste</th><th>Consec.</th><th>Cierre</th><th>Vaguedad</th></tr></thead><tbody>' +
    E2.map(function(x){ var m = x.m || {}; return '<tr><td class="mono">' + fCorta(x.fecha) + '</td><td>' + x.tipo.toUpperCase() + '</td><td class="n">' + m.pal + '</td><td class="n">' + m.contraste + '</td><td class="n">' + m.consecuencia + '</td><td class="n">' + m.cierre + '</td><td class="n">' + m.vag + '</td></tr>'; }).join("") + '</tbody></table>' :
    '<p class="small muted">Aún no hay textos de Task 1 o Task 2.</p>';

  if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#fCfg")) return;
  $("#cfgFecha").value = CFG.fecha || ""; $("#cfgCierre").value = cierre();
  $("#cfgBanda").innerHTML = [5.5,6,6.5,7,7.5].map(function(b){ return '<option' + (+CFG.banda === b ? " selected" : "") + '>' + b + '</option>'; }).join("");
  $("#cfgMeta").value = CFG.meta;
}
$("#fCfg").addEventListener("submit", function(ev){
  ev.preventDefault();
  ST.cfg = {fecha:$("#cfgFecha").value, cierre:$("#cfgCierre").value, banda:+$("#cfgBanda").value, meta:+$("#cfgMeta").value || 420, upd:Date.now()};
  document.activeElement.blur(); commit(); $("#cfgMsg").textContent = "Guardado."; toast("Ajustes guardados");
});

/* copia de seguridad: acepta también la exportación de la bitácora anterior {config, sesiones, textos} */
$("#bExport").addEventListener("click", function(){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(ST, null, 1)], {type:"application/json"}));
  a.download = "bitacora_ielts_" + hoy() + ".json"; document.body.appendChild(a); a.click(); a.remove();
  $("#bMsg").textContent = "Descargada.";
});
$("#bImport").addEventListener("change", function(){
  var f = this.files[0]; if (!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try {
      var j = JSON.parse(rd.result), otro;
      if (j.s && j.t) otro = j;
      else {
        otro = {v:1, s:{}, t:{}, del:{}, cfg:Object.assign({}, CFG0, j.config || {}, {upd:0})};
        (j.sesiones || []).forEach(function(x){ var id = "i" + x.ts + (x.act || ""); otro.s[id] = Object.assign({}, x, {id:id}); });
        (j.textos || []).forEach(function(x){ var id = "i" + x.ts + (x.pid || ""); otro.t[id] = Object.assign({}, x, {id:id}); });
      }
      var antes = S.length + T.length;
      ST = fusionar(ST, otro); commit();
      $("#bMsg").textContent = "Restaurados " + (S.length + T.length - antes) + " registros nuevos (los repetidos se saltaron).";
    } catch(e){ $("#bMsg").textContent = "El archivo no es una copia válida de la bitácora."; }
  };
  rd.readAsText(f);
});

/* ════════════════════════════════════════════════════════════════════
   11 · MATERIAL, NAVEGACIÓN Y ARRANQUE
   ════════════════════════════════════════════════════════════════════ */
function pintarMaterial(){
  var orden = ["app","web","drive","portatil"];
  var L = ACTS.filter(function(a){ return a.id !== "otro"; }).slice().sort(function(a, b){ return orden.indexOf(a.donde) - orden.indexOf(b.donde); });
  $("#matList").innerHTML = L.map(function(a){
    var priv = a.url && a.url.indexOf("priv:") === 0;
    return '<div class="card row"><div class="grow"><div class="row" style="gap:8px"><span class="sk" style="background:var(--s-' + a.skill + ')"></span><b>' + esc(a.t) + '</b><span class="pill ' + a.donde + '">' + a.donde + '</span>' +
      (priv ? '<span class="pill web">cifrado</span>' : "") + '</div>' + (a.d ? '<p class="small muted" style="margin-top:4px">' + esc(a.d) + '</p>' : "") + '</div>' + enlace(a) + '</div>';
  }).join("") + '<p class="small muted">Las herramientas cifradas guardan su propio avance (cajas de tarjetas, respuestas) en este dispositivo. Al terminar, márcalas en Hoy para que cuenten aquí.</p>';
}
function vista(){
  var h = (location.hash || "#hoy").slice(1), sub = null;
  var m = h.match(/^(writing|speaking)-(t1|t2|res|p1|p2|p3)$/);
  if (m){ h = m[1]; sub = m[2]; }
  if (!document.getElementById("v-" + h)) h = "hoy";
  $$("[data-view]").forEach(function(s){ s.hidden = s.id !== "v-" + h; });
  $$("nav.tabs a").forEach(function(a){ if (a.dataset.tab === h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (sub && h === "writing" && sub !== W.tipo){ W.tipo = sub; lsSet("ui_wtipo", sub); pintarWriting(false); }
  if (sub && h === "speaking" && sub !== SP.part){ SP.part = sub; lsSet("ui_spart", sub); SP.cnt = {}; resetS(); pintarSpeaking(false); }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", vista);

var pintadoWS = false;
function pintarTodo(){
  var d = new Date();
  $("#hdrFecha").textContent = DIAS[d.getDay()] + " " + d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear();
  pintarCuenta(); pintarPlan(); pintarHistHoy(); pintarProgreso(); pintarDrive();
  if (!pintadoWS){ pintarWriting(false); pintarSpeaking(false); pintadoWS = true; } else pintarListaW();
  pintarMaterial();
}

if (!SR) $("#micAyuda").textContent = "Este navegador no transcribe voz: el botón graba una nota, o escribe abajo. En Chrome de Android sí transcribe.";
reconstruir(); pintarTodo(); vista(); pintarCola(); iniciarPrivado();
/* sesión de tarjetas hecha sin pasar por el visor (o antes de que existiera este registro) */
setTimeout(function(){ avisoDeshacer(revisarTarjetas()); }, 400);
if (DRIVE.configurado() && DRIVE.consentidoAntes()) sincronizar(false);
else { pintarDrive(); if (DRIVE.configurado()) estadoSync("off", "toca para conectar Drive"); }
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function(){});
