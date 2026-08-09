import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import PF24Scope from "@/components/scope/PF24Scope";
import ScopeLayoutGuards from "@/components/scope/ScopeLayoutGuards";
import WeatherPanel from "@/components/scope/WeatherPanel";
import TrafficSimulation from "@/components/scope/TrafficSimulation";
import ScopePersonalization from "@/components/scope/ScopePersonalization";
import RadarViewport from "@/components/scope/RadarViewport";
import ScopeFunctionalExtras from "@/components/scope/ScopeFunctionalExtras";
import ScopeRatingAccess from "@/components/scope/ScopeRatingAccess";
import ScopeUiRefinements from "@/components/scope/ScopeUiRefinements";
import ScopeChromeAdditions from "@/components/scope/ScopeChromeAdditions";
import ScopeAtisDialog from "@/components/scope/ScopeAtisDialog";
import ScopeAtcPresence from "@/components/scope/ScopeAtcPresence";
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

  const controllerName = session.user?.name ?? "ATC";

  return (
    <>
      <PF24Scope
        initialPlans={(data ?? []) as ScopeFlightPlan[]}
        controllerName={controllerName}
      />
      <ScopeLayoutGuards />
      <WeatherPanel />
      <TrafficSimulation />
      <ScopePersonalization />
      <RadarViewport />
      <ScopeFunctionalExtras />
      <ScopeRatingAccess roles={session.user?.discordRoles ?? []} />
      <ScopeUiRefinements />
      <ScopeChromeAdditions />
      <ScopeAtisDialog controllerName={controllerName} />
      <ScopeAtcPresence controllerName={controllerName} />
    </>
  );
}
