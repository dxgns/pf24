import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

const ATC_INSTRUCTIONS_ROLE_ID = "1427450636508725449";

export const metadata: Metadata = { title: "Instrucciones ATC | PF24 Academia" };

export default async function AtcInstructionsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canAccess = session.user?.permissions?.roles?.includes(ATC_INSTRUCTIONS_ROLE_ID) ?? false;
  if (!canAccess) redirect("/access-denied");

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/academia/atc" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300">← ATC</Link>
            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24</div>
          </div>

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Academia ATC</p>
          <h1 className="mt-3 text-4xl font-extrabold">Instrucciones</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">Espacio reservado para las instrucciones internas de la Academia ATC.</p>
        </div>
      </section>
    </main>
  );
}
