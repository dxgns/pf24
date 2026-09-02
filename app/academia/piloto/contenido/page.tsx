import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPilotRankFromRoles, nextPilotRank } from "@/lib/academyRanks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contenido Piloto | PF24 Academia",
};

export default async function PilotAcademyContentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") redirect("/access-denied");

  const nextRank = nextPilotRank(rank);
  if (!nextRank) redirect("/academia/piloto");

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

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto</p>
          <h1 className="mt-3 text-4xl font-extrabold">Contenido {nextRank}</h1>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => (
            <section key={index} className="panel rounded-3xl p-6">
              <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Módulo {index + 1}</p>
              <div className="mt-5 min-h-[150px] rounded-2xl border border-white/5 bg-slate-950/30" />
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
