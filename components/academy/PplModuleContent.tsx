import type { ReactNode } from "react";

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-slate-300">{children}</p>;
}

function Subheading({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-xl font-extrabold text-white">{children}</h2>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm leading-6 text-slate-300">
      {items.map((item) => <li key={item} className="flex gap-3"><span className="text-sky-300">•</span><span>{item}</span></li>)}
    </ul>
  );
}

function Example({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 font-mono text-sm leading-6 text-sky-200">{children}</div>;
}

export default function PplModuleContent({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <Paragraph>Las operaciones VFR constituyen la base de la navegación visual. Un piloto PPL debe dominar los conceptos de planificación, referencia visual y control de la posición geográfica.</Paragraph>

        <Subheading>Referencias visuales</Subheading>
        <Paragraph>Carreteras, ríos, montañas, ciudades y costas son puntos clave para mantener la orientación. Se recomienda planificar con cartas VFR actualizadas, marcando hitos visuales reconocibles.</Paragraph>

        <Subheading>Limitaciones</Subheading>
        <Paragraph>Los vuelos VFR deben realizarse únicamente en condiciones meteorológicas visuales (VMC). La visibilidad mínima debe ser de 5 km, y el piloto debe mantener separación visual con el terreno y otras aeronaves.</Paragraph>

        <Subheading>Alturas mínimas</Subheading>
        <BulletList items={[
          "Sobre áreas pobladas, se debe mantener al menos 1000 pies sobre el obstáculo más alto dentro de un radio de 600 m.",
          "En zonas despobladas, el mínimo es 500 pies AGL.",
        ]} />

        <Subheading>Planificación de ruta</Subheading>
        <Paragraph>Se deben establecer puntos de notificación visual (VRPs) y tiempos estimados entre ellos. El piloto deberá calcular consumo de combustible, altitudes seguras y posibles alternos.</Paragraph>
        <Paragraph>En vuelo, se recomienda mantener una vigilancia constante del horizonte y verificar la posición con referencias visuales cada 10-15 minutos.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 2) {
    return (
      <div className="space-y-6">
        <Paragraph>Todo vuelo, ya sea VFR o IFR, debe estar precedido por una planificación completa.</Paragraph>

        <Subheading>El plan de vuelo debe incluir</Subheading>
        <BulletList items={[
          "Ruta.",
          "Puntos de notificación.",
          "Nivel.",
          "Alternos.",
          "Combustible mínimo y estimado.",
          "Datos meteorológicos.",
        ]} />

        <Paragraph>El piloto debe saber interpretar NOTAMs, TAFs y METARs para conocer el estado del aeródromo y las condiciones del trayecto. Además, deberá ajustar altitudes conforme a la altimetría y el tipo de vuelo.</Paragraph>
        <Paragraph>En caso de vuelos IFR, el plan debe incluir la aerovía prevista, puntos de entrada y salida, y procedimientos de aproximación esperados.</Paragraph>
        <Paragraph>En vuelos VFR, debe indicarse claramente la intención de ruta visual y los puntos de reporte.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 3) {
    return (
      <div className="space-y-6">
        <Paragraph>Las reglas IFR permiten volar sin referencia visual exterior, guiándose exclusivamente por los instrumentos de a bordo y la asistencia del control de tránsito aéreo.</Paragraph>
        <Paragraph>El piloto PPL deberá comprender los conceptos básicos de SIDs (Salidas Instrumentales Estandarizadas) y STARs (Llegadas Instrumentales Estandarizadas), así como su lectura en las cartas aeronáuticas.</Paragraph>

        <Subheading>Altimetría avanzada</Subheading>
        <Paragraph>Conocer la diferencia entre TA (Transition Altitude) y TL (Transition Level), aplicando correctamente QNH y QNE según el nivel de vuelo.</Paragraph>

        <Subheading>Vectores radar</Subheading>
        <Paragraph>Son instrucciones de rumbo proporcionadas por ATC para guiar al piloto hacia un punto o procedimiento de aproximación. El piloto debe confirmar cada vector recibido y seguirlo con precisión.</Paragraph>

        <Subheading>Aproximaciones instrumentales</Subheading>
        <BulletList items={[
          "ILS (Instrument Landing System): guía precisa en eje y pendiente.",
          "RNAV/RNP: aproximaciones basadas en navegación satelital.",
          "VOR/NDB: procedimientos basados en radioayudas convencionales.",
        ]} />
        <Paragraph>Durante una aproximación IFR, se deben seguir fielmente los mínimos publicados. Si no se logra contacto visual con la pista en el punto de decisión, se deberá ejecutar el procedimiento de frustrada (go-around).</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 4) {
    return (
      <div className="space-y-6">
        <Paragraph>Las radioayudas son sistemas terrestres que permiten determinar posición y rumbo.</Paragraph>
        <BulletList items={[
          "NDB (Non-Directional Beacon): transmite en frecuencia baja/mediana, usada con el ADF.",
          "VOR (VHF Omnidirectional Range): proporciona radiales que indican la posición respecto a la estación.",
          "DME (Distance Measuring Equipment): mide la distancia desde la aeronave a la estación.",
          "ILS: combina localizador y senda de planeo para aproximaciones de precisión.",
        ]} />
        <Paragraph>El piloto PPL debe saber sintonizar frecuencias, identificar estaciones mediante código Morse y utilizar los instrumentos de navegación correspondientes (CDI, OBS, HSI) para mantener la trayectoria adecuada.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 5) {
    return (
      <div className="space-y-6">
        <Paragraph>Antes de iniciar una aproximación, el piloto debe revisar el procedimiento aplicable y verificar el QNH, pista activa y configuración de la aeronave.</Paragraph>
        <Paragraph>En vuelos IFR, se debe cumplir con las restricciones de altitud, velocidad y rumbo establecidas en la carta. En aproximaciones visuales (VFR), se debe mantener referencia constante con la pista, ajustando altitud y potencia para lograr una senda de planeo estable.</Paragraph>

        <Subheading>Tipos de aproximación</Subheading>
        <BulletList items={[
          "Visual: cuando se mantiene contacto con el terreno y pista.",
          "ILS: mediante guía de localizador y senda de planeo.",
          "RNAV/RNP: basada en navegación satelital.",
          "Circling: maniobra visual tras aproximación instrumental para aterrizar por otra pista.",
        ]} />
        <Paragraph>En todos los casos, la decisión de aterrizar o frustrar debe basarse en seguridad y condiciones meteorológicas reales.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 6) {
    return (
      <div className="space-y-6">
        <Paragraph>El piloto PPL deberá manejar fraseología avanzada para coordinar procedimientos IFR y operaciones en espacio aéreo controlado.</Paragraph>

        <Subheading>Ejemplos</Subheading>
        <div className="space-y-3">
          <Example>Solicitud de autorización IFR: “Superficie, CC-ABC, puerta 3, solicitamos autorización IFR hacia MDST, FL090, listos a la capia.”</Example>
          <Example>Vector radar: “CC-ABC, vire por derecha rumbo 250, descienda para 040.”</Example>
          <Example>Aproximación: “Autorizado ILS pista 27, notifique establecido en el localizador.”</Example>
        </div>

        <Subheading>Pérdida de comunicaciones</Subheading>
        <Paragraph>En caso de pérdida de comunicaciones (NORDO), se deben seguir los procedimientos publicados y continuar el vuelo conforme al plan IFR hasta el destino o alterno según corresponda.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 7) {
    return (
      <div className="space-y-6">
        <Paragraph>El piloto privado debe comprender que la seguridad operacional depende en gran medida de la correcta toma de decisiones.</Paragraph>
        <Paragraph>Factores como la fatiga, el estrés, la carga de trabajo y las condiciones meteorológicas influyen directamente en el rendimiento.</Paragraph>

        <Subheading>Modelo DECIDE</Subheading>
        <Example>Detectar – Evaluar – Elegir – Identificar – Ejecutar – Evaluar nuevamente.</Example>

        <Subheading>Prioridad en una emergencia</Subheading>
        <BulletList items={[
          "Aviate (volar la aeronave).",
          "Navigate (mantener rumbo seguro).",
          "Communicate (informar al ATC).",
        ]} />
        <Paragraph>El piloto PPL debe mantener siempre una actitud profesional, respetar las limitaciones de la aeronave y garantizar la seguridad de la operación.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 8) {
    return (
      <div className="space-y-6">
        <Paragraph>Para obtener la licencia PPL dentro de PF24, el piloto deberá aprobar un examen teórico-práctico.</Paragraph>

        <Subheading>La evaluación incluye</Subheading>
        <BulletList items={[
          "Conocimiento de procedimientos VFR e IFR.",
          "Capacidad de planificación y navegación.",
          "Uso correcto de radioayudas y fraseología.",
          "Ejecución segura de aproximaciones y maniobras bajo condiciones controladas.",
        ]} />

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5 text-sm leading-7 text-emerald-100">
          La habilitación final será otorgada una vez demostrada la competencia operativa y teórica ante un instructor o examinador designado por PF24.
        </div>
      </div>
    );
  }

  return null;
}
