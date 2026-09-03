import Image from "next/image";
import type { ReactNode } from "react";

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-slate-300">{children}</p>;
}

function Subheading({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-xl font-extrabold text-white">{children}</h2>;
}

function ImageCard({ src, alt, width, height, caption, compact = false }: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  compact?: boolean;
}) {
  return (
    <figure className={`overflow-hidden rounded-2xl border border-white/10 bg-white p-3 ${compact ? "mx-auto max-w-xs" : ""}`}>
      <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full object-contain" />
      <figcaption className="mt-3 px-1 text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

function DefinitionGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([term, description]) => (
        <div key={term} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
          <dt className="mono text-xs font-bold text-sky-300">{term}</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-300">{description}</dd>
        </div>
      ))}
    </dl>
  );
}

function RadioSection({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
      <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-sky-300">{title}</h3>
      <div className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <p key={`${title}-${index}`} className="font-mono text-sm leading-6 text-slate-300">{line}</p>
        ))}
      </div>
    </section>
  );
}

export default function PilotModuleContentSynced({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <Paragraph>Antes de iniciar cualquier vuelo, es fundamental conocer las condiciones meteorológicas. Para ello, se utiliza principalmente el METAR y el ATIS.</Paragraph>
        <Paragraph>El METAR es un informe meteorológico que indica viento, visibilidad, nubes, temperatura y QNH. El ATIS es un mensaje automático que informa las condiciones actuales y la pista activa.</Paragraph>
        <Paragraph>QNH representa la presión atmosférica al nivel del aeródromo. Ajustar el altímetro al QNH permite leer la altitud sobre el nivel medio del mar (MSL).</Paragraph>
        <Paragraph>QNE corresponde a la presión estándar (1013 hPa), utilizada por encima de la altitud de transición. El cambio entre QNH y QNE se realiza en la altitud de transición (TA) y el nivel de transición (TL).</Paragraph>
        <Subheading>Ejemplo de METAR</Subheading>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 font-mono text-sm text-sky-200">EGKK 121350Z 23012KT 9999 FEW030 17/10 Q1015</div>
        <Paragraph>Esto indica: Aeropuerto Gatwick (EGKK), día 12 hora 13:50Zulu (utc), viento 230° a 12 nudos, visibilidad mayor a 10 km, nubes dispersas a 3000 pies, temperatura 17°C punto de roció 10, QNH 1015.</Paragraph>
        <ImageCard src="/academy/piloto/pe/metar.webp" alt="Ejemplo visual del METAR EGKK 121350Z 23012KT 9999 FEW030 17/10 Q1015" width={700} height={119} caption="Ejemplo visual de los grupos que componen un METAR." />
        <Subheading>Conceptos</Subheading>
        <DefinitionGrid items={[
          ["RA", "lluvia"],
          ["RESH/SH", "lluvia chubasco"],
          ["DZ", "Llovizna"],
          ["SN", "Nieve"],
          ["BR", "Neblina"],
          ["FG", "Niebla"],
          ["TS", "Tormenta"],
          ["FEW", "Escasas"],
          ["SCT", "Nubes dispersas"],
          ["BKN", "Nubes rotas"],
          ["OVC", "Cielo cubierto"],
          ["SKC", "Cielo despejado"],
          ["NSC", "Nubes no significativas"],
          ["CB", "Cumulonimbus"],
          ["TCU", "Cumulonimbus vertical"],
        ]} />
      </div>
    );
  }

  if (moduleNumber === 2) {
    return (
      <div className="space-y-6">
        <Paragraph>La altimetría es el sistema que permite conocer la altitud de la aeronave. Se basa en la presión atmosférica, que disminuye con la altura.</Paragraph>
        <Paragraph>Un ajuste incorrecto del altímetro puede provocar errores en la altitud real, lo que representa un riesgo de separación con otras aeronaves o el terreno.</Paragraph>
        <Paragraph>Durante el vuelo en circuito visual, se utiliza QNH local para asegurar que la lectura altimétrica corresponda a la altitud sobre el nivel del mar.</Paragraph>
        <Paragraph>El piloto estudiante debe saber cómo ajustar el altímetro correctamente antes de despegar.</Paragraph>
        <Subheading>Transformación de pies a nivel de vuelo</Subheading>
        <DefinitionGrid items={[
          ["1000ft (pies)", "010"],
          ["2000ft", "020"],
          ["5000ft", "050"],
          ["10000ft", "100"],
          ["25000ft", "250"],
        ]} />
        <Paragraph>Toda altitud por encima del Transición Altittude (TA) local de un aeródromo debe ser leído y pronunciado como nivel de vuelo, toda altitud que se encuentre por debajo en pies.</Paragraph>
        <Subheading>Ejemplo</Subheading>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-5 font-mono text-sm leading-7 text-slate-300">
          <div>TA: 2000ft</div>
          <div>1000ft = mil pies</div>
          <div>3000ft = cero tres cero (030)</div>
        </div>
      </div>
    );
  }

  if (moduleNumber === 3) {
    return (
      <div className="space-y-6">
        <Paragraph>Las cartas de rodaje (taxi charts) permiten conocer la distribución de calles de rodaje, posiciones de estacionamiento, puntos de espera y pistas.</Paragraph>
        <Paragraph>Es fundamental comprenderlas para desplazarse de forma segura y ordenada por el aeródromo. Antes de iniciar el rodaje, el piloto debe revisar la pista activa, identificar la ruta de rodaje y confirmar su autorización con ATC.</Paragraph>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm font-semibold text-amber-200">Nunca debe ingresar a la pista sin autorización explícita.</div>
        <Subheading>Alfabeto fonético</Subheading>
        <ImageCard src="/academy/piloto/pe/alfabeto-fonetico.webp" alt="Alfabeto fonético ICAO de Alfa a Zulu" width={600} height={291} caption="Alfabeto fonético utilizado en comunicaciones aeronáuticas." />
        <Subheading>Ejemplo carta de rodaje</Subheading>
        <ImageCard src="/academy/piloto/pe/carta-rodaje-mdst.webp" alt="Carta de rodaje de MDST Santiago con pista 11/29 y calles Alfa y Bravo" width={700} height={394} caption="Ejemplo de carta de rodaje de Santiago / MDST." />
      </div>
    );
  }

  if (moduleNumber === 4) {
    return (
      <div className="space-y-6">
        <Paragraph>Existen dos grandes formas de volar:</Paragraph>
        <DefinitionGrid items={[
          ["VFR (Visual Flight Rules)", "el piloto mantiene referencia visual con el terreno y otras aeronaves, volando solo en condiciones meteorológicas adecuadas."],
          ["IFR (Instrument Flight Rules)", "la navegación y control de la aeronave se realizan principalmente con instrumentos, incluso sin visibilidad exterior."],
        ]} />
        <Paragraph>En la licencia PE, únicamente se permiten vuelos bajo reglas VFR, en condiciones meteorológicas adecuadas y en zonas designadas para instrucción.</Paragraph>
        <Subheading>Reglas secundarias</Subheading>
        <DefinitionGrid items={[
          ["ZFR", "Vuelo con salida VFR y llegada IFR."],
          ["YFR", "Vuelo con salida IFR y llegada VFR."],
        ]} />
      </div>
    );
  }

  if (moduleNumber === 5) {
    return (
      <div className="space-y-6">
        <Paragraph>Un circuito de tránsito es una trayectoria rectangular estándar que permite a las aeronaves realizar despegues y aterrizajes ordenadamente.</Paragraph>
        <Paragraph>Este circuito se compone de varios tramos: viento en cara (despegue), viento cruzado, viento en cola, tramo base y final. También se considera la final corta, que corresponde a la parte final del tramo de aproximación.</Paragraph>
        <ImageCard src="/academy/piloto/pe/circuito-transito.webp" alt="Diagrama de circuito de tránsito con viento en cara, viento cruzado, viento en cola, base y final" width={593} height={351} caption="Tramos principales de un circuito de tránsito aeronáutico." />
        <Paragraph>Por norma general, los circuitos se realizan por el lado izquierdo de la pista, salvo que el aeródromo establezca lo contrario.</Paragraph>
        <Paragraph>Durante el circuito, el piloto debe mantener altitudes y trayectorias establecidas, reportando en cada tramo según lo indique ATC.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 6) {
    return (
      <div className="space-y-6">
        <Paragraph>En PF24, todo vuelo debe ir acompañado de un plan de vuelo, incluso si es un circuito local. Esto permite que ATC mantenga un control adecuado del tránsito y pueda coordinar la secuencia de despegues y aterrizajes.</Paragraph>
        <Subheading>Contenido de cada campo</Subheading>
        <DefinitionGrid items={[
          ["Callsign", "Indicativo de llamada de la aeronave."],
          ["Callsing en Juego", "Indicativo personalizado (opcional)"],
          ["Aeronave", "Aeronave utilizada en el vuelo."],
          ["Reglas de vuelo", "VFR/IFR/ZFR/YFR."],
          ["Salida", "ICAO del aeropuerto de salida."],
          ["Llegada", "ICAO del aeropuerto de llegada."],
          ["Alterno", "ICAO de aeropuerto alterno."],
          ["Velocidad crucero", "Velocidad que se mantendrá en la etapa de crucero."],
          ["Duración del combustible", "Combustible a bordo."],
          ["Matrícula", "Registro de la aeronave."],
          ["Ruta", "Ruta seguida en el vuelo."],
          ["FL", "Nivel de vuelo utilizado."],
          ["Notas adicionales", "Información que desea añadir el piloto."],
        ]} />
        <Subheading>Ejemplo de vuelo local</Subheading>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 font-mono text-sm leading-7 text-slate-300">
          <div>Callsign: G-JDTB</div>
          <div>Callsing en Juego: G-JDTB</div>
          <div>Aeronave: C152</div>
          <div>Reglas de vuelo: VFR</div>
          <div>Salida: MDST</div>
          <div>Llegada: MDST</div>
          <div>Alterno: MDAB</div>
          <div>Velocidad crucero: 100</div>
          <div>Duración del combustible: 02.15</div>
          <div>Matrícula: LV-DTB</div>
          <div>Ruta: LCL</div>
          <div>FL: 015</div>
          <div>Notas adicionales: Vuelo de ejemplo.</div>
        </div>
        <ImageCard src="/academy/piloto/pe/plan-vuelo-local.webp" alt="Ejemplo de plan de vuelo local" width={199} height={200} caption="Ejemplo visual de un plan de vuelo local." compact />
      </div>
    );
  }

  if (moduleNumber === 7) {
    return (
      <div className="space-y-6">
        <Paragraph>El uso correcto de las luces es fundamental para la seguridad en tierra y en vuelo, especialmente durante operaciones nocturnas o de baja visibilidad.</Paragraph>
        <Subheading>Tipos de luces</Subheading>
        <DefinitionGrid items={[
          ["NAV (Navigation)", "indican la posición de la aeronave. Rojo (ala izquierda), verde (ala derecha) y blanco (cola). Siempre encendidas durante el vuelo."],
          ["LOGO", "iluminan el logo de la cola. Se utilizan normalmente de noche en tierra o vuelo bajo."],
          ["BEACON", "luz roja intermitente, se enciende antes de arrancar motores y se apaga al apagarlos. Indica que la aeronave está activa."],
          ["TAXI", "se usan durante el rodaje en tierra para iluminar el camino."],
          ["STROBE", "luces blancas intermitentes en las puntas de las alas. Se encienden al ingresar a pista y se apagan al salir."],
          ["LANDING", "luces potentes utilizadas para despegue, ascenso inicial y aterrizaje."],
        ]} />
        <Paragraph>Un correcto uso de las luces mejora la visibilidad y evita riesgos de colisión con otras aeronaves o vehículos en plataforma.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 8) {
    return (
      <div className="space-y-6">
        <Paragraph>Durante el vuelo pueden presentarse situaciones no previstas como fallas técnicas, pérdida de comunicaciones o cambios meteorológicos. El piloto estudiante debe saber mantener la calma, priorizar la seguridad y seguir procedimientos básicos.</Paragraph>
        <Paragraph>Si ocurre una falla, se debe notificar inmediatamente a ATC si es posible. Si se pierde comunicación, se debe continuar en circuito visual hasta poder aterrizar con seguridad o recibir instrucciones por otra vía.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 9) {
    return (
      <div className="space-y-6">
        <Paragraph>La fraseología es el lenguaje estándar utilizado para comunicarse con el control de tránsito aéreo (ATC).</Paragraph>
        <Paragraph>Su objetivo es transmitir información de manera clara, breve y sin ambigüedades.</Paragraph>
        <Paragraph>Un piloto PE debe conocer las frases básicas necesarias para realizar rodajes, despegues y notificaciones de posición en el circuito.</Paragraph>
        <Subheading>Conceptos</Subheading>
        <DefinitionGrid items={[
          ["Callsign", "Identificador único para una aeronave, utilizado para la comunicación por radio con el control de tránsito aéreo y otros pilotos. Ejemplo: G-JDTB / LV-ART"],
          ["Colación", "Es el procedimiento de repetición de un mensaje importante por parte del receptor (piloto o torre) para confirmar que lo ha recibido correctamente, asegurando que la comunicación es exacta y evitando errores que puedan poner en riesgo la seguridad."],
        ]} />
        <RadioSection title="Prueba de radio / contacto inicial con superficie" lines={[
          "Santiago superficie, G-JDTB, prueba de radio.",
          "G-JDTB, Santiago superficie, le recibo cinco de cinco, prosiga.",
          "G-JDTB buenos días, un vuelo visual local, con información Charlie a bordo, listo a copiar autorización.",
          "G-JDTB mantenga escucha.",
          "Mantengo escucha, G-JDTB.",
        ]} />
        <RadioSection title="Autorización de plan de vuelo" lines={[
          "G-JDTB está autorizado vuelo VFR local desde Santiago, salida y llegada Santiago, ruta local, mantenga mil pies, transpondedor 1203.",
          "Autorizado vuelo VFR local, salida y llegada Santiago, mil pies, transpondedor 1203, G-JDTB.",
          "G-JDTB colación correcta, notifique listo para puesta en marcha.",
          "Notificaré listo para puesta en marcha, G-JDTB.",
        ]} />
        <RadioSection title="Puesta en marcha y retroceso" lines={[
          "Santiago superficie, G-JDTB listo para puesta en marcha.",
          "G-JDTB puesta en marcha aprobada, notifique listo para rodar.",
          "Puesta en marcha aprobada, notifico listo para rodar, G-JDTB.",
        ]} />
        <RadioSection title="Rodaje" lines={[
          "Santiago superficie, G-JDTB listo para rodaje.",
          "G-JDTB ruede vía Alfa y mantenga punto de espera pista 11.",
          "Rodamos vía Alfa al punto de espera pista 11, G-JDTB.",
          "Santiago superficie, G-JDTB en punto de espera pista 11.",
          "G-JDTB contacte Santiago torre 118.3.",
          "A torre 118.3, G-JDTB.",
        ]} />
        <RadioSection title="Torre — autorización de despegue" lines={[
          "Santiago torre, G-JDTB en punto de espera pista 11, listo para salida.",
          "G-JDTB, Santiago torre, viento 120/08 nudos, autorizado a despegar pista 11, circuito izquierdo, en el aire notifique.",
          "Autorizado a despegar pista 11, circuito izquierdo, notificamos en el aire, G-JDTB.",
        ]} />
        <RadioSection title="Despegue y circuito" lines={[
          "Santiago torre, G-JDTB en el aire.",
          "G-JDTB recibido, notifique viento en cola.",
          "Santiago torre, G-JDTB viento en cola.",
          "G-JDTB notifique base.",
          "Notificaré base, G-JDTB.",
          "Santiago torre, G-JDTB base.",
          "G-JDTB notifique en final.",
          "Notificamos en final, G-JDTB",
          "Santiago torre, G-JDTB final pista 11.",
          "G-JDTB viento 120/08 nudos, autorizado aterrizar pista 11.",
          "Autorizado aterrizar pista 11, G-JDTB.",
        ]} />
        <RadioSection title="Aterrizaje y salida de pista" lines={[
          "Santiago torre, G-JDTB pista libre por Alfa.",
          "G-JDTB ruede a plataforma por Alfa, contacte superficie 121.9.",
          "Rodamos a plataforma por Alfa, a 121.9, G-JDTB.",
        ]} />
        <RadioSection title="En superficie — rodaje a plataforma" lines={[
          "Santiago superficie, G-JDTB pista libre por Alfa, rodando a plataforma.",
          "G-JDTB proseguido hasta estacionamiento general 3.",
          "A estacionamiento general 3, G-JDTB.",
        ]} />
        <RadioSection title="Corte de motores" lines={[
          "Santiago superficie, G-JDTB en estacionamiento general 3, motores fuera.",
          "G-JDTB recibido, plan de vuelo finalizado minuto 25 de la hora, contacte unicom 122.800, buen día.",
          "Contactamos unicom 122.800, G-JDTB ,gracias por el control.",
        ]} />
      </div>
    );
  }

  if (moduleNumber === 10) {
    return (
      <div className="space-y-6">
        <Paragraph>Para obtener la licencia PE, el piloto deberá aprobar una evaluación teórica basada en este temario y demostrar en un vuelo supervisado que comprende los procedimientos básicos de circuito visual.</Paragraph>
        <Paragraph>Esto incluye comunicaciones claras, correcta interpretación de información meteorológica, uso apropiado de altímetro, conocimiento de las etapas del circuito, uso de luces y manejo ante imprevistos.</Paragraph>
      </div>
    );
  }

  return null;
}
