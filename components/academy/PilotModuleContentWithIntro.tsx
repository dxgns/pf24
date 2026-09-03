import PilotModuleContentSynced from "@/components/academy/PilotModuleContentSynced";

export default function PilotModuleContentWithIntro({ moduleNumber }: { moduleNumber: number }) {
  if (moduleNumber === 1) {
    return (
      <div className="space-y-6">
        <p className="text-sm leading-7 text-slate-300">
          La Licencia de Piloto Estudiante (PE) es el primer paso en la formación de un piloto dentro del entorno de vuelo PF24.
        </p>
        <p className="text-sm leading-7 text-slate-300">
          Esta habilitación permite realizar vuelos locales bajo reglas VFR (Visual Flight Rules), en condiciones meteorológicas visuales y con un conocimiento básico de los procedimientos operativos.
        </p>
        <p className="text-sm leading-7 text-slate-300">
          El piloto estudiante debe ser capaz de mantener el control de la aeronave en un entorno simple, respetar las instrucciones de ATC, y operar en zonas de tránsito aéreo de baja complejidad como aeródromos con circuitos visuales establecidos.
        </p>
      </div>
    );
  }

  return <PilotModuleContentSynced moduleNumber={moduleNumber - 1} />;
}
