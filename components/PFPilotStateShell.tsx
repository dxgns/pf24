"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import PFPilotMinimumsAudio from "@/components/PFPilotMinimumsAudio";
import PFPilotProcedureLoader from "@/components/PFPilotProcedureLoader";
import PFPilotPrototype from "@/components/PFPilotPrototype";
import { getPFPilotProcedureSelection } from "@/lib/pfpilot/procedureSelection";
import { supabase } from "@/lib/supabase";

type ActivePlan = {
  id: string;
  callsign: string;
  status: string;
  notes?: string | null;
  [key: string]: unknown;
};

export default function PFPilotStateShell({
  pilotId,
  pilotName,
  initialPlans,
  initialSessions,
  initialAtis,
}: {
  pilotId: string;
  pilotName: string;
  initialPlans: any[];
  initialSessions: any[];
  initialAtis: any[];
}) {
  const initialActivePlan = (initialPlans.find((plan) => plan.status !== "FINISHED") ?? null) as ActivePlan | null;
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(initialActivePlan);

  const refreshActivePlan = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .eq("created_by", pilotId)
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("PFPilot active-plan shell refresh failed:", error);
      return;
    }

    setActivePlan(((data ?? [])[0] ?? null) as ActivePlan | null);
  }, [pilotId]);

  useEffect(() => {
    const channel = supabase
      .channel(`pfpilot-active-plan-shell-${pilotId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        () => void refreshActivePlan(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pilotId, refreshActivePlan]);

  const currentPlans = useMemo(() => activePlan ? [activePlan] : [], [activePlan]);
  const selection = useMemo(
    () => getPFPilotProcedureSelection(activePlan?.notes),
    [activePlan?.notes],
  );
  const procedureLoadKey = `${activePlan?.id ?? "none"}:${selection.sid}:${selection.star}:${selection.approach}`;
  const callsign = activePlan?.callsign?.trim().toUpperCase() ?? "";
  const shellStyle = activePlan
    ? ({ "--pf24-pfpilot-active-callsign": `"${callsign}"` } as CSSProperties)
    : undefined;

  return (
    <div
      data-pf24-pfpilot-state={activePlan ? "active" : "inactive"}
      style={shellStyle}
    >
      <style>{`
        [data-pf24-pfpilot-state="inactive"] aside > .panel:first-child {
          display: none !important;
        }
        [data-pf24-pfpilot-state="active"] aside > .panel:first-child h2 {
          font-size: 0 !important;
          line-height: 1.75rem;
        }
        [data-pf24-pfpilot-state="active"] aside > .panel:first-child h2::after {
          content: var(--pf24-pfpilot-active-callsign);
          font-size: 1.25rem;
          line-height: 1.75rem;
          font-weight: 800;
        }
        [data-pf24-pfpilot-state="active"] .\\-mt-8 > .panel.mt-8,
        [data-pf24-pfpilot-state="active"] .\\-mt-8 > .panel.mt-10 {
          display: none !important;
        }
        [data-pf24-pfpilot-state="inactive"] .\\-mt-8 > .mt-10 {
          display: none !important;
        }
      `}</style>
      <PFPilotMinimumsAudio key={`minimums:${procedureLoadKey}`} plan={activePlan} />
      {activePlan && <PFPilotProcedureLoader plan={activePlan} pilotId={pilotId} />}
      <PFPilotPrototype
        key={`prototype:${procedureLoadKey}`}
        pilotId={pilotId}
        pilotName={pilotName}
        initialPlans={currentPlans}
        initialSessions={initialSessions}
        initialAtis={initialAtis}
      />
    </div>
  );
}
