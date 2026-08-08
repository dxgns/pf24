import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import PF24Scope from "@/components/scope/PF24Scope";
import TransitionLevelSync from "@/components/scope/TransitionLevelSync";
import type { ScopeFlightPlan } from "@/lib/scope/types";

export const metadata: Metadata = {
  title: "PF24 Scope | PF24",
  description: "Entorno operativo ATC de PF24.",
};

export default async function ScopePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user?.permissions?.canAccessATC) {
    redirect("/access-denied");
  }

  const { data, error } = await supabase
    .from("flight_plans")
    .select("*")
    .neq("status", "FINISHED")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("PF24 Scope flight plan load error:", error);
  }

  return (
    <>
      <PF24Scope
        initialPlans={(data ?? []) as ScopeFlightPlan[]}
        controllerName={session.user?.name ?? "ATC"}
      />
      <TransitionLevelSync />
    </>
  );
}
