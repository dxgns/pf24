import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contenido ATC | PF24 Academia",
};

const ATC_MODULES = Array.from({ length: 10 }, (_, index) => ({
  number: index + 1,
}));
const EVALUATION_MODULE = ATC_MODULES.length;

function progressCookieName(rank: AtcRank) {
  return `pf24_atc_academy_seen_${rank}`;
}

function parseSeenModules(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0),
  );
}

export default async function AtcAcademyContentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  if (rank === "NONE") redirect("/access-denied");

  const nextRank = nextAtcRank(rank);
  if (!nextRank) redirect("/academia/atc");

  const cookieStore = await cookies();
  const seenModules = parseSeenModules(cookieStore.get(progressCookieName(nextRank))?.value);
  const evaluationUnlocked = Array.from({ length: EVALUATION_MODULE - 1 }, (_, index) => index + 1)
    .every((moduleNumber) => seenModules.has(moduleNumber));

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-6xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/academia/atc"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← ATC {rank}
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">ATC</p>
          <h1 className="mt-3 text-4xl font-extrabold">Contenido {nextRank}</h1>
          <p className="mt-3 text-sm text-slate-400">Programa organizado en 10 módulos. La evaluación se habilita después de ver los módulos anteriores.</p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {ATC_MODULES.map((module) => {
            const evaluation = module.number === EVALUATION_MODULE;
            const locked = evaluation && !evaluationUnlocked;

            if (locked) {
              return (
                <div
                  key={module.number}
                  aria-disabled="true"
                  className="panel cursor-not-allowed rounded-3xl border-white/5 p-6 opacity-55"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="mono text-xs uppercase tracking-[0.2em] text-slate-500">Módulo {module.number} · Evaluación</p>
                    <span className="text-lg text-slate-500" aria-hidden="true">🔒</span>
                  </div>
                  <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-xs text-slate-500">Debes ver los módulos 1–{EVALUATION_MODULE - 1}</span>
                    <span className="mono text-sm text-slate-500">Bloqueado</span>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={module.number}
                href={`/academia/atc/contenido/${module.number}`}
                className="panel group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900/80"
              >
                <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">
                  Módulo {module.number}{evaluation ? " · Evaluación" : ""}
                </p>
                <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-4">
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
