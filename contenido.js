/* Contenido de práctica: actividades, planes por tiempo disponible y consignas de Writing y Speaking.
 * Los datos de los gráficos de Task 1 son inventados para practicar. Nada personal vive aquí:
 * lo personal va cifrado en privado/.
 */
var SKILLS = {reading:"Reading", listening:"Listening", writing:"Writing", speaking:"Speaking", otros:"Gramática y léxico"};

/* donde: app (funciona aquí, también sin conexión) | drive | portatil | web */
var ACTS = [
  {id:"w_t1", t:"Writing Task 1 · describir un gráfico", skill:"writing", min:20, donde:"app", url:"#writing-t1", gap:"writing_t1"},
  {id:"w_t2", t:"Writing Task 2 · ensayo", skill:"writing", min:40, donde:"app", url:"#writing-t2", gap:"writing_t2"},
  {id:"lect", t:"Deep Work 20′ + resumen escrito", skill:"reading", min:30, donde:"drive", url:"#writing-res", gap:"produccion",
   d:"Lee 20 minutos (el PDF en tu Drive, disponible sin conexión) y escribe aquí el resumen de memoria."},
  {id:"s_p1", t:"Speaking Part 1 · preguntas cortas", skill:"speaking", min:5, donde:"app", url:"#speaking-p1", gap:"speaking"},
  {id:"s_p2", t:"Speaking Part 2 · cue card 1′ + 2′", skill:"speaking", min:10, donde:"app", url:"#speaking-p2", gap:"speaking"},
  {id:"s_p3", t:"Speaking Part 3 · discusión", skill:"speaking", min:10, donde:"app", url:"#speaking-p3", gap:"speaking"},
  {id:"shadow", t:"Shadowing · escuchar y repetir", skill:"speaking", min:10, donde:"app", url:"#speaking-sh", gap:"pronunciacion",
   d:"16 frases modelo con voz británica: escuchas, repites, y otra vez más rápido."},
  {id:"tarjetas", t:"Tarjetas · repaso espaciado", skill:"otros", min:15, donde:"app", url:"priv:tarjetas", gap:"inventario"},
  {id:"discurso", t:"Discurso · chunks y párrafos", skill:"writing", min:20, donde:"app", url:"priv:discurso", gap:"writing_t2"},
  {id:"build", t:"Build a Sentence · precisión gramatical", skill:"otros", min:15, donde:"app", url:"priv:build", gap:"gramatica", total:40},
  {id:"r_test2", t:"Reading · pasaje Datecol 4.0 (20′)", skill:"reading", min:20, donde:"app", url:"priv:r_test2", gap:"reading_full", total:13},
  {id:"r_full", t:"Reading completo oficial · 3 pasajes 60′", skill:"reading", min:60, donde:"web",
   url:"https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test", gap:"reading_full", total:40, mock:true},
  {id:"l_full", t:"Listening oficial · 4 partes", skill:"listening", min:30, donde:"web",
   url:"https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test", gap:"listening", total:40, mock:true},
  {id:"l_escuchar", t:"Escuchar The Wonder Plant + shadowing", skill:"listening", min:15, donde:"portatil", gap:"listening",
   d:"En el portátil."},
  {id:"r_test1", t:"Reading · Wonder Plant (repetición)", skill:"reading", min:20, donde:"portatil", gap:"reading_full", total:13,
   d:"En el portátil."},
  {id:"tutoria", t:"Clase o ejercicio con tutora", skill:"speaking", min:60, donde:"portatil", gap:"speaking",
   d:"Clase con tutora o un ejercicio del plan de 6 semanas."},
  {id:"otro", t:"Otra práctica", skill:"otros", min:15, donde:"app"}
];
var ACT = {}; ACTS.forEach(function(a){ ACT[a.id] = a; });

/* Foco por día de la semana (0 = domingo). */
var FOCO = {1:"w_t2", 2:"s_p2", 3:"r_test2", 4:"l_full", 5:"w_t1", 6:"r_full", 0:"tarjetas"};

