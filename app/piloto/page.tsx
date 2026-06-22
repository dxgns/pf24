import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createFlightPlan } from "@/app/actions/createFlightPlan";

const AIRCRAFT_TYPES = [
  "A320", "A321", "A330", "A350", "B737", "B738", "B739",
  "B744", "B748", "B752", "B763", "B772", "B77W",
  "B788", "B789", "C172", "C208", "DH8D", "E170", "E190", "CRJ9",
];

const AIRPORTS = [
  "MDPC", "MDST", "MDCR", "MDAB", "EGKK", "EGHI",
  "LCLK", "LCPH", "LCAK", "GCLP", "LEMH", "EFKT",
];

export default async function PilotPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#050816] px-6 py-24 text-white">
      <section className="section-container max-w-4xl">
        <h1 className="text-4xl font-extrabold">Nuevo Plan de Vuelo</h1>

        <form
          action={createFlightPlan}
          className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-8"
        >
          <input name="callsign" placeholder="Callsign" className="rounded-xl bg-slate-800 p-3" required />

          <select name="aircraftType" className="rounded-xl bg-slate-800 p-3" required>
            <option value="">Seleccionar aeronave</option>
            {AIRCRAFT_TYPES.map((aircraft) => (
              <option key={aircraft} value={aircraft}>{aircraft}</option>
            ))}
          </select>

          <select name="flightRules" className="rounded-xl bg-slate-800 p-3" required>
            <option value="IFR">IFR</option>
            <option value="VFR">VFR</option>
            <option value="YFR">YFR</option>
            <option value="ZFR">ZFR</option>
          </select>

          <select name="departure" className="rounded-xl bg-slate-800 p-3" required>
            <option value="">Salida</option>
            {AIRPORTS.map((airport) => (
              <option key={airport} value={airport}>{airport}</option>
            ))}
          </select>

          <select name="arrival" className="rounded-xl bg-slate-800 p-3" required>
            <option value="">Llegada</option>
            {AIRPORTS.map((airport) => (
              <option key={airport} value={airport}>{airport}</option>
            ))}
          </select>

          <input name="route" placeholder="Ruta" className="rounded-xl bg-slate-800 p-3" required />
          <input name="flightLevel" placeholder="FL350" className="rounded-xl bg-slate-800 p-3" required />

          <textarea name="notes" placeholder="Notas adicionales" className="rounded-xl bg-slate-800 p-3" />

          <button type="submit" className="rounded-xl bg-sky-500 p-3 font-semibold">
            Crear Plan de Vuelo
          </button>
        </form>
      </section>
    </main>
  );
}