import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SectorListTable from "@/components/SectorListTable";

export default async function ATCPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { data: flightPlans, error } = await supabase
    .from("flight_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  return (
    <main className="min-h-screen bg-[#050816] px-6 py-24 text-white">
      <section className="section-container">
        <h1 className="text-4xl font-extrabold">Sector List</h1>

        <p className="mt-4 text-slate-300">
          Edita transponder, estado administrativo, estado operativo y controlador asignado.
        </p>

        <SectorListTable flightPlans={flightPlans ?? []} />
      </section>
    </main>
  );
}