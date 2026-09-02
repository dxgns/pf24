import { auth } from "@/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Módulo PE | PF24 Academia",
};

const PE_MODULES = [
  "INFORMACIÓN METEOROLÓGICA Y Q-CODES",
  "ALTIMETRÍA BÁSICA",
  "CARTAS DE RODAJE Y OPERACIONES EN SUPERFICIE",
  "DIFERENCIAS ENTRE VFR E IFR",
  "CIRCUITO DE TRÁNSITO AERONÁUTICO",
  "PLAN DE VUELO VFR LOCAL",
  "LUCES DE AERONAVE",
  "MANEJO DE ESCENARIOS IMPREVISTOS",
  "FRASEOLOGÍA Y COMUNICACIONES",
  "EVALUACIÓN Y HABILITACIÓN",
] as const;

type Props = {
  params: Promise<{ module: string }>;
};

export default async function PilotAcademyModulePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") redirect("/access-denied");

  const { module } = await params;
  const moduleNumber = Number(module);
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber > PE_MODULES.length) notFound();

  const title = PE_MODULES[moduleNumber - 1];
  const previous = moduleNumber > 1 ? moduleNumber - 1 : null;
  const next = moduleNumber < PE_MODULES.length ? moduleNumber + 1 : null;

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/academia/piloto/contenido"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Todos los módulos
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24 ACADEMIA</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto Estudiante · Licencia PE</p>
          <p className="mono mt-5 text-sm uppercase tracking-[0.22em] text-sky-300">Módulo {moduleNumber} de {PE_MODULES.length}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight">{title}</h1>
        </div>

        <section className="panel mt-6 min-h-[420px] rounded-3xl p-8">
          <div className="min-h-[340px] rounded-2xl border border-white/5 bg-slate-950/30" />
        </section>

        <nav className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Navegación entre módulos">
          {previous ? (
            <Link
              href={`/academia/piloto/contenido/${previous}`}
              className="panel rounded-2xl p-5 transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">← Módulo {previous}</span>
              <span className="mt-2 block text-sm font-semibold text-slate-200">{PE_MODULES[previous - 1]}</span>
            </Link>
          ) : <div />}
          {next && (
            <Link
              href={`/academia/piloto/contenido/${next}`}
              className="panel rounded-2xl p-5 text-right transition hover:border-sky-400/40 hover:bg-slate-900/80"
            >
              <span className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">Módulo {next} →</span>
              <span className="mt-2 block text-sm font-semibold text-slate-200">{PE_MODULES[next - 1]}</span>
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
