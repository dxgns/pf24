import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import UserAvatar from "@/components/UserAvatar";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | PF24",
};

export default async function DashboardPage() {
  let session;

  try {
    session = await auth();
  } catch (error) {
    console.error("PF24 Dashboard auth error:", error);
    redirect("/login");
  }

  if (!session) {
    redirect("/login");
  }

  const canAccessPilot = session.user?.permissions?.canAccessPilot;
  const canAccessATC = session.user?.permissions?.canAccessATC;
  const canAccessAdmin = session.user?.permissions?.canAccessAdmin;

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-7xl">
        <div className="panel rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
            >
              ← Inicio
            </Link>

            <div className="mono text-sm tracking-[0.25em] text-slate-400">PF24</div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <UserAvatar image={session.user?.image} name={session.user?.name} />
              <div>
                <h1 className="mt-2 text-4xl font-extrabold">
                  Bienvenido, {session.user?.name ?? "usuario"}.
                </h1>
                <p className="mt-2 text-slate-400">Dashboard</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InfoCard label="Usuario" value={session.user?.name ?? "N/A"} />
          <InfoCard label="Hora UTC" value={<UtcClock />} />
          <InfoCard label="Sistema" value="ONLINE" accent="green" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {canAccessPilot && (
            <PortalCard
              href="/pfpilot"
              eyebrow="PFPilot Beta"
              title="PFPilot"
              text="Herramientas modulares de vuelo: cabina, plan de vuelo, ATIS, frecuencias, chat y asistencia al piloto."
            />
          )}

          {canAccessATC && (
            <PortalCard
              href="/scope"
              eyebrow="PFScope Beta"
              title="PFScope"
              text="Radar, flight data, coordinación, ventanas operacionales y modo de simulación."
            />
          )}

          <PortalCard
            href="/pfradar"
            eyebrow="PF24 Radar"
            title="PFRadar"
            text="Portal dedicado a PFRadar dentro de la plataforma PF24."
          />

          <PortalCard
            href="/academia"
            eyebrow="Training"
            title="Academia"
            text="Formación de piloto y ATC organizada según el rango actual del usuario."
          />

          {canAccessAdmin && (
            <PortalCard
              href="/admin"
              eyebrow="Administration"
              title="Panel Admin"
              text="Configuración, roles, aeropuertos, posiciones ATC, auditoría y mantenimiento del sistema."
            />
          )}
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "green";
}) {
  return (
    <div className="panel rounded-2xl p-5">
      <p className="mono text-xs text-sky-300/70">{label}</p>
      <p className={`mono mt-2 text-xl font-bold ${accent === "green" ? "text-green-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function PortalCard({
  href,
  eyebrow,
  title,
  text,
}: {
  href: string;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="panel group rounded-3xl p-8 transition hover:-translate-y-1 hover:border-sky-400/60"
    >
      <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">{eyebrow}</p>
      <h2 className="mt-4 text-2xl font-extrabold text-white group-hover:text-sky-300">{title}</h2>
      <p className="mt-4 leading-7 text-slate-400">{text}</p>
      <p className="mt-6 mono text-sm text-sky-300">Abrir módulo →</p>
    </Link>
  );
}
