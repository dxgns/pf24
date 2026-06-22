import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ATCSectorList from "@/components/ATCSectorList";

export default async function ATCPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { data: flightPlans, error } = await supabase
    .from("flight_plans")
    .select("*")
    .neq("status", "FINISHED")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-24 text-white">
      <section className="section-container">
        <div className="panel rounded-3xl p-8">
          <p className="mono text-xs uppercase tracking-[0.3em] text-sky-300/70">
            PF24 Español / ATC Operations
          </p>

          <h1 className="mt-4 text-4xl font-extrabold">
            Sector List
          </h1>

          <p className="mt-4 max-w-3xl text-slate-300">
            Selecciona tu posición de control, visualiza planes activos y
            gestiona tráfico con guardado automático en tiempo real.
          </p>
        </div>

        <ATCSectorList
          initialPlans={flightPlans ?? []}
          controllerName={session.user?.name ?? "ATC"}
        />
      </section>
    </main>
  );
}