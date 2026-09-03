import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import {
  PPL_EVALUATION_MODULE,
  PPL_MODULES,
  PPL_PROGRESS_COOKIE,
  isPplEvaluationUnlocked,
  parseSeenPplModules,
} from "@/lib/academy/pplModules";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Licencia PPL | PF24 Academia" };

export default async function PplAcademyContentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") redirect("/access-denied");

  const cookieStore = await cookies();
  const seenModules = parseSeenPplModules(cookieStore.get(PPL_PROGRESS_COOKIE)?.value);
  const evaluationUnlocked = isPplEvaluationUnlocked(seenModules);

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-6xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/academia/piloto" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300">← Piloto {rank}</Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>
          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto Privado · Formación teórica y operativa</p>
          <h1 className="mt-3 text-4xl font-extrabold">Licencia PPL</h1>
        </div>

        <section className="panel mt-6 space-y-7 rounded-3xl p-8">
          <div>
            <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Programa de formación</p>
            <h2 className="mt-4 text-2xl font-extrabold text-white">Objetivo</h2>
            <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">Brindar al piloto privado los conocimientos teóricos y prácticos necesarios para planificar y operar vuelos de travesía VFR y vuelos controlados IFR dentro de PF24. El temario consolida la formación PE y explica cómo interpretar la información, tomar decisiones, comunicarse con ATC y aplicar los procedimientos durante cada fase del vuelo.</p>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300">Este material de estudio no se limita a enumerar contenidos: define conceptos, explica su utilidad y muestra ejemplos de aplicación. Las cartas, normas internas de PF24 e instrucciones de ATC vigentes siempre tienen prioridad sobre los ejemplos.</p>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Alcance</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">La licencia PPL de PF24 es una habilitación interna para simulación. No equivale a una licencia aeronáutica real ni reemplaza formación impartida por una autoridad o escuela de vuelo.</p>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PPL_MODULES.map((title, index) => {
            const moduleNumber = index + 1;
            const evaluation = moduleNumber === PPL_EVALUATION_MODULE;
            const locked = evaluation && !evaluationUnlocked;
            const seen = seenModules.has(moduleNumber);

            if (locked) return (
              <div key={title} aria-disabled="true" className="panel cursor-not-allowed rounded-3xl border-white/5 p-6 opacity-55">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono text-xs uppercase tracking-[0.2em] text-slate-500">Módulo {moduleNumber} · Evaluación</p>
                    <h2 className="mt-4 text-lg font-extrabold leading-snug text-slate-300">{title}</h2>
                  </div>
                  <span className="text-lg text-slate-500" aria-hidden="true">🔒</span>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs text-slate-500">Debes ver los módulos 1–{PPL_EVALUATION_MODULE - 1}</span>
                  <span className="mono text-sm text-slate-500">Bloqueado</span>
                </div>
              </div>
            );

            return (
              <Link key={title} href={`/academia/piloto/ppl/contenido/${moduleNumber}`} className="panel group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Módulo {moduleNumber}{evaluation ? " · Evaluación" : ""}</p>
                    <h2 className="mt-4 text-lg font-extrabold leading-snug text-white">{title}</h2>
                  </div>
                  {seen && !evaluation && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Visto</span>}
                </div>
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
