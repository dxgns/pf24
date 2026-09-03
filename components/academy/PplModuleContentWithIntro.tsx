import PplModuleContentPdf from "@/components/academy/PplModuleContentPdf";

function IntroTable() {
  const rows = [
    ["Operación", "Circuito VFR local", "Travesías y secuencias completas entre aeródromos"],
    ["Navegación", "Referencia visual básica", "Ruta, puntos, tiempos, viento, radioayudas y RNAV"],
    ["Meteorología", "METAR y QNH", "METAR, TAF, evolución del tiempo y decisiones operativas"],
    ["ATC", "Rodaje, despegue y circuito", "Autorizaciones, transferencias, vectores, salidas y llegadas"],
    ["Instrumentos", "Altimetría básica", "Vuelo IFR, procedimientos y aproximaciones instrumentales"],
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-slate-800/90 text-slate-100">
          <tr>
            <th className="px-4 py-3">Área</th>
            <th className="px-4 py-3">Base adquirida en PE</th>
            <th className="px-4 py-3">Aplicación en PPL</th>
          </tr>
        </thead>
        <tbody className="bg-slate-950/35 text-slate-300">
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-white/10">
              {row.map((cell) => <td key={cell} className="px-4 py-3 leading-6">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhaseFlow() {
  const phases = ["Preparar", "Salir", "Navegar", "Llegar", "Revisar"];
  return (
    <figure className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {phases.map((phase, index) => (
          <div key={phase} className="flex flex-1 items-center gap-3">
            <div className="flex-1 rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-center text-sm font-bold text-sky-100">{phase}</div>
            {index < phases.length - 1 && <span className="hidden text-slate-500 sm:block">→</span>}
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-center text-xs text-slate-500">Cada fase requiere anticipación, comprobación y comunicación.</figcaption>
    </figure>
  );
}

export default function PplModuleContentWithIntro({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-7">
        <p className="text-sm leading-7 text-slate-300">
          La licencia de Piloto Privado (PPL) constituye el segundo nivel de formación de pilotos en PF24. Mientras la licencia PE se concentra en la operación local y el circuito visual, la PPL incorpora vuelos de travesía, planificación más completa, navegación entre aeródromos y una introducción operativa al vuelo por instrumentos.
        </p>
        <p className="text-sm leading-7 text-slate-300">
          Un piloto PPL debe poder preparar el vuelo antes de conectarse, comprender la autorización recibida, mantener conciencia de su posición y anticipar la siguiente fase. También debe reconocer cuándo una condición supera su capacidad o la de la aeronave y tomar una decisión segura, incluso si eso implica demorar, desviarse o frustrar una aproximación.
        </p>

        <IntroTable />
        <PhaseFlow />

        <section>
          <h2 className="text-xl font-extrabold text-white">Método de trabajo esperado</h2>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <li><strong className="text-white">Preparar:</strong> reunir cartas, meteorología, NOTAM, combustible, alterno y plan de vuelo.</li>
            <li><strong className="text-white">Ejecutar:</strong> volar la aeronave con precisión, usar listas y cumplir autorizaciones y restricciones.</li>
            <li><strong className="text-white">Anticipar:</strong> revisar con tiempo la salida, el siguiente punto, la llegada y una posible alternativa.</li>
            <li><strong className="text-white">Comunicar:</strong> escuchar antes de transmitir, usar fraseología clara y colacionar los datos críticos.</li>
            <li><strong className="text-white">Revisar:</strong> detectar errores, corregirlos temprano y aprender del vuelo realizado.</li>
          </ul>
        </section>
      </div>
    );
  }

  return <PplModuleContentPdf moduleNumber={moduleNumber - 1} />;
}
