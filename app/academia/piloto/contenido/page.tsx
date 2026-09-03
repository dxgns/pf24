import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import {
  PE_MODULES,
  PILOT_EVALUATION_MODULE,
  PILOT_PROGRESS_COOKIE,
  isPilotEvaluationUnlocked,
  parseSeenPilotModules,
} from "@/lib/academy/pilotModules";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Licencia PE | PF24 Academia" };

export default async function PilotAcademyContentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") redirect("/access-denied");

  const cookieStore = await cookies();
  const seenModules = parseSeenPilotModules(cookieStore.get(PILOT_PROGRESS_COOKIE)?.value);
  const evaluationUnlocked = isPilotEvaluationUnlocked(seenModules);

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-6xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/academia/piloto" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300">← Piloto {rank}</Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>
          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto Estudiante · Formación inicial</p>
          <h1 className="mt-3 text-4xl font-extrabold">Licencia PE</h1>
        </div>

        <section className="panel mt-6 space-y-6 rounded-3xl p-8">
          <div>
            <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Programa de formación</p>
            <h2 className="mt-4 text-2xl font-extrabold text-white">Objetivo</h2>
            <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">Brindar al piloto estudiante los conocimientos teóricos y prácticos necesarios para operar vuelos locales VFR de forma segura y coordinada. El alumno aprenderá a interpretar la información disponible, preparar un plan local, desplazarse por el aeródromo, realizar el circuito y comunicarse con ATC.</p>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300">Las explicaciones presentan conocimientos y procedimientos aeronáuticos generales. Cuando una función de cabina no está disponible en Project Flight, se aclara expresamente cómo utilizar el valor equivalente que sí aparece en pantalla.</p>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Alcance</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">La licencia PE permite realizar vuelos locales bajo reglas VFR en los aeródromos habilitados para instrucción. Es una habilitación destinada a la actividad de simulación y no equivale a una licencia aeronáutica real.</p>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PE_MODULES.map((title, index) => {
            const moduleNumber = index + 1;
            const evaluation = moduleNumber === PILOT_EVALUATION_MODULE;
            const locked = evaluation && !evaluationUnlocked;
            const seen = seenModules.has(moduleNumber);

            if (locked) return (
              <div key={title} aria-disabled="true" className="panel cursor-not-allowed rounded-3xl border-white/5 p-6 opacity-55">
                <div className="flex items-center justify-between gap-4">
                  <p className="mono text-xs uppercase tracking-[0.2em] text-slate-500">Módulo {moduleNumber} · Evaluación</p>
                  <span className="text-lg text-slate-500" aria-hidden="true">🔒</span>
                </div>
                <h2 className="mt-4 text-lg font-extrabold leading-snug text-slate-300">{title}</h2>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs text-slate-500">Debes ver los módulos 1–{PILOT_EVALUATION_MODULE - 1}</span>
                  <span className="mono text-sm text-slate-500">Bloqueado</span>
                </div>
              </div>
            );

            return (
              <Link key={title} href={`/academia/piloto/contenido/${moduleNumber}`} className="panel group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900/80">
                <div className="flex items-center justify-between gap-4">
                  <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Módulo {moduleNumber}{evaluation ? " · Evaluación" : ""}</p>
                  {seen && !evaluation && <span className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">Visto</span>}
                </div>
                <h2 className="mt-4 text-lg font-extrabold leading-snug text-white">{title}</h2>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs text-slate-500">{evaluation ? "Iniciar evaluación" : "Ver contenido individual"}</span>
                  <span className="mono text-sm text-sky-300 transition group-hover:translate-x-1">Abrir módulo →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
