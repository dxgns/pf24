import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licencia PE | PF24 Academia",
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

export default async function PilotAcademyContentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") redirect("/access-denied");

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

          <p className="mono mt-10 text-xs uppercase tracking-[0.28em] text-sky-300/70">Piloto Estudiante</p>
          <h1 className="mt-3 text-4xl font-extrabold">Licencia PE</h1>
        </div>

        <section className="panel mt-6 rounded-3xl p-8">
          <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">Programa de formación</p>
          <h2 className="mt-4 text-2xl font-extrabold text-white">Objetivo</h2>
          <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">
            Brindar al piloto estudiante los conocimientos teóricos y prácticos necesarios para operar vuelos en circuito visual (VFR) de manera segura y coordinada dentro del servidor PF24. Este temario prepara al alumno para comprender la fraseología básica, lectura de información aeródromo y el uso adecuado de las luces de aeronave.
          </p>

          <div className="mt-8 border-t border-white/10 pt-7">
            <h2 className="text-2xl font-extrabold text-white">Introducción a la Licencia PE</h2>
            <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-300">
              La Licencia de Piloto Estudiante (PE) es el primer paso en la formación de un piloto dentro del entorno de vuelo PF24.
            </p>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300">
              Esta habilitación permite realizar vuelos locales bajo reglas VFR (Visual Flight Rules), en condiciones meteorológicas visuales y con un conocimiento básico de los procedimientos operativos.
            </p>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300">
              El piloto estudiante debe ser capaz de mantener el control de la aeronave en un entorno simple, respetar las instrucciones de ATC, y operar en zonas de tránsito aéreo de baja complejidad como aeródromos con circuitos visuales establecidos.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PE_MODULES.map((title, index) => (
            <section key={title} className="panel rounded-3xl p-6">
              <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Módulo {index + 1}</p>
              <h2 className="mt-4 text-lg font-extrabold leading-snug text-white">{title}</h2>
              <div className="mt-5 min-h-[120px] rounded-2xl border border-white/5 bg-slate-950/30" />
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
