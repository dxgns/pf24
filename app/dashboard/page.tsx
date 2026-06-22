import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import UserAvatar from "@/components/UserAvatar";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#050816] px-6 py-24 text-white">
      <section className="section-container">
        <div className="mb-8 flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900 p-6">
          <div className="flex items-center gap-4">
            <UserAvatar image={session.user?.image} name={session.user?.name} />

            <div>
              <p className="text-sm text-slate-400">Sesión iniciada</p>
              <h1 className="text-2xl font-extrabold">
                {session.user?.name ?? "Usuario"}
              </h1>
              <p className="text-sm text-slate-400">
                {session.user?.email ?? "Cuenta Discord"}
              </p>
            </div>
          </div>

          <LogoutButton />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <PortalCard
            href="/piloto"
            title="Portal Piloto"
            text="Planes de vuelo, ATIS, estado de operaciones y herramientas para pilotos."
          />

          <PortalCard
            href="/atc"
            title="Portal ATC"
            text="Sector List, posiciones abiertas, ATCs Online, transponder y emergencias."
          />

          <PortalCard
            href="/admin"
            title="Panel Admin"
            text="Roles, aeropuertos, posiciones ATC, auditoría y configuración."
          />
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">Estado de la plataforma</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <StatusCard label="Sistema" value="Online" />
            <StatusCard label="Discord OAuth" value="Activo" />
            <StatusCard label="Base de datos" value="Pendiente" />
            <StatusCard label="Realtime" value="Pendiente" />
          </div>
        </div>
      </section>
    </main>
  );
}

function PortalCard({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-white/10 bg-slate-900 p-6 transition hover:border-sky-400 hover:bg-slate-800"
    >
      <h2 className="text-xl font-bold text-sky-400">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
    </a>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050816] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}