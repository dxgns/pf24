import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import PF24Scope from "@/components/scope/PF24Scope";
import ScopeNativeListCss from "@/components/scope/ScopeNativeListCss";
import ScopeLayoutGuards from "@/components/scope/ScopeLayoutGuards";
import WeatherPanelV2 from "@/components/scope/WeatherPanelV2";
import ProjectFlightTrafficV3 from "@/components/scope/ProjectFlightTrafficV3";
import ScopeTrafficSettings from "@/components/scope/ScopeTrafficSettings";
import ScopePersonalization from "@/components/scope/ScopePersonalization";
import RadarViewport from "@/components/scope/RadarViewport";
import ScopeFunctionalExtras from "@/components/scope/ScopeFunctionalExtras";
import ScopeRatingAccess from "@/components/scope/ScopeRatingAccess";
import ScopeUiRefinements from "@/components/scope/ScopeUiRefinements";
import ScopeChromeAdditions from "@/components/scope/ScopeChromeAdditions";
import ScopeAtisDialogV2 from "@/components/scope/ScopeAtisDialogV2";
import ScopeAtcPresence from "@/components/scope/ScopeAtcPresence";
import ScopeOperationalSyncV2 from "@/components/scope/ScopeOperationalSyncV2";
import ScopeNativeListBodyGuard from "@/components/scope/ScopeNativeListBodyGuard";
import ScopeConnectionPersistence from "@/components/scope/ScopeConnectionPersistence";
import ScopeAtisDisconnectCleanup from "@/components/scope/ScopeAtisDisconnectCleanup";
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
  const plans = (data ?? []) as ScopeFlightPlan[];

  return (
    <>
      <ScopeNativeListCss />
      <PF24Scope initialPlans={plans} controllerName={controllerName} />
      <ScopeConnectionPersistence />
      <ScopeLayoutGuards />
      <WeatherPanelV2 />
      <ProjectFlightTrafficV3 initialPlans={plans} />
      <ScopeTrafficSettings />
      <ScopePersonalization />
      <RadarViewport />
      <ScopeFunctionalExtras />
      <ScopeRatingAccess roles={session.user?.discordRoles ?? []} />
      <ScopeUiRefinements />
      <ScopeChromeAdditions />
      <ScopeAtisDialogV2 controllerName={controllerName} />
      <ScopeAtisDisconnectCleanup controllerName={controllerName} />
      <ScopeAtcPresence controllerName={controllerName} />
      <ScopeOperationalSyncV2 />
      <ScopeNativeListBodyGuard />
    </>
  );
}
