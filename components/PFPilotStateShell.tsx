"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import PFPilotMinimumsAudio from "@/components/PFPilotMinimumsAudio";
import PFPilotPrototype from "@/components/PFPilotPrototype";
import { getPFPilotProcedureSelection } from "@/lib/pfpilot/procedureSelection";
import { supabase } from "@/lib/supabase";

type ActivePlan = {
  id: string;
  callsign: string;
  status: string;
  created_by?: string | null;
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
  const refreshSerialRef = useRef(0);

  const refreshActivePlan = useCallback(async () => {
    const serial = ++refreshSerialRef.current;
    const { data, error } = await supabase
      .from("flight_plans")
      .select("*")
      .eq("created_by", pilotId)
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false })
      .limit(1);

    if (serial !== refreshSerialRef.current) return;
    if (error) {
      console.error("PFPilot active-plan shell refresh failed:", error);
      return;
    }

    setActivePlan(((data ?? [])[0] ?? null) as ActivePlan | null);
  }, [pilotId]);

  useEffect(() => {
    void refreshActivePlan();

    const channel = supabase
      .channel(`pfpilot-active-plan-shell-${pilotId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        (payload) => {
          const next = payload.new as ActivePlan | undefined;
          const previous = payload.old as ActivePlan | undefined;
          const belongsToPilot = next?.created_by === pilotId || previous?.created_by === pilotId;

          if (belongsToPilot && next?.created_by === pilotId) {
            refreshSerialRef.current += 1;
            setActivePlan(next.status === "FINISHED" ? null : next);
          }

          // Re-read after every relevant mutation so inserts, deletes and partial
          // realtime payloads converge on the database truth immediately.
          if (belongsToPilot || payload.eventType === "DELETE") void refreshActivePlan();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refreshActivePlan();
      });

    // Realtime is the fast path. A short fallback poll prevents a dropped
    // websocket event from leaving PFPilot frozen on an old flight state.
    const fallback = window.setInterval(() => void refreshActivePlan(), 1500);
    const refreshWhenVisible = () => {
      if (!document.hidden) void refreshActivePlan();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(fallback);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
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
      <PFPilotPrototype
        pilotId={pilotId}
        pilotName={pilotName}
        initialPlans={currentPlans}
        initialSessions={initialSessions}
        initialAtis={initialAtis}
      />
    </div>
  );
}
