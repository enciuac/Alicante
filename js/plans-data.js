export const DAYS = [
  { day: 1, label: "MIÉ 12", sub: "Llegada" },
  { day: 2, label: "JUE 13", sub: "Mar" },
  { day: 3, label: "VIE 14", sub: "Montaña" },
  { day: 4, label: "SÁB 15", sub: "Fiesta" },
  { day: 5, label: "DOM 16", sub: "Despedida" }
];

export const PLANS = [
  {
    slug: "dia1-calas", day: 1, title: "Calas del Cabo de la Huerta", tag: "Recomendado", tagClass: "reco", intensity: "🔥🔥",
    href: "planes/dia1-calas.html",
    description: "Primer baño del viaje en la Cala de la Palmera y ruta por las piscinas rocosas del cabo, con snorkel en aguas cristalinas a 10 minutos del centro. Al caer la tarde, subida al Castillo de Santa Bárbara para ver la bahía entera y cierre con tapas por El Barrio.",
    facts: ["Calas gratis · ascensor al castillo ~3 €", "Escarpines y snorkel imprescindibles", "Atardecer desde el castillo sobre las 21:10", "Cierre: ruta de tapas por el casco antiguo"]
  },
  {
    slug: "dia1-sup", day: 1, title: "SUP en Playa de San Juan", tag: "Alternativa activa", tagClass: "", intensity: "🔥🔥",
    href: "planes/dia1-sup.html",
    description: "Clase o alquiler de paddle surf en la gran playa de Alicante con las dos escuelas mejor valoradas de la ciudad (5,0★). Turno de tarde con el mar en calma, ruta remando hacia el Cabo de la Huerta y cerveza en la arena al terminar.",
    facts: ["Clase ~25–35 € pp · alquiler ~15–20 €/h", "Turnos de 17:00 a 21:00, perfectos tras el viaje", "Aguas tranquilas: nivel principiante sin problema", "Combinable con el castillo al atardecer"]
  },
  {
    slug: "dia1-relax", day: 1, title: "Postiguet & casco antiguo", tag: "Modo tranquilo", tagClass: "", intensity: "🔥",
    href: "planes/dia1-relax.html",
    description: "El plan sin coche: playa urbana a pie de hotel, horchata en la Explanada, callejeo por el barrio de Santa Cruz con sus casitas de colores y ruta del vermú y las tapas por El Barrio. Para aterrizar sin prisas y guardar energía para lo que viene.",
    facts: ["0 € en entradas · todo andando", "Mirador de Santa Cruz a la hora dorada", "Tapeo: Calle Labradores y Plaza Santísima Faz"]
  },
  {
    slug: "dia1-catamaran", day: 1, title: "Catamarán al atardecer", tag: "Plan con encanto", tagClass: "", intensity: "🔥",
    href: "planes/dia1-catamaran.html",
    description: "Paseo en catamarán de vela por la bahía de Alicante justo a la hora dorada: la ciudad, el Castillo de Santa Bárbara y la Sierra Grossa desde el mar, con música a bordo y una copa en la mano. El plan perfecto para aterrizar sin prisas tras el viaje.",
    facts: ["~20–25 € pp · salidas al atardecer desde el puerto", "Sin experiencia previa: tripulación se encarga de todo", "~1,5–2 h a bordo · barra de bebidas incluida o de pago", "Combinable con tapas por El Barrio al desembarcar"]
  },

  {
    slug: "dia2-motos", day: 2, title: "Motos de agua hasta Tabarca", tag: "Recomendado", tagClass: "reco", intensity: "🔥🔥🔥🔥",
    href: "planes/dia2-motos.html",
    description: "Excursión guiada de 2 horas en moto de agua desde el puerto de Alicante hasta la isla de Tabarca con MjA Marina Jets (4,9★, casi 2.000 reseñas). Dos por moto turnándoos al volante, parada de baño en la reserva marina y regreso a toda máquina.",
    facts: ["~190 €/moto la ruta completa (2 motos para los 4)", "Sin licencia: van con guía y briefing incluido", "Reservar YA: los turnos de agosto vuelan", "Después: paella frente al mar en Casa Julio"]
  },
  {
    slug: "dia2-kayak", day: 2, title: "Kayak por el Cabo de la Huerta", tag: "Alternativa kayak", tagClass: "", intensity: "🔥🔥🔥",
    href: "planes/dia2-kayak.html",
    description: "Dos kayaks dobles bordeando la costa más bonita de Alicante ciudad, con paradas de snorkel en las piscinas naturales del cabo y en la Cala de la Palmera. El mismo escenario que las motos por una fracción del precio, y con carrera de vuelta garantizada.",
    facts: ["Kayak doble ~15–25 €/h en Playa de San Juan", "Salida antes de las 10: mar como un plato", "Bidón estanco para móviles incluido si lo pedís", "Snorkel con la mejor visibilidad de la ciudad"]
  },
  {
    slug: "dia2-combo", day: 2, title: "Combo: jet ski + parasailing", tag: "Full adrenalina", tagClass: "adrenalina", intensity: "🔥🔥🔥🔥🔥",
    href: "planes/dia2-combo.html",
    description: "Dos subidones en una mañana: sesión de 30 minutos de moto de agua por la bahía y después vuelo en parasailing por parejas a 50 metros de altura, con Alicante entera a vista de gaviota. Despegue y aterrizaje suaves desde la plataforma del barco.",
    facts: ["Jet ski ~60–70 €/moto · parasailing ~50–60 € pp", "Rotáis en dos grupos: todos hacen todo", "Primera hora = viento estable para volar", "Pedid precio de grupo al reservar los 4"]
  },
  {
    slug: "dia2-flyboard", day: 2, title: "Flyboard: vuela sobre el agua", tag: "Prueba algo nuevo", tagClass: "", intensity: "🔥🔥🔥🔥",
    href: "planes/dia2-flyboard.html",
    description: "Sesión de flyboard en el puerto de Alicante: botas propulsadas por chorro de agua que os elevan varios metros sobre el mar, con instructor en lancha de apoyo todo el rato. Se aprende rápido y las fotos/vídeo desde el barco son el mejor recuerdo del viaje.",
    facts: ["~50–60 € por sesión de 20–30 min", "Sin experiencia: briefing en tierra + prueba en el agua", "Turnos de mañana: mar en calma, mejor equilibrio", "Muchas escuelas graban vídeo/fotos incluido"]
  },

  {
    slug: "dia3-granadella", day: 3, title: "Granadella modo playa", tag: "Recomendado", tagClass: "reco", intensity: "🔥🔥🔥",
    href: "planes/dia3-granadella.html",
    description: "Madrugón para coronar los 332 metros del Peñón de Ifach (túnel en la roca, cuerdas fijas y la mejor panorámica de la Costa Blanca) y premio por la tarde en la Granadella: agua turquesa, snorkel junto a los acantilados y comida en el chiringuito de la propia cala.",
    facts: ["Registro online del Peñón el día ANTES (gratis)", "~2 h de subida y bajada · calzado con agarre", "Parking de la cala lleno = bus lanzadera 5 €", "Mejor snorkel: acantilado izquierdo de la cala"]
  },
  {
    slug: "dia3-kayak-cuevas", day: 3, title: "Kayak por cuevas marinas", tag: "Kayak épico", tagClass: "adrenalina", intensity: "🔥🔥🔥🔥",
    href: "planes/dia3-kayak-cuevas.html",
    description: "Mismo Peñón por la mañana y por la tarde la joya del viaje: ruta guiada de 3 horas en kayak entrando en la Cova del Llop Marí (un túnel marino de agua azul eléctrico), la cala virgen de Ambolo y la catedral de piedra de la Cova dels Òrguens, con snorkel en cuevas.",
    facts: ["~35–45 € pp con guía, material y fotos", "Kayak Granadella: 5,0★ perfecto (183 reseñas)", "Reservad turno de tarde (16:00) con 3–4 días", "Día exigente: senderismo + 3 h de remo"]
  },
  {
    slug: "dia3-calpe", day: 3, title: "Kayak libre en Calpe", tag: "Opción cercana", tagClass: "", intensity: "🔥🔥",
    href: "planes/dia3-calpe.html",
    description: "Todo el día sin salir de Calpe: cima del Peñón por la mañana, pescado fresco en el puerto, siesta en La Fossa y por la tarde kayak o SUP remando bajo la pared norte de la mole que acabáis de subir, con parada de snorkel en la Cala del Racó.",
    facts: ["Alquiler ~12–20 €/h · Surf Riders u Olas de Zen (4,9★)", "Menos coche: solo ida y vuelta a Calpe", "Preguntad por el viento antes de salir a remar", "La Cala del Racó: el mejor snorkel de Calpe"]
  },
  {
    slug: "dia3-calas-salvajes", day: 3, title: "Calas salvajes de Benitatxell", tag: "Épico · salvaje", tagClass: "epic", intensity: "🔥🔥🔥🔥",
    href: "planes/dia3-calas-salvajes.html",
    description: "Lo más salvaje que aún se camina con dos piernas: la Cala del Moraig al pie de un acantilado de 100 m, la Cova dels Arcs (cueva marina de agua azul eléctrico) y la Ruta dels Penya-segats, un sendero de vértigo sobre el mar hasta la escondida Cala Llebeig, sin un solo edificio a la vista. Aguas turquesa, cero hormigón y las vistas del viaje.",
    facts: ["Calas y sendero gratis · parking Moraig ~12–15 €", "Senderismo real: ~2 km de acantilado + descenso", "Cueva marina + snorkel + cala virgen a pie", "Calzado de trekking y 2 L de agua por cabeza"]
  },

  {
    slug: "dia4-rafting", day: 4, title: "Rafting · Río Segura", tag: "Rafting", tagClass: "adrenalina", intensity: "🔥🔥🔥🔥",
    href: "planes/dia4-rafting.html",
    description: "Descenso de 3 horas y 8 km por el cañón del Segura: rápidos, saltos desde la balsa, guerra de agua entre botes y el gran final saltando un azud. Rafting Murcia (4,8★) incluye picnic y todas las fotos.",
    facts: ["~25–30 € pp con guía, equipo, picnic y fotos", "A 80 km (1 h de autovía) — dentro del radio", "Primer turno para llegar sobrados a la noche", "Vuelta a las 14:30: comida + siesta pre-fiesta"]
  },
  {
    slug: "dia4-aqualandia", day: 4, title: "Aqualandia (parque acuático)", tag: "Diversión total", tagClass: "", intensity: "🔥🔥🔥",
    href: "planes/dia4-aqualandia.html",
    description: "Mañana de toboganes gigantes, piscina de olas y río lento en el parque acuático más veterano de España, encaramado en la Sierra Helada de Benidorm. Diversión pura sin salir de la ciudad de la fiesta: parque de día, tardeo y noche encadenados.",
    facts: ["~30 € entrada (más barata online)", "Toboganes fuertes nada más abrir, sin cola", "Llevad nevera: la comida de dentro es cara", "Ya estáis en Benidorm para la noche: 0 coche"]
  },
  {
    slug: "dia4-algar", day: 4, title: "Fuentes del Algar", tag: "Clásico verano", tagClass: "reco", intensity: "🔥🔥🔥",
    href: "planes/dia4-algar.html",
    description: "Cascadas, pasarelas y pozas de agua de manantial a 18 °C con zona de saltos, a 15 min de Benidorm. El chapuzón helado que resucita a cualquiera y deja el cuerpo a punto para el tardeo.",
    facts: ["Entrada ~8 € · abierto de 9:00 a 20:00", "En taquilla o online en <a href=\"https://www.lasfuentesdelalgar.com\" target=\"_blank\" rel=\"noopener\">lasfuentesdelalgar.com</a>", "Escarpines innegociables: todo es piedra de río", "A 15 min del tardeo: logística redonda"]
  },
  {
    slug: "dia4-levante", day: 4, title: "Playa Levante & tardeo", tag: "Reserva de energía", tagClass: "", intensity: "🔥",
    href: "planes/dia4-levante.html",
    description: "La estrategia del maratoniano: mañana de toalla en la playa más famosa del Mediterráneo, comida en el paseo, siesta táctica y toda la energía intacta para empezar el tardeo antes que nadie y cerrar Insomnia a las 5:00.",
    facts: ["0 € en entradas · hamacas ~5–6 €", "Cero madrugón, cero coche extra", "Sitio en la arena antes de las 10:30 o nada", "Siesta de 15:30 a 17:00: la clave de la noche"]
  },

  {
    slug: "dia5-barco", day: 5, title: "Barco + snorkel libre", tag: "Recomendado", tagClass: "reco", intensity: "🔥",
    href: "planes/dia5-barco.html",
    description: "Ferry de 25 minutos desde Santa Pola a la única isla habitada de la Comunitat: pueblo amurallado de pescadores, vuelta a la isla a pie huyendo de la multitud y snorkel en la primera reserva marina de España, con visibilidad de 15–20 metros.",
    facts: ["~10–12 € ida y vuelta · barcos cada hora", "Taquillas en el puerto de Santa Pola, sin reserva", "Mejor snorkel: calas rocosas del sureste", "Ojo al horario del último barco de vuelta"]
  },
  {
    slug: "dia5-kayak", day: 5, title: "Kayak + snorkel en Tabarca", tag: "Última remada", tagClass: "", intensity: "🔥🔥🔥",
    href: "planes/dia5-kayak.html",
    description: "Excursión organizada desde Santa Pola con Tabarca Online (4,6★): travesía en barco, ruta en kayak bordeando calas a las que no llega nadie a pie y snorkel guiado por monitores que os van señalando la vida de la reserva: posidonia, nacras y bancos de peces.",
    facts: ["~35–45 € pp · mañana completa (3–4 h)", "Instructores muy valorados en las reseñas", "Reservar 2–3 días antes por WhatsApp", "Solo si la noche del sábado fue moderada 😅"]
  },
  {
    slug: "dia5-chill", day: 5, title: "Chill total en Alicante", tag: "Modo supervivencia", tagClass: "", intensity: "🔥",
    href: "planes/dia5-chill.html",
    description: "El plan de contingencia oficial: si el sábado se alargó hasta ver amanecer, mañana de flotar en el Postiguet, café doble en la Explanada, paseo de resurrección por el puerto y directos al arroz. Todo en un radio de 15 minutos andando y nadie os juzgará.",
    facts: ["0 € en entradas · cero coche, cero horarios", "Hamacas del Postiguet: los 6 € mejor invertidos", "Rehidratación + arroz = resurrección"]
  },
  {
    slug: "dia5-buceo", day: 5, title: "Bautismo de buceo en Tabarca", tag: "Para ir más al fondo", tagClass: "", intensity: "🔥🔥",
    href: "planes/dia5-buceo.html",
    description: "Para quien quiera algo más que snorkel: bautismo de buceo con botella en la primera reserva marina de España, con instructor en todo momento. Praderas de posidonia, meros y bancos de peces a 5–8 metros, sin necesidad de titulación previa.",
    facts: ["~60–75 € pp con equipo, instructor y seguro incluido", "No hace falta saber bucear: teoría breve + inmersión guiada", "Salida en barco desde Santa Pola, mañana completa", "Reservar con antelación: plazas limitadas por grupo"]
  }
];
