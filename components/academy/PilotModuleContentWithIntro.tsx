import PilotModuleContentSynced from "@/components/academy/PilotModuleContentSynced";
import type { ReactNode } from "react";

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
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

export default function PilotModuleContentWithIntro({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <p className="text-sm leading-7 text-slate-300">La licencia de Piloto Estudiante es el primer nivel de formación. Su finalidad es que el alumno pueda completar un vuelo local sencillo desde el estacionamiento hasta el regreso a plataforma, comprendiendo cada etapa y sin depender de instrucciones paso a paso.</p>
        <p className="text-sm leading-7 text-slate-300">El piloto PE debe poder presentar el plan de vuelo, copiar la información del aeródromo, comunicarse con Superficie y Torre, seguir una ruta de rodaje, despegar, mantener el circuito visual y aterrizar. También debe reconocer cuándo corresponde detenerse, solicitar aclaración o realizar una aproximación frustrada.</p>

        <DataTable headers={["Etapa", "Aplicación práctica"]} rows={[
          ["Preparación", "Consultar METAR/ATIS, pista activa, carta de rodaje y plan VFR local."],
          ["Superficie", "Poner en marcha, usar luces, seguir la ruta y mantener antes de pista."],
          ["Despegue", "Confirmar autorización, pista y sentido del circuito."],
          ["Circuito", "Vigilar los valores de altitud y velocidad mostrados y reportar posiciones."],
          ["Aterrizaje", "Mantener una aproximación controlada, aterrizar o frustrar y liberar la pista."],
        ]} />

        <section>
          <h2 className="text-xl font-extrabold text-white">Información visible en el simulador</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">Project Flight muestra directamente valores como altitud actual, velocidad y rumbo. En este temario se enseña a leer y utilizar esos valores. No se evaluará la interpretación visual de instrumentos tradicionales que el jugador no puede observar de forma funcional.</p>
        </section>

        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
          <h2 className="mono text-xs font-bold uppercase tracking-[0.16em] text-sky-300">Criterio principal</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">El piloto debe comprender qué valor necesita mantener y por qué. Por ejemplo, si ATC autoriza 1.000 pies, debe vigilar que la altitud indicada por el simulador permanezca cerca de 1.000 pies durante el circuito.</p>
        </div>
      </div>
    );
  }

  return <PilotModuleContentSynced moduleNumber={moduleNumber - 1} />;
}
