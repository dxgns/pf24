import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import UserAvatar from "@/components/UserAvatar";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | PF24",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const canAccessATC = session.user?.permissions?.canAccessATC;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050612] px-6 py-10 text-white md:py-14">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-cover bg-center opacity-20"
        style={{
          backgroundImage:
            "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-[#050612]/30 via-[#050612]/85 to-[#050612]" />

      <section className="section-container relative z-10 max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={38} height={38} priority />
            <div className="text-xl font-extrabold tracking-tight">
              PF<span className="text-sky-400">24</span>
            </div>
          </a>

          <a
            href="/"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur transition hover:border-[#8095ff]/60 hover:bg-white/10 hover:text-white"
          >
            ← Volver al inicio
          </a>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-7 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4 md:gap-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-1">
                <UserAvatar image={session.user?.image} name={session.user?.name} />
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8095ff]">
                  Panel de usuario
                </p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                  Bienvenido, {session.user?.name ?? "usuario"}.
                </h1>
                <p className="mt-2 text-slate-400">
                  Accede a las herramientas operacionales de PF24.
                </p>
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

        <div className="mb-5 mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8095ff]">
            Plataforma operacional
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">
            Selecciona un módulo
          </h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            Todas tus herramientas mantienen sus accesos y funciones habituales.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <PortalCard
            href="/piloto"
            eyebrow="Pilot Operations"
            title="Portal Piloto"
            text="Crear, modificar y finalizar planes de vuelo. Consulta ATCs online y estados operativos."
          />

          <PortalCard
            href="/atc"
            eyebrow="ATC Operations"
            title="Portal ATC"
            text="Sector List, control de tráfico, posiciones activas, transponder y estados en tiempo real."
          />

          {canAccessATC && (
            <PortalCard
              href="/scope"
              eyebrow="PF24 Scope Beta"
              title="Scope ATC"
              text="Radar, flight data, coordinación, ventanas operacionales y modo de simulación."
            />
          )}

          <PortalCard
            href="/admin"
            eyebrow="Administration"
            title="Panel Admin"
            text="Configuración, roles, aeropuertos, posiciones ATC, auditoría y mantenimiento del sistema."
          />
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
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-black/10 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8095ff]">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold ${
          accent === "green" ? "text-green-300" : "text-white"
        }`}
      >
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
    <a
      href={href}
      className="group flex min-h-[260px] flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-xl shadow-black/10 transition duration-200 hover:-translate-y-1 hover:border-[#8095ff]/55 hover:bg-slate-900"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8095ff]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-2xl font-extrabold text-white transition group-hover:text-[#a9b5ff]">
        {title}
      </h2>
      <p className="mt-4 leading-7 text-slate-400">{text}</p>
      <p className="mt-auto pt-7 text-sm font-semibold text-[#8095ff]">
        Abrir módulo →
      </p>
    </a>
  );
}
