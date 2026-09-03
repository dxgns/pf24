import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import PplModuleContent from "@/components/academy/PplModuleContent";
import PplModuleProgress from "@/components/academy/PplModuleProgress";
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
  title: "Módulo PPL | PF24 Academia",
};

type Props = {
  params: Promise<{ module: string }>;
};

export default async function PplAcademyModulePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") redirect("/access-denied");

  const { module } = await params;
  const moduleNumber = Number(module);
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber > PPL_MODULES.length) notFound();

  if (moduleNumber === PPL_EVALUATION_MODULE) {
    const cookieStore = await cookies();
    const seenModules = parseSeenPplModules(cookieStore.get(PPL_PROGRESS_COOKIE)?.value);
    if (!isPplEvaluationUnlocked(seenModules)) redirect("/academia/piloto/ppl/contenido");
  }

  const title = PPL_MODULES[moduleNumber - 1];
  const previous = moduleNumber > 1 ? moduleNumber - 1 : null;
  const next = moduleNumber < PPL_MODULES.length ? moduleNumber + 1 : null;

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <PplModuleProgress moduleNumber={moduleNumber} />
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/academia/piloto/ppl/contenido"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Todos los módulos
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto Privado · Licencia PPL</p>
          <p className="mono mt-5 text-sm uppercase tracking-[0.22em] text-sky-300">Módulo {moduleNumber} de {PPL_MODULES.length}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight">{title}</h1>
        </div>

        <article className="panel mt-6 rounded-3xl p-8 md:p-10">
          <PplModuleContent moduleNumber={moduleNumber} />
        </article>

        <nav className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Navegación entre módulos">
          {previous ? (
            <Link
              href={`/academia/piloto/ppl/contenido/${previous}`}
              className="panel rounded-2xl p-5 transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">← Módulo {previous}</span>
              <span className="mt-2 block text-sm font-semibold text-slate-200">{PPL_MODULES[previous - 1]}</span>
            </Link>
          ) : <div />}
          {next && (
            <Link
              href={`/academia/piloto/ppl/contenido/${next}`}
              className="panel rounded-2xl p-5 text-right transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">
                {next === PPL_EVALUATION_MODULE ? "Evaluación" : `Módulo ${next}`} →
              </span>
              <span className="mt-2 block text-sm font-semibold text-slate-200">{PPL_MODULES[next - 1]}</span>
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
