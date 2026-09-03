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

export const metadata: Metadata = {
  title: "Licencia PPL | PF24 Academia",
};

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
            <Link
              href="/academia/piloto"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Piloto {rank}
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto Privado</p>
          <h1 className="mt-3 text-4xl font-extrabold">Licencia PPL</h1>
        </div>

        <section className="panel mt-6 rounded-3xl p-8">
          <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Programa de formación</p>
          <h2 className="mt-4 text-2xl font-extrabold text-white">Objetivo</h2>
          <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">
            Proporcionar al piloto privado los conocimientos teóricos y prácticos necesarios para operar vuelos nacionales e internacionales bajo reglas VFR e IFR dentro del entorno de vuelo PF24. Este temario busca consolidar la formación iniciada en la licencia PE, ampliando las capacidades del piloto en navegación visual e instrumental, interpretación de cartas aeronáuticas, planificación avanzada y procedimientos IFR.
          </p>

          <div className="mt-8 border-t border-white/10 pt-7">
            <h2 className="text-2xl font-extrabold text-white">Introducción a la Licencia PPL</h2>
            <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">
              La licencia de Piloto Privado (PPL) constituye el segundo nivel de habilitación dentro del entorno PF24. Permite realizar vuelos de travesía bajo reglas VFR y vuelos controlados IFR, con conocimiento de navegación instrumental básica.
            </p>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300">
              El piloto PPL debe demostrar comprensión de las normas de tránsito aéreo, lectura e interpretación de cartas aeronáuticas, uso de radioayudas y procedimientos de vuelo controlado.
            </p>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300">
              Su objetivo principal es operar de forma segura y eficiente tanto en aeródromos controlados como no controlados, manteniendo comunicación efectiva con ATC y aplicando las regulaciones operativas correspondientes.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PPL_MODULES.map((title, index) => {
            const moduleNumber = index + 1;
            const evaluation = moduleNumber === PPL_EVALUATION_MODULE;
            const locked = evaluation && !evaluationUnlocked;
            const seen = seenModules.has(moduleNumber);

            if (locked) {
              return (
                <div
                  key={title}
                  aria-disabled="true"
                  className="panel cursor-not-allowed rounded-3xl border-white/5 p-6 opacity-55"
                >
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
            }

            return (
              <Link
                key={title}
                href={`/academia/piloto/ppl/contenido/${moduleNumber}`}
                className="panel group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">
                      Módulo {moduleNumber}{evaluation ? " · Evaluación" : ""}
                    </p>
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
