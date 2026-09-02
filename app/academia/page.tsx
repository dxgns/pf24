import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Academia | PF24",
};

export default async function AcademiaPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const permissions = session.user?.permissions;
  const pilotRank = getPilotRankFromRoles(permissions?.roles);
  const atcRank = permissions?.atcRank ?? "NONE";

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-6xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Dashboard
            </Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Training</p>
          <h1 className="mt-3 text-4xl font-extrabold">Academia</h1>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <AcademyTrackCard
            href={pilotRank === "NONE" ? null : "/academia/piloto"}
            title={`Piloto ${pilotRank === "NONE" ? "Sin rango" : pilotRank}`}
          />
          <AcademyTrackCard
            href={atcRank === "NONE" ? null : "/academia/atc"}
            title={`ATC ${atcRank === "NONE" ? "Sin rango" : atcRank}`}
          />
        </div>
      </section>
    </main>
  );
}

function AcademyTrackCard({ href, title }: { href: string | null; title: string }) {
  const className = "panel rounded-3xl p-8 transition";

  if (!href) {
    return (
      <div className={`${className} cursor-not-allowed opacity-45`} aria-disabled="true">
        <p className="mono text-xs uppercase tracking-[0.25em] text-slate-500">Academia</p>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-300">{title}</h2>
      </div>
    );
  }

  return (
    <Link href={href} className={`${className} group hover:-translate-y-1 hover:border-sky-400/60`}>
      <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Academia</p>
      <h2 className="mt-4 text-2xl font-extrabold text-white group-hover:text-sky-300">{title}</h2>
      <p className="mono mt-8 text-sm text-sky-300">Abrir →</p>
    </Link>
  );
}