var PRESUPUESTOS = [
  {min:15, t:"15′ · metro", nota:"Sólo lo que se hace con el móvil y sin escribir mucho.", items:["tarjetas","s_p1"]},
  {min:30, t:"30′", nota:"Si sólo hay media hora, lectura con resumen: es lo que se acumula.", items:["lect"]},
  {min:45, t:"45′", nota:"Tarjetas y el foco del día.", items:["tarjetas","FOCO"]},
  {min:75, t:"75′ · núcleo", nota:"El núcleo diario: lectura, tarjetas y foco.", items:["lect","tarjetas","FOCO"]},
  {min:120, t:"2 h · producción", nota:"Día de producir: las dos tareas de Writing y una cue card.", items:["w_t1","w_t2","s_p2","tarjetas"]},
  {min:165, t:"2 h 45 · simulacro", nota:"Examen completo en orden real, sin pausas entre secciones.", items:["l_full","r_full","w_t1","w_t2","s_p2"]}
];

/* Writing Task 1 · datos de práctica inventados, no son estadísticas reales */
var T1 = [
  {id:"t1_linea", tipo:"line", t:"The graph below shows the percentage of electricity generated from renewable sources in three countries between 2000 and 2020.",
   x:[2000,2005,2010,2015,2020], y:"%", max:60, series:[["Country A",[12,15,22,35,48]],["Country B",[40,42,41,45,44]],["Country C",[5,6,14,20,33]]]},
  {id:"t1_barras", tipo:"bar", t:"The chart below shows the average number of hours per week that university students in one country spent on four activities in 2010 and 2020.",
   cats:["Study","Paid work","Social media","Sport"], y:"hours", max:25, series:[["2010",[22,8,6,5]],["2020",[18,11,14,3]]]},
  {id:"t1_tarta", tipo:"pie", t:"The pie charts below show how the budget of an average household in one city was divided in 1990 and 2020.",
   cats:["Housing","Food","Transport","Leisure","Other"], series:[["1990",[25,30,15,10,20]],["2020",[34,18,14,16,18]]]},
  {id:"t1_tabla", tipo:"table", t:"The table below shows the number of visitors (in thousands) to four science attractions in one city in 2015, 2020 and 2025.",
   cols:["2015","2020","2025"], rows:[["Planetarium",[320,95,410]],["Natural history museum",[510,160,480]],["Technology museum",[280,70,390]],["Botanic garden",[150,120,210]]]},
  {id:"t1_proceso", tipo:"process", t:"The diagram below shows how raw data from a telescope are turned into a published astronomical image.",
   steps:["Observation at night","Raw data stored","Calibration: remove noise","Exposures combined","Colours assigned to filters","Quality check","Image published"], back:[5,2]},
  {id:"t1_linea2", tipo:"line", t:"The graph below shows the number of international students enrolled at one university, by region of origin, from 2016 to 2024.",
   x:[2016,2018,2020,2022,2024], y:"students", max:450, series:[["Latin America",[120,150,210,260,330]],["Europe",[300,310,290,280,300]],["Asia",[200,260,340,300,420]]]}
];
var T2 = [
  {id:"t2_01", k:"Opinion", t:"Some people believe that university education should be free for everyone. To what extent do you agree or disagree?"},
  {id:"t2_02", k:"Opinion", t:"Governments should spend more money on solving problems on Earth than on space exploration. To what extent do you agree or disagree?"},
  {id:"t2_03", k:"Opinion", t:"Scientific research should be funded and controlled by governments rather than by private companies. To what extent do you agree or disagree?"},
  {id:"t2_04", k:"Opinion", t:"Working from home is more productive than working in an office. To what extent do you agree or disagree?"},
  {id:"t2_05", k:"Discuss both views", t:"Some people think children should start learning a foreign language at primary school, while others think it is better to start at secondary school. Discuss both views and give your own opinion."},
  {id:"t2_06", k:"Discuss both views", t:"Some people believe museums and science centres should be free to enter, while others think visitors should pay. Discuss both views and give your own opinion."},
  {id:"t2_07", k:"Discuss both views", t:"Some people think the best way to reduce traffic is to build more roads, while others believe investment in public transport is more effective. Discuss both views and give your own opinion."},
  {id:"t2_08", k:"Discuss both views", t:"Some people argue that artificial intelligence will create more jobs than it destroys. Others believe the opposite. Discuss both views and give your own opinion."},
  {id:"t2_09", k:"Problem and solution", t:"Light pollution in cities is increasing in many parts of the world. What are the causes of this problem, and what measures could be taken to reduce it?"},
  {id:"t2_10", k:"Problem and solution", t:"Many young scientists from developing countries move abroad to work. Why does this happen, and what can be done to encourage them to stay?"},
  {id:"t2_11", k:"Problem and solution", t:"Many people find it hard to concentrate for long periods because of smartphones. What problems does this cause, and how can they be solved?"},
  {id:"t2_12", k:"Advantages and disadvantages", t:"More and more students choose to study in another country. Do the advantages of this outweigh the disadvantages?"},
  {id:"t2_13", k:"Advantages and disadvantages", t:"Online courses are replacing traditional classroom teaching in many universities. Do the advantages of this development outweigh the disadvantages?"},
  {id:"t2_14", k:"Two-part question", t:"Many people now read summaries of books instead of the books themselves. Why is this? Is it a positive or negative development?"},
  {id:"t2_15", k:"Two-part question", t:"Many cities are growing very quickly. What problems does rapid urban growth create? What is the most effective way to deal with them?"},
  {id:"t2_16", k:"Two-part question", t:"Basic scientific research often has no immediate practical use. Why is it still important? Should governments fund it anyway?"}
];
var RES = [{id:"res_dw", t:"Deep Work: lee 20 minutos en el PDF de tu Drive, cierra el libro y resume de memoria. Estructura: tesis del autor → dos apoyos → una objeción o matiz → cierre explícito."}];

