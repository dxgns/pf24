import Image from "next/image";
import type { ReactNode } from "react";

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-slate-300">{children}</p>;
}

function Subheading({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-xl font-extrabold text-white">{children}</h2>;
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3 text-sm leading-7 text-slate-300">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-[2px] text-sky-300">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
      {title && <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-sky-300">{title}</h3>}
      <div className={`${title ? "mt-3" : ""} text-sm leading-7 text-slate-300`}>{children}</div>
    </div>
  );
}

function DataTable({ headers, rows, minWidth = 680 }: { headers: string[]; rows: ReactNode[][]; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        <thead className="bg-slate-800/90 text-slate-100">
          <tr>{headers.map((header) => <th key={header} className="border-b border-white/10 px-4 py-3 font-bold">{header}</th>)}</tr>
        </thead>
        <tbody className="bg-slate-950/35 text-slate-300">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/10 last:border-b-0">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="align-top px-4 py-3 leading-6">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
      <figcaption className="mt-3 px-1 text-center text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

function RadioSection({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
      <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-sky-300">{title}</h3>
      <div className="mt-4 space-y-2">
        {lines.map((line, index) => <p key={`${title}-${index}`} className="font-mono text-sm leading-6 text-slate-300">{line}</p>)}
      </div>
    </section>
  );
}

export default function PilotModuleContentSynced({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <Paragraph>Antes de iniciar un vuelo se revisan las condiciones del aeródromo. El METAR informa el tiempo observado: viento, visibilidad, fenómenos, nubosidad, temperatura y QNH. El ATIS reúne esa información junto con la pista activa y otros datos operativos, y se identifica mediante una letra.</Paragraph>

        <Subheading>Ejemplo de METAR</Subheading>
        <ImageCard src="/academy/piloto/pe/metar.webp" alt="Ejemplo visual del METAR EGKK 121350Z 23012KT 9999 FEW030 17/10 Q1015" width={700} height={119} caption="Ejemplo original del temario: cada color separa un grupo del METAR." />
        <DataTable headers={["Grupo", "Significado"]} rows={[
          ["EGKK", "Aeródromo que emite el informe."],
          ["121350Z", "Día 12 a las 13:50 UTC."],
          ["23012KT", "Viento desde 230° a 12 nudos."],
          ["9999", "Visibilidad de 10 km o más."],
          ["FEW030", "Pocas nubes con base a 3.000 pies."],
          ["17/10", "Temperatura 17 °C y punto de rocío 10 °C."],
          ["Q1015", "QNH 1015 hPa."],
        ]} />

        <Subheading>Fenómenos meteorológicos frecuentes</Subheading>
        <DataTable headers={["Código", "Significado", "Código", "Significado"]} rows={[
          ["RA", "Lluvia", "-RA", "Lluvia débil"],
          ["+RA", "Lluvia fuerte", "SHRA", "Chaparrones de lluvia"],
          ["DZ", "Llovizna", "SN", "Nieve"],
          ["BR", "Neblina", "FG", "Niebla"],
          ["TS", "Tormenta", "TSRA", "Tormenta con lluvia"],
          ["HZ", "Calima o bruma seca", "RE", "Prefijo de fenómeno reciente"],
        ]} />

        <Subheading>Cantidad y tipo de nubes</Subheading>
        <DataTable headers={["Código", "Cobertura", "Código", "Cobertura"]} rows={[
          ["SKC", "Cielo despejado", "FEW", "Pocas nubes"],
          ["SCT", "Nubes dispersas", "BKN", "Nubosidad fragmentada"],
          ["OVC", "Cielo cubierto", "NSC", "Sin nubes significativas"],
          ["CB", "Cumulonimbus", "TCU", "Cúmulo de gran desarrollo vertical"],
        ]} />

        <Subheading>Cómo se expresa la altura de una capa</Subheading>
        <Paragraph>Los tres números posteriores al código de cobertura indican centenas de pies. Por ejemplo, FEW030 significa pocas nubes con base a 3.000 pies; BKN015 indica nubosidad fragmentada con base a 1.500 pies. En un vuelo local debe compararse esa base con la altitud prevista del circuito.</Paragraph>
        <DataTable headers={["Grupo", "Interpretación"]} rows={[
          ["FEW020", "Pocas nubes a 2.000 pies."],
          ["SCT030", "Nubes dispersas a 3.000 pies."],
          ["BKN015", "Nubosidad fragmentada a 1.500 pies."],
          ["OVC010", "Cielo cubierto a 1.000 pies."],
        ]} />

        <Subheading>CAVOK</Subheading>
        <Paragraph>CAVOK resume una condición de buena visibilidad, ausencia de nubosidad significativa baja y ausencia de fenómenos meteorológicos importantes según los criterios del informe. No significa que el piloto pueda ignorar el viento, la pista activa o las condiciones del circuito.</Paragraph>

        <Subheading>Qué copiar del ATIS</Subheading>
        <Paragraph>Se anota la letra identificadora, pista activa, viento, visibilidad, nubes, temperatura, punto de rocío, QNH y cualquier aviso relevante. En el primer contacto se informa la letra, por ejemplo: con información Charlie.</Paragraph>
        <Callout title="Importante">Los grupos BKN y OVC pueden limitar el techo disponible para el circuito. FEW y SCT describen capas con menor cobertura, pero igualmente debe comprobarse su altura. Los valores meteorológicos se interpretan junto con la pista y el circuito, no de forma aislada.</Callout>
      </div>
    );
  }

  if (moduleNumber === 2) {
    return (
      <div className="space-y-6">
        <Paragraph>En Project Flight no se dispone de un altímetro convencional ni de un selector de presión funcional. El simulador muestra directamente la altitud actual como un valor numérico. El piloto utiliza ese valor para cumplir una altitud autorizada y para comunicar su posición vertical.</Paragraph>
        <Callout title="Adaptación al simulador">El alumno no debe buscar una perilla de QNH o un botón STD. Debe leer el QNH del METAR o ATIS porque forma parte de la información operativa y de la comunicación, pero el valor de altitud mostrado por Project Flight no se ajusta manualmente con esa presión.</Callout>

        <Subheading>QNH, QNE y transición</Subheading>
        <DataTable headers={["Concepto", "Qué significa", "Aplicación práctica"]} rows={[
          ["QNH", "Presión referida al nivel medio del mar.", "Se obtiene del METAR/ATIS y puede ser comunicada por ATC; no se introduce en un altímetro dentro de Project Flight."],
          ["QNE / STD", "Referencia estándar de 1013,25 hPa utilizada para niveles de vuelo.", "Es un concepto de fraseología y organización vertical; no existe un selector STD funcional en el simulador."],
          ["TA", "Altitud de transición.", "Por debajo se expresan altitudes en pies."],
          ["TL", "Nivel de transición.", "Por encima se expresan niveles de vuelo."],
        ]} />

        <Subheading>Cómo leer y comunicar el valor</Subheading>
        <Paragraph>La división entre altitud y nivel depende de la transición publicada para el aeródromo. El valor visible puede ser el mismo, pero cambia la forma de expresarlo. Si la TA es 2.000 pies, una aeronave a 1.000 pies comunica mil pies; una aeronave en la referencia correspondiente a 3.000 pies comunica nivel de vuelo cero tres cero.</Paragraph>
        <DataTable headers={["Valor mostrado", "Forma numérica", "Forma de comunicarlo"]} rows={[
          ["1.000 pies", "010", "Mil pies si está por debajo de la TA."],
          ["2.000 pies", "020", "Dos mil pies si está por debajo o en la TA publicada."],
          ["3.000 pies", "030", "Nivel cero tres cero si corresponde operar por encima de la transición."],
          ["5.000 pies", "050", "Nivel cero cinco cero cuando se utiliza como nivel de vuelo."],
          ["10.000 pies", "100", "Nivel uno cero cero."],
        ]} />

        <Subheading>Uso durante el circuito</Subheading>
        <BulletList items={[
          "Consultar la altitud de circuito indicada para el aeródromo o la autorizada por ATC.",
          "Vigilar el valor de altitud mostrado durante viento cruzado y viento en cola.",
          "Evitar ascensos o descensos grandes mientras se atiende la radio.",
          "Si no puede mantenerse la altitud, informar a ATC y priorizar el control de la aeronave.",
        ]} />
        <Callout title="Ejemplo">ATC: mantenga 1.000 pies. El piloto observa la altitud actual mostrada en pantalla y corrige suavemente para permanecer cerca de 1.000. No necesita configurar QNH en un instrumento inexistente.</Callout>
      </div>
    );
  }

  if (moduleNumber === 3) {
    return (
      <div className="space-y-6">
        <Paragraph>La carta de rodaje permite reconocer pistas, calles, plataformas, posiciones y límites de movimiento. Antes de rodar, el piloto identifica su posición, la pista activa y el recorrido autorizado. La carta debe permanecer disponible durante todo el desplazamiento.</Paragraph>

        <Subheading>Alfabeto fonético</Subheading>
        <Paragraph>Las calles y puntos se comunican con el alfabeto fonético para evitar confusiones. Por ejemplo, la calle A se pronuncia Alfa y la B se pronuncia Bravo.</Paragraph>
        <ImageCard src="/academy/piloto/pe/alfabeto-fonetico.webp" alt="Alfabeto fonético ICAO de Alfa a Zulu" width={600} height={291} caption="Alfabeto fonético incluido en el temario PE original." />

        <Subheading>Elementos que deben localizarse</Subheading>
        <DataTable headers={["Elemento", "Función operativa"]} rows={[
          ["Pista", "Superficie utilizada para despegues y aterrizajes; se identifica por su número."],
          ["Calle de rodaje", "Ruta entre plataforma y pista; se identifica por letras."],
          ["Plataforma", "Área donde se estacionan las aeronaves."],
          ["Punto de espera", "Límite en el que se detiene la aeronave antes de ingresar a pista."],
          ["Posición", "Lugar específico de estacionamiento asignado o elegido."],
        ]} />

        <Subheading>Ejemplo de carta de rodaje</Subheading>
        <ImageCard src="/academy/piloto/pe/carta-rodaje-mdst.webp" alt="Carta de rodaje de MDST Santiago con pista 11/29 y calles Alfa y Bravo" width={700} height={394} caption="Carta original de MDST utilizada en el temario PE." />
        <Paragraph>En la carta de MDST se observa la pista 11/29, las calles Alfa y Bravo y las plataformas de aviación general, pasajeros y carga. Si la aeronave se encuentra en aviación general y recibe ruede al punto de espera pista 11 vía Alfa, debe seguir la conexión marcada A y detenerse antes de entrar en la pista.</Paragraph>

        <Subheading>Reglas de seguridad en superficie</Subheading>
        <BulletList items={[
          "No iniciar el rodaje hasta comprender la ruta autorizada.",
          "Mantener una velocidad que permita detenerse antes de una pista u otra aeronave.",
          "Nunca ingresar, cruzar o retroceder por pista sin autorización explícita de Torre.",
          "Si se pierde la orientación, detenerse fuera de la pista y solicitar instrucciones.",
          "Notificar pista libre únicamente cuando toda la aeronave haya salido.",
        ]} />
        <Callout title="Lectura de una autorización">Ruede vía Alfa al punto de espera pista 11. La ruta es Alfa y el límite es el punto de espera. La autorización no permite ingresar a la pista.</Callout>
      </div>
    );
  }

  if (moduleNumber === 4) {
    return (
      <div className="space-y-6">
        <Paragraph>Un plan de vuelo puede presentarse bajo reglas VFR o IFR, pero la licencia PE habilita únicamente vuelos VFR. Esto significa que el piloto debe conservar referencia visual con el entorno y operar cuando las condiciones permiten ver la pista, el circuito y el tránsito.</Paragraph>
        <DataTable headers={["Aspecto", "VFR", "IFR"]} rows={[
          ["Referencia", "Entorno, horizonte, pista y otras aeronaves.", "Instrumentos y procedimientos publicados."],
          ["Meteorología", "Requiere condiciones visuales adecuadas.", "Puede operar sin referencia exterior dentro de mínimos."],
          ["Navegación", "Visual y mediante referencias de posición disponibles.", "Rutas y procedimientos instrumentales."],
          ["Licencia PE", "Permitido en vuelos locales y circuitos.", "No permitido como operación PE."],
        ]} />
        <Paragraph>Aunque ATC preste servicio, el piloto VFR debe observar el tránsito y mantener separación visual. Si las nubes, la visibilidad o cualquier otra circunstancia impiden conservar referencias suficientes, debe informar y regresar, aterrizar o no iniciar el vuelo.</Paragraph>

        <Subheading>Reglas mixtas que aparecen en el plan</Subheading>
        <DataTable headers={["Código", "Secuencia de reglas"]} rows={[
          ["ZFR", "El vuelo comienza bajo reglas VFR y continúa bajo reglas IFR."],
          ["YFR", "El vuelo comienza bajo reglas IFR y continúa bajo reglas VFR."],
        ]} />
        <Paragraph>Estos códigos permiten reconocer planes con cambio de reglas, pero no amplían las atribuciones de la licencia PE: durante esta etapa se realizan únicamente operaciones VFR locales.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 5) {
    return (
      <div className="space-y-6">
        <Paragraph>El circuito es una trayectoria rectangular que organiza las aeronaves alrededor de la pista. Normalmente se realizan virajes a la izquierda, salvo que la carta o ATC indiquen circuito derecho. El piloto mantiene la altitud asignada y reporta los tramos solicitados.</Paragraph>
        <ImageCard src="/academy/piloto/pe/circuito-transito.webp" alt="Diagrama de circuito de tránsito con viento en cara, viento cruzado, viento en cola, base y final" width={593} height={351} caption="Diagrama original del circuito utilizado en el temario PE." />
        <DataTable headers={["Tramo", "Ubicación y acción principal"]} rows={[
          ["Viento en cara", "Después del despegue, prolongando el eje de pista."],
          ["Viento cruzado", "Primer tramo perpendicular; continuar ascenso."],
          ["Viento en cola", "Paralelo a la pista en sentido contrario; mantener altitud y preparar descenso."],
          ["Base", "Tramo perpendicular que conecta viento en cola con final."],
          ["Final", "Alineado con la pista para completar el aterrizaje."],
          ["Final corta", "Última parte de la final, cuando la aeronave ya se encuentra próxima al umbral."],
        ]} />
        <Callout title="Aproximación frustrada">Si la final no está controlada, la pista está ocupada o ATC lo ordena, se aplica potencia y se continúa el circuito o la instrucción recibida. Frustrar es una maniobra normal y siempre es preferible a forzar un aterrizaje.</Callout>
      </div>
    );
  }

  if (moduleNumber === 6) {
    return (
      <div className="space-y-6">
        <Paragraph>Todo vuelo debe presentarse mediante un plan, incluso si la aeronave despega y aterriza en el mismo aeródromo. El formulario permite a ATC identificar la aeronave, conocer la intención del vuelo y coordinar la operación. Para la licencia PE se utiliza un plan VFR local.</Paragraph>
        <ImageCard src="/academy/piloto/pe/plan-vuelo-local.webp" alt="Ejemplo de plan de vuelo local" width={199} height={200} caption="Ejemplo de plan de vuelo local." compact />

        <Subheading>Campos y ejemplo completo</Subheading>
        <DataTable headers={["Campo", "Qué debe colocarse", "Ejemplo local"]} rows={[
          ["Callsign", "Indicativo utilizado en las comunicaciones.", "G-JDTB"],
          ["Callsign en juego", "Indicativo personalizado utilizado durante la sesión; es opcional.", "G-JDTB"],
          ["Aeronave", "Modelo que se utilizará durante el vuelo.", "C152"],
          ["Reglas de vuelo", "Reglas aplicables; para una operación PE se selecciona VFR.", "VFR"],
          ["Salida", "Código OACI del aeródromo de salida.", "MDST"],
          ["Llegada", "Código OACI del destino; en un vuelo local coincide con la salida.", "MDST"],
          ["Alterno", "Aeródromo previsto si no fuera posible aterrizar en el destino.", "MDAB"],
          ["Velocidad de crucero", "Velocidad prevista para la fase estable del vuelo.", "100 kt"],
          ["Duración del combustible", "Tiempo estimado que permite operar el combustible cargado.", "02:15"],
          ["Matrícula", "Registro asignado a la aeronave.", "LV-DTB"],
          ["Ruta", "Recorrido previsto; LCL identifica una operación local.", "LCL"],
          ["FL", "Valor de altitud o nivel previsto para la operación.", "015"],
          ["Notas adicionales", "Información operativa que resulte útil para ATC.", "Vuelo de ejemplo"],
        ]} />
        <Callout title="Aclaración sobre el campo FL">El campo FL registra el valor vertical previsto. En el ejemplo, 015 representa 1.500 pies para el vuelo local. En frecuencia, la forma de expresarlo depende de la transición: se comunica como altitud en pies o como nivel de vuelo según corresponda.</Callout>
      </div>
    );
  }

  if (moduleNumber === 7) {
    return (
      <div className="space-y-6">
        <Paragraph>Las luces permiten indicar que la aeronave está activa y mejorar su visibilidad. El piloto debe accionarlas en los momentos adecuados de cada fase de la operación.</Paragraph>
        <DataTable headers={["Luz", "Función", "Momento de uso"]} rows={[
          ["NAV", "Roja izquierda, verde derecha y blanca atrás.", "Durante el vuelo y cuando corresponda por visibilidad."],
          ["LOGO", "Ilumina la cola.", "Principalmente durante operaciones nocturnas."],
          ["BEACON", "Advierte que la aeronave está activa.", "Antes de encender motores hasta después de apagarlos."],
          ["TAXI", "Ilumina el recorrido en tierra.", "Durante el rodaje."],
          ["STROBE", "Destellos blancos de alta intensidad.", "Al ingresar a pista y durante el vuelo."],
          ["LANDING", "Luz frontal de gran intensidad.", "Despegue, aproximación y aterrizaje."],
        ]} />
        <Callout title="Secuencia básica">BEACON antes de motores; TAXI durante el rodaje; STROBE y LANDING al ingresar a pista. Al liberar, apagar STROBE y ajustar las demás luces. BEACON se mantiene hasta apagar motores.</Callout>
        <Subheading>Errores que deben evitarse</Subheading>
        <BulletList items={[
          "Encender STROBE en plataforma y molestar a otras aeronaves antes de ingresar a pista.",
          "Poner en marcha sin BEACON, impidiendo que los demás sepan que el motor será encendido.",
          "Mantener TAXI o LANDING encendidas apuntando directamente a otra aeronave en tierra.",
          "Olvidar apagar las luces correspondientes después de estacionar y detener los motores.",
        ]} />
      </div>
    );
  }

  if (moduleNumber === 8) {
    return (
      <div className="space-y-6">
        <Paragraph>Durante una sesión pueden aparecer situaciones operativas o técnicas. La prioridad es conservar el control y evitar una acción imprevisible. Una falla de conexión, una instrucción no comprendida o una aproximación mal estabilizada no deben resolverse apresuradamente.</Paragraph>
        <DataTable headers={["Situación", "Respuesta esperada"]} rows={[
          ["Radio o voz no funciona", "Comprobar canal, volumen y dispositivo; usar el medio alternativo establecido."],
          ["Conexión inestable", "Mantener la aeronave en una situación simple y segura; informar si es posible."],
          ["Meteorología empeora", "Conservar referencias visuales y regresar o aterrizar antes de perderlas."],
          ["Pista ocupada", "No aterrizar ni ingresar; mantener posición o frustrar."],
          ["Aproximación inestable", "Aplicar potencia, frustrar y volver al circuito."],
          ["Instrucción no comprendida", "Mantener la última autorización segura y solicitar repetición."],
        ]} />
        <Callout title="Orden de prioridades">1. Controlar la aeronave. 2. Mantener una trayectoria segura. 3. Comunicar. La gestión de la radio o de otras funciones no debe distraer durante una fase crítica.</Callout>
        <Paragraph>Si el problema impide continuar el vuelo, se informa a ATC de forma breve: indicativo, problema e intención. Cuando no existe ATC, se anuncia en UNICOM y se actúa de forma previsible para el resto de los jugadores.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 9) {
    return (
      <div className="space-y-6">
        <Paragraph>La fraseología es el lenguaje estándar utilizado entre piloto y ATC. Su objetivo es comunicar información de manera clara, breve y sin ambigüedades. El piloto escucha antes de transmitir y utiliza siempre su indicativo.</Paragraph>
        <DataTable headers={["Concepto", "Definición aplicada"]} rows={[
          ["Callsign", "Identificador único de la aeronave, por ejemplo G-JDTB o LV-ART."],
          ["Colación", "Repetición de una autorización o dato crítico para confirmar que fue entendido."],
          ["Mantenga escucha", "Permanecer atento en la frecuencia sin volver a llamar hasta ser requerido."],
          ["Notifique", "Informar cuando se alcance la posición o condición indicada."],
          ["Incapaz", "Comunicar que una instrucción no puede cumplirse."],
        ]} />

        <RadioSection title="Prueba de radio y contacto inicial" lines={[
          "PILOTO: Santiago superficie, G-JDTB, prueba de radio.",
          "ATC: G-JDTB, Santiago superficie, le recibo cinco.",
          "PILOTO: Santiago superficie, G-JDTB, estacionamiento general 3, vuelo VFR local, información Charlie, listo a copiar.",
        ]} />

        <RadioSection title="Autorización de vuelo local" lines={[
          "ATC: G-JDTB, autorizado vuelo VFR local, salida y llegada Santiago, mantenga 1.000 pies, transpondedor 1203.",
          "PILOTO: Autorizado VFR local, salida y llegada Santiago, mantengo 1.000 pies, transpondedor 1203, G-JDTB.",
          "ATC: G-JDTB, colación correcta, notifique listo para puesta en marcha.",
          "PILOTO: Notificaré listo para puesta en marcha, G-JDTB.",
        ]} />

        <RadioSection title="Puesta en marcha y rodaje" lines={[
          "PILOTO: Santiago superficie, G-JDTB, listo para puesta en marcha.",
          "ATC: G-JDTB, puesta en marcha aprobada, notifique listo para rodar.",
          "PILOTO: Puesta en marcha aprobada, notificaré listo para rodar, G-JDTB.",
          "PILOTO: Santiago superficie, G-JDTB, listo para rodar.",
          "ATC: G-JDTB, ruede vía Alfa al punto de espera pista 11, mantenga antes de pista 11.",
          "PILOTO: Vía Alfa al punto de espera pista 11, mantengo antes de pista 11, G-JDTB.",
        ]} />

        <Callout title="Datos que deben colacionarse">Pista, punto de espera, autorización de ingreso o cruce, altitud, rumbo, frecuencia y transpondedor. Si un dato no se escucha completo, se solicita repetición; nunca se adivina.</Callout>

        <RadioSection title="Torre, despegue y circuito" lines={[
          "PILOTO: Santiago torre, G-JDTB, punto de espera pista 11, listo para salida.",
          "ATC: G-JDTB, viento 120 grados 8 nudos, autorizado a despegar pista 11, circuito izquierdo, notifique viento en cola.",
          "PILOTO: Autorizado a despegar pista 11, circuito izquierdo, notificaré viento en cola, G-JDTB.",
          "PILOTO: Santiago torre, G-JDTB, viento en cola pista 11.",
          "ATC: G-JDTB, notifique base.",
          "PILOTO: Notificaré base, G-JDTB.",
          "PILOTO: Santiago torre, G-JDTB, base pista 11.",
          "ATC: G-JDTB, notifique final.",
          "PILOTO: Notificaré final, G-JDTB.",
          "PILOTO: Santiago torre, G-JDTB, final pista 11.",
          "ATC: G-JDTB, viento 120 grados 8 nudos, autorizado a aterrizar pista 11.",
          "PILOTO: Autorizado a aterrizar pista 11, G-JDTB.",
        ]} />

        <RadioSection title="Salida de pista y regreso a plataforma" lines={[
          "PILOTO: Santiago torre, G-JDTB, pista libre por Alfa.",
          "ATC: G-JDTB, contacte Santiago superficie 121.9.",
          "PILOTO: Superficie 121.9, G-JDTB.",
          "PILOTO: Santiago superficie, G-JDTB, pista libre por Alfa, solicito rodaje a estacionamiento.",
          "ATC: G-JDTB, ruede a estacionamiento general 3 vía Alfa.",
          "PILOTO: A estacionamiento general 3 vía Alfa, G-JDTB.",
        ]} />

        <RadioSection title="Cierre del vuelo" lines={[
          "PILOTO: Santiago superficie, G-JDTB, estacionado, motores apagados.",
          "ATC: G-JDTB, recibido, plan de vuelo finalizado, buen día.",
          "PILOTO: Plan finalizado, gracias por el control, G-JDTB.",
        ]} />

        <Callout title="UNICOM">Sin ATC, los mensajes comunican posición e intención; no solicitan autorización a otro piloto. Se utiliza la frecuencia común publicada, habitualmente 122.800.</Callout>
      </div>
    );
  }

  if (moduleNumber === 10) {
    return (
      <div className="space-y-6">
        <Paragraph>Para obtener la licencia PE, el alumno debe aprobar una evaluación teórica basada en este temario y completar un vuelo supervisado. Se comprueba el uso correcto de los valores y controles disponibles, sin exigir instrumentos que Project Flight no permite observar o ajustar.</Paragraph>

        <Subheading>Contenidos teóricos</Subheading>
        <BulletList items={[
          "Interpretación de METAR, fenómenos, nubes, ATIS y Q-Codes.",
          "Uso del valor de altitud mostrado y diferencia operativa entre pies y niveles.",
          "Lectura de carta de rodaje, alfabeto fonético y límites de autorización.",
          "Diferencia entre VFR e IFR y alcance de la licencia PE.",
          "Tramos del circuito, plan LCL, luces y escenarios imprevistos.",
          "Fraseología, colación y coordinación en UNICOM.",
        ]} />

        <Subheading>Evaluación práctica</Subheading>
        <DataTable headers={["Fase", "Competencia observable"]} rows={[
          ["Preparación", "Presenta plan VFR local, copia ATIS y explica pista y circuito."],
          ["Puesta en marcha", "Solicita autorización y utiliza correctamente las luces disponibles."],
          ["Rodaje", "Sigue la carta y se detiene en el límite indicado."],
          ["Despegue", "Colaciona pista y circuito y mantiene una salida controlada."],
          ["Circuito", "Mantiene los valores autorizados y reporta los tramos solicitados."],
          ["Aterrizaje", "Completa una final segura o realiza una frustrada cuando corresponde."],
          ["Regreso", "Libera pista, cambia de frecuencia y llega al estacionamiento asignado."],
        ]} />
        <Callout title="Estándar final">El piloto PE habilitado comprende la secuencia completa de un vuelo local y puede ejecutarla de forma autónoma, manteniendo comunicaciones claras y una conducta previsible.</Callout>
      </div>
    );
  }

  return null;
}
