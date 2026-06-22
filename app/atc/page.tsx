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
        <ATCSectorList
          initialPlans={flightPlans ?? []}
          controllerName={session.user?.name ?? "ATC"}
        />
      </section>
    </main>
  );
}