import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AtcModuleProgress from "@/components/academy/AtcModuleProgress";
import { nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Módulo ATC | PF24 Academia",
};

const MODULE_COUNT = 10;
const EVALUATION_MODULE = MODULE_COUNT;

type Props = {
  params: Promise<{ module: string }>;
};

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

export default async function AtcAcademyModulePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  if (rank === "NONE") redirect("/access-denied");

  const nextRank = nextAtcRank(rank);
  if (!nextRank) redirect("/academia/atc");

  const { module } = await params;
  const moduleNumber = Number(module);
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber > MODULE_COUNT) notFound();

  const cookieName = progressCookieName(nextRank);
  if (moduleNumber === EVALUATION_MODULE) {
    const cookieStore = await cookies();
    const seenModules = parseSeenModules(cookieStore.get(cookieName)?.value);
    const evaluationUnlocked = Array.from({ length: EVALUATION_MODULE - 1 }, (_, index) => index + 1)
      .every((requiredModule) => seenModules.has(requiredModule));

    if (!evaluationUnlocked) redirect("/academia/atc/contenido");
  }

  const previous = moduleNumber > 1 ? moduleNumber - 1 : null;
  const next = moduleNumber < MODULE_COUNT ? moduleNumber + 1 : null;
  const evaluation = moduleNumber === EVALUATION_MODULE;

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <AtcModuleProgress cookieName={cookieName} moduleNumber={moduleNumber} />
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/academia/atc/contenido"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Todos los módulos
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">ATC · Formación {nextRank}</p>
          <p className="mono mt-5 text-sm uppercase tracking-[0.22em] text-sky-300">Módulo {moduleNumber} de {MODULE_COUNT}</p>
          <h1 className="mt-3 text-4xl font-extrabold">{evaluation ? "Evaluación" : `Módulo ${moduleNumber}`}</h1>
        </div>

        <section className="panel mt-6 min-h-[420px] rounded-3xl p-8">
          <div className="min-h-[340px] rounded-2xl border border-white/5 bg-slate-950/30" />
        </section>

        <nav className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Navegación entre módulos">
          {previous ? (
            <Link
              href={`/academia/atc/contenido/${previous}`}
              className="panel rounded-2xl p-5 transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">← Módulo {previous}</span>
            </Link>
          ) : <div />}
          {next && (
            <Link
              href={`/academia/atc/contenido/${next}`}
              className="panel rounded-2xl p-5 text-right transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">
                {next === EVALUATION_MODULE ? "Evaluación" : `Módulo ${next}`} →
              </span>
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
