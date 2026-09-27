/* Analizador de discurso para Writing y Speaking.
 * Los inventarios son los mismos que el analizador de la lectura diaria
 * (que a su vez replica un analizador de transcripciones en Python), para que un ensayo de aquí
 * y un resumen de allí se puedan comparar. Si cambias una lista, cámbiala en los dos sitios.
 */
var MET = (function(){
  var CONECTORES = {
    basicos:["and","but","so","because","then","or"],
    contraste:["however","although","though","even though","nevertheless","nonetheless","whereas",
               "while","on the other hand","in contrast","by contrast","conversely","yet","despite",
               "in spite of","rather","instead","that said","having said that","otherwise"],
    adicion:["furthermore","moreover","in addition","additionally","on top of that","besides",
             "as well as","not only","what is more"],
    consecuencia:["therefore","thus","as a result","consequently","hence","which means",
                  "that is why","accordingly","so that"],
    ejemplificacion:["for example","for instance","such as","in particular","namely","to illustrate"],
    reformulacion:["in other words","that is to say","put differently","to put it another way","in fact"],
    organizacion:["first","firstly","second","secondly","third","finally","to begin with","overall",
                  "to sum up","in summary","in conclusion","on the whole","lastly"],
    condicion:["if","unless","provided that","as long as","in case"]
  };
  var VAGUEDAD = ["or something like that","something like that","or something","i don't know","i dont know",
    "i don't remember","whatever","kind of","sort of","maybe","stuff like that","things like that",
    "more or less","i guess","a lot of things","and so on","etc"];
  var HEDGES = ["i think","i believe","it seems","seems to be","probably","it depends","in my view",
    "from my perspective","arguably","tend to","tends to","might","may be","could be","it is likely",
    "my sense is","as far as i know","to some extent","up to a point","broadly speaking","in most cases",
    "i would argue","this suggests","it suggests","presumably","roughly","approximately","in principle",
    "at least in part","appears to"];
  var CIERRES = ["the point is","what this suggests is","overall","the upshot is","in short","to sum up",
    "the key point is","that is why","which is why","in conclusion","the takeaway is","bottom line",
    "what matters is"];
  /* Task 1: lenguaje de tendencia y comparación (propio de este analizador). */
  var TENDENCIA = ["increase","increased","rise","rose","risen","grew","grow","growth","decline","declined",
    "fell","fall","fallen","drop","dropped","decrease","decreased","peak","peaked","plateau","levelled off",
    "leveled off","remained stable","fluctuated","doubled","tripled","halved","surpassed","overtook"];
  var COMPARA = ["compared with","compared to","than","whereas","while","the highest","the lowest",
    "the largest","the smallest","twice as","half","the same as","similar","in contrast","by contrast",
    "respectively","the majority","a minority"];
  var OVERVIEW = ["overall","in general","it is clear that","it is evident that","the most striking",
    "the main trend","in summary","generally speaking"];

  function pal(t){ return (t.toLowerCase().match(/[a-z']+/g) || []); }
  function contar(texto, lista){
    var t = " " + texto.toLowerCase().replace(/\s+/g, " ") + " ";
    var orden = lista.slice().sort(function(a,b){ return b.length - a.length; });
    var res = {}, tot = 0;
    orden.forEach(function(e){
      var pat = new RegExp("(^|[^a-z'])(" + e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+") + ")(?![a-z'])", "g");
      var n = 0;
      t = t.replace(pat, function(m, pre, hit){ n++; return pre + new Array(hit.length + 1).join("\u0001"); });
      if (n){ res[e] = n; tot += n; }
    });
    return {items:res, total:tot, tipos:Object.keys(res).length};
  }
  function analiza(texto){
    var w = pal(texto), n = w.length || 1;
    var fr = texto.split(/[.!?]+/).map(function(s){ return s.trim(); })
                  .filter(function(s){ return pal(s).length > 2; });
    var parr = texto.split(/\n\s*\n/).filter(function(p){ return pal(p).length > 5; }).length;
    var conect = {}, noBasicos = 0;
    Object.keys(CONECTORES).forEach(function(f){
      conect[f] = contar(texto, CONECTORES[f]);
      if (f !== "basicos") noBasicos += conect[f].tipos;
    });
    var vag = contar(texto, VAGUEDAD);
    var lex = {}; w.forEach(function(x){ lex[x] = 1; });
    return {pal:w.length, frases:fr.length, parrafos:parr,
      lmf: fr.length ? Math.round(w.length / fr.length * 10) / 10 : 0,
      ttr: Math.round(Object.keys(lex).length / n * 100),
      conect:conect, noBasicos:noBasicos,
      contraste:conect.contraste.tipos, consecuencia:conect.consecuencia.tipos,
      vag:vag, vagMil: Math.round(vag.total / n * 1000 * 10) / 10,
      hed:contar(texto, HEDGES), cierre:contar(texto, CIERRES),
      tend:contar(texto, TENDENCIA), comp:contar(texto, COMPARA), over:contar(texto, OVERVIEW),
      numeros:(texto.match(/\d[\d.,]*\s*(%|per cent|percent)?/g) || []).length};
  }
  return {analiza:analiza, pal:pal};
})();
