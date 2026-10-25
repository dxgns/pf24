import PilotModuleContentWithIntro from "@/components/academy/PilotModuleContentWithIntro";
import Image from "next/image";
import type { ReactNode } from "react";

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-slate-300">{children}</p>;
}

function Subheading({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-xl font-extrabold text-white">{children}</h2>;
}

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
      <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-sky-300">{title}</h3>
      <div className="mt-3 text-sm leading-7 text-slate-300">{children}</div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
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

function Figure({
  src,
  alt,
  width,
  height,
  caption,
  maxWidth,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  maxWidth?: number;
}) {
  return (
    <figure
      className="mx-auto overflow-hidden rounded-2xl border border-white/10 bg-white p-3"
      style={maxWidth ? { maxWidth } : undefined}
    >
      <Image src={src} alt={alt} width={width} height={height} className="mx-auto block h-auto w-full object-contain" />
      <figcaption className="mt-3 px-1 text-center text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

export default function AtcS1ModuleContent({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <Paragraph>El controlador S1 cumple el rol de gestionar las autorizaciones de salida y el control de superficie. Su función puede desarrollarse tanto en aeródromos pequeños como en aeropuertos grandes, donde opera en conjunto con la torre o con la aproximación según corresponda.</Paragraph>
        <Paragraph>Su responsabilidad principal es asegurar el orden, la fluidez y la seguridad en todos los movimientos que se realicen sobre la superficie del aeródromo. Cuando la torre está activa, la coordinación entre ambas dependencias es fundamental: el S1 se encarga de autorizar la salida, entregar la autorización IFR o VFR y gestionar el rodaje hasta el punto de espera de la pista activa, mientras que la torre es la responsable de autorizar la entrada en pista y el despegue.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 2) {
    return (
      <div className="space-y-6">
        <Paragraph>El controlador debe manejar adecuadamente la información meteorológica y los Q-codes, especialmente aquellos vinculados a la presión. Para ello se vale del METAR, que es el informe meteorológico que presenta viento, visibilidad, nubosidad, temperatura y QNH, así como del ATIS, que ofrece de forma automática las condiciones actuales y la pista activa del aeródromo.</Paragraph>
        <Paragraph>Es importante comprender la diferencia entre QNH, que representa la presión atmosférica al nivel del aeródromo, y QNE, que corresponde a la presión estándar de 1013 hPa. El cambio entre uno y otro depende de la altitud o nivel de transición establecidos para el aeropuerto.</Paragraph>

        <Subheading>Ejemplo de METAR</Subheading>
        <Figure
          src="/academy/atc/s1/metar.png"
          alt="METAR EGKK 121350Z 23012KT 9999 FEW030 17/10 Q1015"
          width={1225}
          height={209}
          caption="Ejemplo de METAR incluido en el temario oficial S1."
        />
        <Callout title="Lectura del ejemplo">
          EGKK 121350Z 23012KT 9999 FEW030 17/10 Q1015. Esto indica: visibilidad mayor a 10 km, nubes dispersas a 3000 pies, temperatura 17°C punto de roció 10, QNH 1015.
        </Callout>
      </div>
    );
  }

  if (moduleNumber === 3) {
    return (
      <div className="space-y-6">
        <Paragraph>La selección de la pista activa depende principalmente del viento, pero también intervienen factores como la longitud disponible, limitaciones operativas y procedimientos publicados. Un viento proveniente de 230 grados a 12 nudos sugiere que la pista más adecuada es la 27 (teniendo en cuenta que los aviones siempre despegan y aterrizan con el viento en contra), por ejemplo, la 27R si el aeropuerto cuenta con pistas paralelas.</Paragraph>
        <Figure
          src="/academy/atc/s1/seleccion-pista-viento.png"
          alt="Diagrama de selección de pista según la dirección del viento"
          width={545}
          height={385}
          caption="Dirección del viento y sentido preferido de operación mostrado en el temario S1."
          maxWidth={560}
        />
        <Paragraph>El controlador debe comunicar claramente cuál es la pista activa dependiendo de la situación operacional, e informar cualquier cambio por cierre de pista, condiciones meteorológicas o variaciones de viento. Es esencial que el S1 mantenga coherencia en las operaciones y coordine en caso de que se compartan tareas con la torre.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 4) {
    return (
      <div className="space-y-6">
        <Paragraph>Respecto al control de superficie, el S1 debe conocer con precisión la estructura del aeródromo, las calles de rodaje, los puntos de espera, las puertas y todos los elementos representados en la carta de superficie. Las instrucciones deben ser claras, concisas y siempre siguiendo las rutas establecidas.</Paragraph>
        <Paragraph>La correcta utilización de la carta es indispensable para evitar conflictos en superficie, así como verificar que las aeronaves comprendan y cumplan las instrucciones asignadas.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 5) {
    return (
      <div className="space-y-6">
        <Paragraph>El uso de cartas aeronáuticas es parte fundamental de la tarea del S1. Las cartas de superficie permiten comprender la distribución del aeródromo, mientras que las SID representan las salidas estándar instrumentales. El controlador S1 puede asignar SID, pero no realiza vectores, por lo que debe ceñirse estrictamente a lo publicado.</Paragraph>

        <Subheading>Ejemplo carta de rodaje</Subheading>
        <Figure
          src="/academy/atc/s1/carta-rodaje-mdst.png"
          alt="Carta de rodaje de MDST/STI Santiago"
          width={824}
          height={463}
          caption="Ejemplo de carta de rodaje incluido en el temario oficial S1."
        />

        <Subheading>Ejemplo carta SID</Subheading>
        <Figure
          src="/academy/atc/s1/carta-sid-mdpc.png"
          alt="Carta SID de MDPC/PUJ Punta Cana"
          width={769}
          height={465}
          caption="Ejemplo de carta SID incluido en el temario oficial S1."
        />

        <Paragraph>Una autorización IFR completa debe incluir identificación, destino, SID, pista asignada, nivel inicial/final y transponder. Esto garantiza claridad y orden en las salidas del aeródromo, además de permitir una transición ordenada hacia el control de aproximación o ruta.</Paragraph>
      </div>
    );
  }

  if (moduleNumber === 6) {
    return (
      <div className="space-y-6">
        <Paragraph>La altimetría es el sistema que permite conocer la altitud de la aeronave. Se basa en la presión atmosférica, que disminuye con la altura.</Paragraph>
        <Paragraph>Un ajuste incorrecto del altímetro puede provocar errores en la altitud real, lo que representa un riesgo de separación con otras aeronaves o el terreno.</Paragraph>
        <Paragraph>El controlador debe asignar niveles iniciales que no generen conflictos y recordar a las aeronaves cuándo deben ajustar la presión. Por ejemplo, si la TA es 6000 pies, una vez pasando esa altitud la aeronave deberá ajustar QNE 1013, mientras que al descender por debajo del nivel de transición deberá volver a QNH. Esto es especialmente importante para la separación vertical y la coherencia entre aeronaves que operan en diferentes fases del vuelo.</Paragraph>

        <Subheading>Transformación de pies a nivel de vuelo</Subheading>
        <DataTable headers={["Pies", "Nivel"]} rows={[
          ["1000 ft", "010"],
          ["2000 ft", "020"],
          ["5000 ft", "050"],
          ["10000 ft", "100"],
          ["25000 ft", "250"],
        ]} />
        <Paragraph>Toda altitud por encima del Transición Altittude (TA) local de un aeródromo debe ser leído y pronunciado como nivel de vuelo, toda altitud que se encuentre por debajo en pies.</Paragraph>
        <Callout title="Ejemplo del temario">
          TA: 2000 ft. 1000 ft = mil pies. 3000 ft = cero tres cero (030).
        </Callout>
      </div>
    );
  }

  if (moduleNumber === 7) {
    return (
      <div className="space-y-6">
        <Paragraph>El controlador S1 debe emitir autorizaciones claras tanto para vuelos IFR como VFR. Para IFR, la estructura típica incluye identificación del vuelo, destino, salida estándar publicada, pista de salida, nivel inicial, código transponder y frecuencia posterior. Para VFR, la autorización debe incluir pista, rumbo o punto hacia el cual se dirige la aeronave, altitud a mantener y código transponder. Este tipo de autorizaciones requieren claridad adicional porque no siguen procedimientos tan estrictamente definidos como las SID instrumentales.</Paragraph>

        <Callout title="Formato">
          (...) autorizado el vuelo (instrumental/visual/local) a/en (...) la salida (...) por pista (...) nivel de vuelo (...) y transponder (...)
        </Callout>

        <Subheading>Ejemplo VFR</Subheading>
        <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
          <Figure
            src="/academy/atc/s1/ejemplo-vfr.png"
            alt="Ejemplo de plan VFR C-GTZO"
            width={177}
            height={178}
            caption="Datos del ejemplo VFR del temario S1."
            maxWidth={220}
          />
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 text-sm leading-7 text-slate-300">
            C-GTZO autorizado el vuelo local en Arroyo Barril (MDAB) la salida por pista 11, nivel de vuelo 1000 pies, transponder 5213.
          </div>
        </div>
      </div>
    );
  }

  if (moduleNumber === 8) {
    return (
      <div className="space-y-6">
        <Paragraph>El S1 debe estar preparado para afrontar situaciones especiales como fallos de comunicación, incumplimiento de instrucciones, pistas bloqueadas o cambios súbitos en las condiciones de viento.</Paragraph>
        <Paragraph>En caso de fallo de comunicaciones, se intentará repetir el mensaje, utilizar frecuencias alternativas o coordinar con torre o aproximación. Ante una pista bloqueada, se ordena a todas las aeronaves mantener posición hasta nueva indicación. El incumplimiento de instrucciones debe notificarse al personal de supervisión.</Paragraph>
        <Callout title="Prioridad">El controlador debe siempre mantener la seguridad como prioridad absoluta.</Callout>
      </div>
    );
  }

  if (moduleNumber === 9) {
    return <PilotModuleContentWithIntro moduleNumber={10} />;
  }

  return null;
}
