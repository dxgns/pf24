import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import UserAvatar from "@/components/UserAvatar";
import UtcClock from "@/components/UtcClock";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-24 text-white">
      <section className="section-container max-w-7xl">
        <div className="panel rounded-3xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <UserAvatar image={session.user?.image} name={session.user?.name} />

              <div>
                <p className="mono text-xs uppercase tracking-[0.3em] text-sky-300/70">
                  PF24 Español / Operations Center
                </p>

                <h1 className="mt-2 text-4xl font-extrabold">
                  Dashboard
                </h1>

                <p className="mt-2 text-slate-400">
                  Bienvenido, {session.user?.name ?? "usuario"}.
                </p>
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <InfoCard label="Usuario" value={session.user?.name ?? "N/A"} />
          <InfoCard label="Hora UTC" value={<UtcClock />} />
          <InfoCard label="Sistema" value="ONLINE" accent="green" />
          <InfoCard label="Modo" value="PF24 OPS" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
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

          <PortalCard
            href="/admin"
            eyebrow="Administration"
            title="Panel Admin"
            text="Configuración, roles, aeropuertos, posiciones ATC, auditoría y mantenimiento del sistema."
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="panel rounded-3xl p-8">
            <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">
              Plataforma
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              Estado operacional
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <StatusLine label="Discord OAuth" value="Activo" />
              <StatusLine label="Supabase Database" value="Activo" />
              <StatusLine label="Realtime" value="Activo" />
              <StatusLine label="Auto finish cron" value="Externo" />
            </div>
          </div>

          <div className="panel rounded-3xl p-8">
            <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">
              Accesos rápidos
            </p>

            <div className="mt-6 grid gap-3">
              <QuickLink href="/piloto" label="Nuevo plan de vuelo" />
              <QuickLink href="/atc" label="Abrir Sector List" />
              <QuickLink href="/" label="Volver al inicio público" />
            </div>
          </div>
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
      <p
        className={`mono mt-2 text-xl font-bold ${
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
      className="panel group rounded-3xl p-8 transition hover:-translate-y-1 hover:border-sky-400/60"
    >
      <p className="mono text-xs uppercase tracking-[0.25em] text-sky-300/70">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-2xl font-extrabold text-white group-hover:text-sky-300">
        {title}
      </h2>

      <p className="mt-4 leading-7 text-slate-400">
        {text}
      </p>

      <p className="mt-6 mono text-sm text-sky-300">
        Abrir módulo →
      </p>
    </a>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#020617] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mono mt-1 font-bold text-green-300">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-white/10 bg-[#020617] px-4 py-3 font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
    >
      {label}
    </a>
  );
}