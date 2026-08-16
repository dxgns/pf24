import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import PF24Scope from "@/components/scope/PF24Scope";
import ScopeNativeListCss from "@/components/scope/ScopeNativeListCss";
import ScopeLayoutGuards from "@/components/scope/ScopeLayoutGuards";
import WeatherPanelV2 from "@/components/scope/WeatherPanelV2";
import ProjectFlightTrafficConfigured from "@/components/scope/ProjectFlightTrafficConfigured";
import ScopeTrafficSettings from "@/components/scope/ScopeTrafficSettings";
import ScopeTrafficLabelUX from "@/components/scope/ScopeTrafficLabelUX";
import ScopeTrafficMappState from "@/components/scope/ScopeTrafficMappState";
import ScopeTrafficHandover from "@/components/scope/ScopeTrafficHandover";
import ScopeTrafficOperations from "@/components/scope/ScopeTrafficOperations";
import ScopeUnplannedTrafficOperationsV4 from "@/components/scope/ScopeUnplannedTrafficOperationsV4";
import ScopeUnplannedHold from "@/components/scope/ScopeUnplannedHold";
import ScopeOwnedTrafficLifecycle from "@/components/scope/ScopeOwnedTrafficLifecycle";
import ScopeTrafficAutoRelease from "@/components/scope/ScopeTrafficAutoRelease";
import ScopeTrafficOwnershipVisuals from "@/components/scope/ScopeTrafficOwnershipVisuals";
import ScopeSharedHoldSync from "@/components/scope/ScopeSharedHoldSync";
import ScopeHoldTelemetry from "@/components/scope/ScopeHoldTelemetry";
import ScopeSectorListRules from "@/components/scope/ScopeSectorListRules";
import ScopeTrafficFooterPlacement from "@/components/scope/ScopeTrafficFooterPlacement";
import ScopePersonalization from "@/components/scope/ScopePersonalization";
import RadarViewport from "@/components/scope/RadarViewport";
import ScopeRadarMap from "@/components/scope/ScopeRadarMap";
import ScopeRadarMapVisibility from "@/components/scope/ScopeRadarMapVisibility";
import ScopeFunctionalExtras from "@/components/scope/ScopeFunctionalExtras";
import ScopeRatingAccess from "@/components/scope/ScopeRatingAccess";
import ScopeUiRefinements from "@/components/scope/ScopeUiRefinements";
import ScopeUiConsistencyFixes from "@/components/scope/ScopeUiConsistencyFixes";
import ScopeChromeAdditions from "@/components/scope/ScopeChromeAdditions";
import ScopeAtisDialogV2 from "@/components/scope/ScopeAtisDialogV2";
import ScopeAtisJurisdictionGuard from "@/components/scope/ScopeAtisJurisdictionGuard";
import ScopeConnectDialogPersistence from "@/components/scope/ScopeConnectDialogPersistence";
import ScopeAtcPresence from "@/components/scope/ScopeAtcPresence";
import ScopeOperationalSyncV2 from "@/components/scope/ScopeOperationalSyncV2";
import ScopeSectorChat from "@/components/scope/ScopeSectorChat";
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

  if (!session) redirect("/login");
  if (!session.user?.permissions?.canAccessATC) redirect("/access-denied");

  const { data, error } = await supabase
    .from("flight_plans")
    .select("*")
    .neq("status", "FINISHED")
    .order("created_at", { ascending: false });

  if (error) console.error("PF24 Scope flight plan load error:", error);

  const controllerName = session.user?.name ?? "ATC";
  const plans = (data ?? []) as ScopeFlightPlan[];
  const projectFlightServerId = (process.env.PROJECT_FLIGHT_SERVER_ID ?? "2ykygVZiX5").trim();

  return (
    <>
      <ScopeNativeListCss />
      <PF24Scope initialPlans={plans} controllerName={controllerName} />
      <ScopeConnectionPersistence />
      <ScopeConnectDialogPersistence />
      <ScopeOwnedTrafficLifecycle />
      <ScopeTrafficAutoRelease />
      <ScopeLayoutGuards />
      <WeatherPanelV2 />
      <ScopeRadarMap />
      <ScopeRadarMapVisibility />
      <ProjectFlightTrafficConfigured initialPlans={plans} serverId={projectFlightServerId} />
      <ScopeTrafficSettings />
      <ScopeTrafficLabelUX />
      <ScopeTrafficMappState />
      <ScopeTrafficHandover initialPlans={plans} />
      <ScopeUnplannedHold initialPlans={plans} />
      <ScopeUnplannedTrafficOperationsV4 initialPlans={plans} />
      <ScopeSharedHoldSync />
      <ScopeTrafficOperations initialPlans={plans} />
      <ScopeHoldTelemetry />
      <ScopeTrafficOwnershipVisuals initialPlans={plans} />
      <ScopeTrafficFooterPlacement />
      <ScopePersonalization />
      <RadarViewport />
      <ScopeFunctionalExtras />
      <ScopeRatingAccess roles={session.user?.discordRoles ?? []} />
      <ScopeUiRefinements />
      <ScopeUiConsistencyFixes />
      <ScopeChromeAdditions />
      <ScopeAtisDialogV2 controllerName={controllerName} />
      <ScopeAtisJurisdictionGuard controllerName={controllerName} />
      <ScopeAtisDisconnectCleanup controllerName={controllerName} />
      <ScopeAtcPresence controllerName={controllerName} />
      <ScopeOperationalSyncV2 />
      <ScopeSectorChat />
      <ScopeSectorListRules initialPlans={plans} />
      <ScopeNativeListBodyGuard />
    </>
  );
}
