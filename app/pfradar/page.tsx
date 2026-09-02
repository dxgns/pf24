import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PFRadar | PF24",
};

export default async function PFRadarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-7xl">
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

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Radar</p>
          <h1 className="mt-3 text-4xl font-extrabold">PFRadar</h1>
        </div>

        <div className="panel mt-6 min-h-[420px] rounded-3xl" />
      </section>
    </main>
  );
}
