import { auth } from "@/auth";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AtcModuleProgress from "@/components/academy/AtcModuleProgress";
import AtcS1ExamForm from "@/components/academy/AtcS1ExamForm";
import AtcS1ModuleContent from "@/components/academy/AtcS1ModuleContent";
import EvaluationSubmissionCard from "@/components/academy/EvaluationSubmissionCard";
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
  title: "Módulo ATC | PF24 Academia",
};
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ module: string }>;
};

export default async function AtcAcademyModulePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  if (rank === "NONE") redirect("/access-denied");

  const canReviewS1 = session.user?.permissions?.roles?.includes(ATC_INSTRUCTIONS_ROLE_ID) ?? false;
  const trainingRank = resolveAtcTrainingRank(rank, canReviewS1);
  if (!trainingRank) redirect("/academia/atc");

  const moduleTitles = getAtcModuleTitles(trainingRank);
  const evaluationModule = getAtcEvaluationModule(trainingRank);

  const { module } = await params;
  const moduleNumber = Number(module);
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber > moduleTitles.length) notFound();

  if (moduleNumber === evaluationModule) {
    const cookieStore = await cookies();
    const seenModules = parseSeenAtcModules(
      cookieStore.get(atcProgressCookieName(trainingRank))?.value,
      trainingRank,
    );
    if (!isAtcEvaluationUnlocked(seenModules, trainingRank)) redirect("/academia/atc/contenido");
  }

  const title = moduleTitles[moduleNumber - 1];
  const previous = moduleNumber > 1 ? moduleNumber - 1 : null;
  const next = moduleNumber < moduleTitles.length ? moduleNumber + 1 : null;
  const evaluation = moduleNumber === evaluationModule;
  const isS1 = trainingRank === "S1";
  const isS1Evaluation = evaluation && isS1;
  const applicantDiscordId = session.user?.discordId ?? session.user?.email ?? session.user?.name ?? "unknown";

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <AtcModuleProgress moduleNumber={moduleNumber} evaluationModule={evaluationModule} />
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              prefetch={false}
              href="/academia/atc/contenido"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Todos los módulos
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">ATC · Formación {trainingRank}</p>
          <p className="mono mt-5 text-sm uppercase tracking-[0.22em] text-sky-300">Módulo {moduleNumber} de {moduleTitles.length}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight">{title}</h1>
          {rank === "CI" && trainingRank === "S1" ? (
            <p className="mt-3 text-xs text-slate-500">Vista de instructor del programa S1.</p>
          ) : null}
        </div>

        {isS1Evaluation ? (
          <AtcS1ExamForm />
        ) : !evaluation && isS1 ? (
          <article className="panel mt-6 rounded-3xl p-8 md:p-10">
            <AtcS1ModuleContent moduleNumber={moduleNumber} />
          </article>
        ) : !evaluation ? (
          <section className="panel mt-6 min-h-[420px] rounded-3xl p-8">
            <div className="min-h-[340px] rounded-2xl border border-white/5 bg-slate-950/30" />
          </section>
        ) : null}

        {evaluation && !isS1Evaluation ? (
          <EvaluationSubmissionCard track="atc" targetRole={trainingRank} applicantDiscordId={applicantDiscordId} />
        ) : null}

        <nav className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Navegación entre módulos">
          {previous ? (
            <Link
              prefetch={false}
              href={`/academia/atc/contenido/${previous}`}
              className="panel rounded-2xl p-5 transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">← Módulo {previous}</span>
              <span className="mt-2 block text-sm font-semibold text-slate-200">{moduleTitles[previous - 1]}</span>
            </Link>
          ) : <div />}
          {next && (
            <Link
              prefetch={false}
              href={`/academia/atc/contenido/${next}`}
              className="panel rounded-2xl p-5 text-right transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">{next === evaluationModule ? "Evaluación" : `Módulo ${next}`} →</span>
              <span className="mt-2 block text-sm font-semibold text-slate-200">{moduleTitles[next - 1]}</span>
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