var P1 = [
  {id:"p1_estudios", t:"Your studies", q:["What do you study?","Why did you choose that subject?","What is the most difficult part of it?","Would you like to study abroad?"]},
  {id:"p1_ciudad", t:"Your hometown", q:["Where are you from?","What do you like most about your city?","How has it changed in recent years?","Would you like to live there in the future?"]},
  {id:"p1_lectura", t:"Reading", q:["Do you enjoy reading?","What kind of books do you read?","Do you prefer paper books or e-books?","Did you read a lot as a child?"]},
  {id:"p1_tecno", t:"Technology", q:["How often do you use your phone?","Has technology changed the way you study?","Is there an app you couldn't live without?","Do you think people spend too much time online?"]},
  {id:"p1_trabajo", t:"Work", q:["Do you work or are you a student?","What do you like about your job?","What would you change about it?","What job did you want as a child?"]},
  {id:"p1_cielo", t:"The night sky", q:["Do you like looking at the night sky?","Is it easy to see the stars where you live?","Did you enjoy science at school?","Would you like to visit an observatory?"]},
  {id:"p1_transporte", t:"Transport", q:["How do you usually travel around your city?","Do you like using public transport?","What would improve transport where you live?","Do you ever travel by bike?"]},
  {id:"p1_libre", t:"Free time", q:["What do you do in your free time?","Do you prefer spending time alone or with friends?","Has your free time changed since you were a teenager?","Is it important to have hobbies?"]}
];
var P2 = [
  {id:"p2_proyecto", t:"Describe a project you worked on that you are proud of.", b:["what the project was","who you worked with","what difficulties you faced","and explain why you are proud of it."],
   p3:["Is teamwork more important than individual talent?","Should universities teach students how to manage projects?","How do people measure success at work?"]},
  {id:"p2_libro", t:"Describe a book that changed the way you think.", b:["what the book was","when you read it","what it was about","and explain how it changed your thinking."],
   p3:["Do people read less than they used to?","Are book summaries enough to understand an idea?","Should schools make students read more?"]},
  {id:"p2_persona", t:"Describe a person who helped you learn something difficult.", b:["who the person was","what you learned","how they helped you","and explain why their help mattered."],
   p3:["What makes a good teacher?","Is learning online as effective as learning face to face?","Should adults keep studying throughout their lives?"]},
  {id:"p2_lugar", t:"Describe a place where you can concentrate well.", b:["where it is","how often you go there","what you do there","and explain why you can concentrate there."],
   p3:["Why is it harder to concentrate today?","Are open-plan offices a good idea?","Should phones be banned in classrooms?"]},
  {id:"p2_ciencia", t:"Describe a scientific discovery you find interesting.", b:["what the discovery was","when and how you learned about it","who made it","and explain why you find it interesting."],
   p3:["Should governments fund science that has no immediate use?","How can scientists explain their work to the public?","Do scientists have a responsibility for how their discoveries are used?"]},
  {id:"p2_explicar", t:"Describe a time you had to explain something complicated to someone.", b:["what you explained","who you explained it to","how you did it","and explain whether it worked."],
   p3:["Why do experts sometimes fail to communicate clearly?","What role do the media play in explaining science?","Are pictures better than words for explaining ideas?"]},
  {id:"p2_habilidad", t:"Describe a skill you would like to learn.", b:["what the skill is","why you want to learn it","how you would learn it","and explain how it would help you."],
   p3:["Which skills will be most useful in the future?","Is it better to learn from a teacher or on your own?","Do children learn skills more easily than adults?"]},
  {id:"p2_planes", t:"Describe a time when you had to change your plans.", b:["what the plan was","why you had to change it","what you did instead","and explain how you felt about the change."],
   p3:["Why do some people find change difficult?","Is it important to make long-term plans?","How can people prepare for unexpected events?"]},
  {id:"p2_tecno", t:"Describe a piece of technology you use every day.", b:["what it is","how long you have used it","what you use it for","and explain how your life would be different without it."],
   p3:["Has technology made people more or less productive?","Should older people be taught to use new technology?","What are the risks of depending on technology?"]},
  {id:"p2_ciudad", t:"Describe a city abroad where you would like to live in the future.", b:["where it is","how you know about it","what you would do there","and explain why you would like to live there."],
   p3:["Why do many young people move abroad?","How can countries keep their best professionals?","What is the hardest part of adapting to a new culture?"]},
  {id:"p2_meta", t:"Describe a goal you set and achieved.", b:["what the goal was","when you set it","what you did to achieve it","and explain how you felt when you achieved it."],
   p3:["Is it better to set small goals or big ones?","Do schools put too much pressure on students?","What stops people from reaching their goals?"]},
  {id:"p2_conversa", t:"Describe an interesting conversation you had with someone older than you.", b:["who the person was","where you had the conversation","what you talked about","and explain why it was interesting."],
   p3:["What can young people learn from older generations?","Do people talk less face to face than before?","Should families spend more time together?"]}
];

