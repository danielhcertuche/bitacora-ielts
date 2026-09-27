/* Intérprete de notas dictadas → entradas de la bitácora.
 *
 * Entrada: el texto que devuelve el reconocimiento de voz, en español o inglés, p. ej.
 *   «hoy hice veinte minutos de task 2 y luego tarjetas quince minutos»
 *   «ayer reading completo 28 de 40 en una hora»
 * Salida: [{act, min, score, total, fecha, frase}] para que la persona las confirme.
 *
 * Reglas, no modelo: lo que no entiende lo devuelve sin actividad y la app lo deja editar.
 */
(function (raiz) {
  /* Orden importa: lo más específico primero. Cada patrón se prueba sobre el texto sin tildes. */
  var ACTIVIDADES = [
    ["w_t1", /\b(task|tarea|writing) ?(1|one|uno)\b|\bgrafic[oa]s?\b|\bgraph\b|\bchart\b/],
    ["w_t2", /\b(task|tarea|writing) ?(2|two|dos)\b|\bensayos?\b|\bessays?\b/],
    ["s_p1", /\b(part|parte) ?(1|one|uno)\b/],
    ["s_p3", /\b(part|parte) ?(3|three|tres)\b/],
    ["s_p2", /\b(part|parte) ?(2|two|dos)\b|\bcue ?cards?\b|\bspeaking\b|\bmonologo\b|\bhable\b|\bhablar\b/],
    ["shadow", /\bshadowing\b|\bnarracion\b|\bpronunciacion\b/],
    ["l_full", /\blistening (completo|oficial|test)\b|\b(test|simulacro) de listening\b/],
    ["l_escuchar", /\blistening\b|\bescucha\b|\bescuche\b|\bpodcast\b|\baudio\b/],
    ["r_full", /\breading (completo|oficial)\b|\btres pasajes\b|\b3 pasajes\b|\b(test|simulacro) de reading\b/],
    ["r_test2", /\bdatecol\b|\bpasaje\b|\breading\b/],
    ["lect", /\bdeep work\b|\bresumen\b|\blectura\b|\blei\b|\bleer\b/],
    ["tarjetas", /\btarjetas?\b|\bflash ?cards?\b|\bcards\b|\bmazos?\b/],
    ["discurso", /\bdiscurso\b|\bchunks?\b/],
    ["build", /\bbuild a sentence\b|\bgramatica\b|\bprecision\b|\bdrill\b/],
    ["tutoria", /\bclase\b|\btutoria\b|\btutora\b|\bmentora\b/],
    ["simulacro", /\bsimulacro completo\b|\bexamen completo\b|\bmock test\b/]
  ];
  var NUM = {un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, noventa: 90,
    one: 1, two: 2, three: 3, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60};

  function normal(t) {
    t = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    /* «treinta y cinco» → 35, «veinte y dos» → 22 */
    t = t.replace(/\b(veinte|treinta|cuarenta|cincuenta)( y |-)(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g,
      function (m, a, _, b) { return String(NUM[a] + NUM[b]); });
    t = t.replace(/\bveinti(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g, function (m, b) { return String(20 + NUM[b]); });
    t = t.replace(/\b[a-z]+\b/g, function (w) { return NUM[w] !== undefined && !/^(un|una|uno|one)$/.test(w) ? String(NUM[w]) : w; });
    return t;
  }
  function minutos(c) {
    if (/\bhora y media\b|\bhour and a half\b/.test(c)) return 90;
    if (/\bmedia hora\b|\bhalf an hour\b/.test(c)) return 30;
    var h = c.match(/\b(\d+|una|un|an|one) ?(horas?|hours?|h)\b/);
    var m = c.match(/\b(\d+) ?(minutos?|mins?|minutes?|m)\b/);
    var tot = 0;
    if (h) tot += (/^\d+$/.test(h[1]) ? +h[1] : 1) * 60;
    if (m) tot += +m[1];
    return tot || null;
  }
  function puntuacion(c) {
    var m = c.match(/\b(\d+) ?(de|sobre|out of|\/) ?(\d+)\b/);
    if (m && +m[1] <= +m[3] && +m[3] >= 5 && !/^(minutos?|min)/.test(c.slice(c.indexOf(m[0]) + m[0].length).trim())) return [+m[1], +m[3]];
    return null;
  }
  function fechaDe(t, hoy) {
    var d = new Date(hoy + "T12:00:00");
    if (/\banteayer\b/.test(t)) d.setDate(d.getDate() - 2);
    else if (/\bayer\b|\byesterday\b/.test(t)) d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function interpretar(texto, hoy) {
    var t = normal(texto), fecha = fechaDe(t, hoy);
    /* Se cortan cláusulas por conectores y comas; cada cláusula aporta como mucho una actividad.
       Si una cláusula trae minutos pero no actividad, los minutos se asignan a la anterior. */
    var partes = t.split(/,|;|\.|\by luego\b|\bluego\b|\bdespues\b|\btambien\b|\bademas\b|\band then\b|\by (?=(?:hice|tarjetas|task|tarea|reading|listening|speaking|part|parte|lectura|resumen|shadowing|clase|gramatica|build|discurso)\b)/);
    var out = [];
    partes.forEach(function (p) {
      if (!p || !p.trim()) return;
      var act = null;
      for (var i = 0; i < ACTIVIDADES.length && !act; i++) if (ACTIVIDADES[i][1].test(p)) act = ACTIVIDADES[i][0];
      var min = minutos(p), sc = puntuacion(p);
      if (!act && out.length && (min || sc)) {
        var prev = out[out.length - 1];
        if (min && !prev.min) prev.min = min;
        if (sc && !prev.total) { prev.score = sc[0]; prev.total = sc[1]; }
        prev.frase += " ·" + p;
        return;
      }
      if (!act && !min && !sc) return;
      var e = {act: act, min: min, fecha: fecha, frase: p.trim()};
      if (sc) { e.score = sc[0]; e.total = sc[1]; }
      out.push(e);
    });
    /* «simulacro completo» se expande en las cuatro secciones */
    var r = [];
    out.forEach(function (e) {
      if (e.act !== "simulacro") { r.push(e); return; }
      [["l_full", 30], ["r_full", 60], ["w_t1", 20], ["w_t2", 40], ["s_p2", 15]].forEach(function (x) {
        r.push({act: x[0], min: x[1], fecha: e.fecha, frase: e.frase});
      });
    });
    return r;
  }

  raiz.VOZ = {interpretar: interpretar, normal: normal};
})(typeof window !== "undefined" ? window : globalThis);
