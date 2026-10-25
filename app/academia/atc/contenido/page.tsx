import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type AtcRank } from "@/lib/academyRanks";
import {
  atcProgressCookieName,
  getAtcEvaluationModule,
  getAtcModuleTitles,
  isAtcEvaluationUnlocked,
  parseSeenAtcModules,
  resolveAtcTrainingRank,
} from "@/lib/academy/atcS1Modules";
import type { Metadata } from "next";

const ATC_INSTRUCTIONS_ROLE_ID = "1427450636508725449";

export const metadata: Metadata = {
  title: "Contenido ATC | PF24 Academia",
};
export const dynamic = "force-dynamic";

export default async function AtcAcademyContentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  if (rank === "NONE") redirect("/access-denied");

  const canReviewS1 = session.user?.permissions?.roles?.includes(ATC_INSTRUCTIONS_ROLE_ID) ?? false;
  const trainingRank = resolveAtcTrainingRank(rank, canReviewS1);
  if (!trainingRank) redirect("/academia/atc");

  const moduleTitles = getAtcModuleTitles(trainingRank);
  const evaluationModule = getAtcEvaluationModule(trainingRank);
  const cookieStore = await cookies();
  const seenModules = parseSeenAtcModules(
    cookieStore.get(atcProgressCookieName(trainingRank))?.value,
    trainingRank,
  );
  const evaluationUnlocked = isAtcEvaluationUnlocked(seenModules, trainingRank);
  const isS1 = trainingRank === "S1";

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-6xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              prefetch={false}
              href="/academia/atc"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← ATC {rank}
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">ATC</p>
          <h1 className="mt-3 text-4xl font-extrabold">Contenido {trainingRank}</h1>
          <p className="mt-3 text-sm text-slate-400">
            Programa organizado en {moduleTitles.length} módulos. La evaluación se habilita después de ver los módulos anteriores.
          </p>
          {rank === "CI" && trainingRank === "S1" ? (
            <p className="mt-2 text-xs text-slate-500">Vista de instructor del contenido S1.</p>
          ) : null}
        </div>

        {isS1 ? (
          <section className="panel mt-6 space-y-6 rounded-3xl p-8">
            <div>
              <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Temario oficial S1 · PF24 ATC</p>
              <h2 className="mt-4 text-2xl font-extrabold text-white">Objetivo</h2>
              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">
                Preparar al controlador para cubrir autorizaciones IFR/VFR y superficie en aeródromos pequeños y aeropuertos grandes, comprendiendo información meteorológica, lectura de cartas y gestión de salidas estándar.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
              <h3 className="mono text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Requisitos para aprobar S1</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Para obtener la habilitación S1 es necesario demostrar capacidad para interpretar METAR y ATIS, seleccionar correctamente la pista activa, emitir autorizaciones IFR y VFR con claridad, asignar correctamente calles de rodaje y puntos de espera, utilizar cartas de superficie y SID básicas, aplicar adecuadamente TA, TL, QNH y QNE, coordinar con torre cuando sea necesario y manejar situaciones básicas como fallos de comunicación o cierres temporales de pista.
              </p>
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {moduleTitles.map((title, index) => {
            const moduleNumber = index + 1;
            const evaluation = moduleNumber === evaluationModule;
            const locked = evaluation && !evaluationUnlocked;
            const seen = seenModules.has(moduleNumber);

            if (locked) {
              return (
                <div
                  key={`${trainingRank}-${moduleNumber}`}
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
                    <span className="text-xs text-slate-500">Debes ver los módulos 1–{evaluationModule - 1}</span>
                    <span className="mono text-sm text-slate-500">Bloqueado</span>
                  </div>
                </div>
              );
            }

            return (
              <Link
                prefetch={false}
                key={`${trainingRank}-${moduleNumber}`}
                href={`/academia/atc/contenido/${moduleNumber}`}
                className="panel group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900/80"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">
                      Módulo {moduleNumber}{evaluation ? " · Evaluación" : ""}
                    </p>
                    <h2 className="mt-4 text-lg font-extrabold leading-snug text-white">{title}</h2>
                  </div>
                  {seen && !evaluation ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Visto</span>
                  ) : null}
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