/* Las cuatro ramas de un curso equilibrado (Nation, 2007): tiempo parecido en cada una.
 * Cada actividad cuenta para una rama; la app propone la que va más baja. */
var RAMAS = {
  entrada:{t:"Entrada", d:"leer y escuchar para entender", color:"var(--s-reading)", acts:["lect","r_test2","r_full","r_test1","l_full","l_escuchar"], sugerir:"l_full"},
  produccion:{t:"Producción", d:"escribir y hablar con tus ideas", color:"var(--s-writing)", acts:["w_t1","w_t2","s_p1","s_p2","s_p3","tutoria"], sugerir:"w_t2"},
  forma:{t:"Forma", d:"vocabulario, gramática, expresiones", color:"var(--s-listening)", acts:["tarjetas","build","discurso"], sugerir:"build"},
  fluidez:{t:"Fluidez", d:"repetir lo conocido más rápido", color:"var(--s-speaking)", acts:["shadow"], sugerir:"shadow"}
};
var RAMA_DE = {}; Object.keys(RAMAS).forEach(function(r){ RAMAS[r].acts.forEach(function(a){ RAMA_DE[a] = r; }); });

/* Shadowing: frases modelo con las piezas que faltan en tu discurso (cierre, reparación,
 * contraste, consecuencia, hedging) y palabras que cuesta pronunciar. Se escuchan y se repiten. */
var SOMBRA = [
  {t:"Overall, the evidence suggests that the method works, although it has clear limitations.", k:"cierre + concesión"},
  {t:"Let me put that another way: the problem isn't the data, it's how we read it.", k:"reparación"},
  {t:"That's why I'd argue that funding basic research is a long-term investment.", k:"cierre"},
  {t:"To some extent, I agree, but it depends on how we define success.", k:"hedging"},
  {t:"What I mean is that small daily habits matter more than occasional effort.", k:"reparación"},
  {t:"In short, the benefits clearly outweigh the drawbacks.", k:"cierre"},
  {t:"Particularly in large cities, public transport is the most efficient option.", k:"pronunciación: particularly"},
  {t:"The number of international students has risen steadily since 2016.", k:"Task 1: tendencia"},
  {t:"Compared with 2010, students spent twice as much time on social media.", k:"Task 1: comparación"},
  {t:"I'm not entirely sure, but I'd say it happened around three years ago.", k:"sustituto de I don't know"},
  {t:"On the other hand, working from home can make it harder to switch off.", k:"contraste"},
  {t:"As a result, many young scientists decide to move abroad.", k:"consecuencia"},
  {t:"The point is that concentration is a skill, and it can be trained.", k:"cierre"},
  {t:"Having said that, I think there's a better way to deal with the problem.", k:"contraste"},
  {t:"Off the top of my head, I'd say the main reason is the cost.", k:"sustituto de I don't know"},
  {t:"This suggests that the trend will probably continue over the next decade.", k:"hedging"}
];
