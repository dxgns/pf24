import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import type { Metadata } from "next";

const ATC_INSTRUCTIONS_ROLE_ID = "1427450636508725449";

export const metadata: Metadata = {
  title: "Academia ATC | PF24",
};

export default async function AtcAcademyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user?.permissions?.roles;
  const rank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  if (rank === "NONE") redirect("/access-denied");

  const nextRank = nextAtcRank(rank);
  const canAccessInstructions = roles?.includes(ATC_INSTRUCTIONS_ROLE_ID) ?? false;

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/academia"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Academia
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">ATC</p>
          <h1 className="mt-3 text-4xl font-extrabold">ATC {rank}</h1>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {nextRank ? (
            <Link
              href="/academia/atc/contenido"
              className="panel group block rounded-3xl p-8 transition hover:-translate-y-1 hover:border-sky-400/60"
            >
              <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Formación</p>
              <h2 className="mt-4 text-2xl font-extrabold text-white group-hover:text-sky-300">
                Contenido {nextRank}
              </h2>
              <p className="mono mt-8 text-sm text-sky-300">Abrir contenido →</p>
            </Link>
          ) : (
            <div className="panel rounded-3xl p-8 opacity-55">
              <h2 className="text-2xl font-extrabold text-slate-300">Sin contenido de rango superior</h2>
            </div>
          )}

          {canAccessInstructions && (
            <Link
              href="/academia/atc/instrucciones"
              className="panel group block rounded-3xl p-8 transition hover:-translate-y-1 hover:border-sky-400/60"
            >
              <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Acceso restringido</p>
              <h2 className="mt-4 text-2xl font-extrabold text-white group-hover:text-sky-300">Instrucciones</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">Instrucciones internas de la Academia ATC.</p>
              <p className="mono mt-8 text-sm text-sky-300">Abrir instrucciones →</p>
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
