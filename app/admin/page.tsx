import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#050816] px-6 py-24 text-white">
      <section className="section-container">
        <h1 className="text-4xl font-extrabold">Panel Admin</h1>
        <p className="mt-4 text-slate-300">
          Administración de roles, aeropuertos, posiciones ATC y configuración.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <ModuleCard title="Roles Discord" text="Mapeo de permisos internos." />
          <ModuleCard title="Aeropuertos" text="Catálogo cerrado de aeropuertos PF24." />
          <ModuleCard title="Posiciones ATC" text="Rangos, posiciones y cobertura." />
          <ModuleCard title="Auditoría" text="Historial de cambios del sistema." />
        </div>
      </section>
    </main>
  );
}

function ModuleCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <h2 className="text-xl font-bold text-sky-400">{title}</h2>
      <p className="mt-3 text-slate-300">{text}</p>
    </div>
  );
}