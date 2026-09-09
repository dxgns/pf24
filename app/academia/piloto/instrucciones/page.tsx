import { auth } from "@/auth";
import InstructionQueueBoard from "@/components/academy/InstructionQueueBoard";
import { listAcademyInstructionRequests } from "@/lib/academyInstructionQueue";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

const PILOT_INSTRUCTIONS_ROLE_ID = "1427450639507656846";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Instrucciones Piloto | PF24 Academia" };

export default async function PilotInstructionsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canAccess = session.user?.permissions?.roles?.includes(PILOT_INSTRUCTIONS_ROLE_ID) ?? false;
  if (!canAccess) redirect("/access-denied");

  let pending = [];
  let instruction = [];
  let loadError = false;

  try {
    const queue = await listAcademyInstructionRequests("pilot");
    pending = queue.pending;
    instruction = queue.instruction;
  } catch (error) {
    console.error("PF24 pilot instruction queue error:", error);
    loadError = true;
  }

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-6xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/academia/piloto" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300">← Piloto</Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Academia Piloto</p>
          <h1 className="mt-3 text-4xl font-extrabold">Instrucciones</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">Gestión de alumnos que enviaron su evaluación de Piloto y seguimiento de quienes ya fueron asumidos por un instructor.</p>
        </div>

        {loadError ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-200">
            No se pudo cargar temporalmente la cola de instrucción. Vuelve a intentar en unos instantes.
          </div>
        ) : (
          <div className="mt-6">
            <InstructionQueueBoard track="pilot" pending={pending} instruction={instruction} />
          </div>
        )}
      </section>
    </main>
  );
}
