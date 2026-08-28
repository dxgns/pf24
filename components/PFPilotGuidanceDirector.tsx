"use client";

import { useEffect, useMemo, useState } from "react";
import PFPilotAutopilotProcedures from "@/components/PFPilotAutopilotProcedures";
import PFPilotGuidanceDirectorV2 from "@/components/PFPilotGuidanceDirectorV2";
import {
  setPFPilotDirectTargetInNotes,
  type PFPilotDirectTarget,
} from "@/lib/pfpilot/directTo";
import {
  getPFPilotProcedureSelection,
  setPFPilotProcedureSelectionInNotes,
} from "@/lib/pfpilot/procedureSelection";

type PilotPlan = {
  id: string;
  created_by?: string | null;
  notes?: string | null;
  route?: string;
  [key: string]: unknown;
};

function routeToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function routeFromWaypoint(route: unknown, waypoint: string) {
  const tokens = String(route ?? "").trim().split(/\s+/).filter(Boolean);
  const index = tokens.findIndex((token) => routeToken(token) === waypoint);
  if (index < 0) return String(route ?? "");
  return tokens.slice(index).join(" ");
}

export default function PFPilotGuidanceDirector({ plan }: { plan: PilotPlan | null }) {
  const [directTarget, setDirectTarget] = useState<PFPilotDirectTarget | null>(null);
  const [skipSid, setSkipSid] = useState(false);

  useEffect(() => {
    setDirectTarget(null);
    setSkipSid(false);
  }, [plan?.id]);

  const guidancePlan = useMemo(() => {
    if (!plan) return null;
    if (!skipSid && !directTarget) return plan;

    const selection = getPFPilotProcedureSelection(plan.notes);
    let notes = skipSid
      ? setPFPilotProcedureSelectionInNotes(plan.notes, { ...selection, sid: "" })
      : String(plan.notes ?? "");
    notes = setPFPilotDirectTargetInNotes(notes, directTarget);

    const route = directTarget?.kind === "ENROUTE"
      ? routeFromWaypoint(plan.route, directTarget.waypoint)
      : plan.route;

    return { ...plan, notes, route };
  }, [plan, directTarget?.kind, directTarget?.waypoint, skipSid]);

  if (!plan) return <PFPilotGuidanceDirectorV2 plan={null} />;

  const directKey = directTarget ? `${directTarget.kind}:${directTarget.waypoint}` : "none";

  return (
    <>
      <style>{`
        .pf24-autopilot-composite > .pf24-guidance-host {
          display: contents !important;
        }
        .pf24-autopilot-composite > .pf24-guidance-host > div {
          display: contents !important;
        }
        .pf24-autopilot-composite > .pf24-guidance-host > div > :nth-child(2) {
          display: none !important;
        }
      `}</style>
      <div className="pf24-autopilot-composite mt-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="pf24-guidance-host">
          <PFPilotGuidanceDirectorV2
            key={`guidance:${plan.id}:${skipSid ? "sid-skipped" : "normal"}:${directKey}`}
            plan={guidancePlan}
          />
        </div>
        <PFPilotAutopilotProcedures
          plan={plan}
          pilotId={plan.created_by}
          directTarget={directTarget}
          onDirectTo={(target) => {
            setSkipSid(target.kind !== "SID");
            setDirectTarget(target);
          }}
          onCancelDirect={() => setDirectTarget(null)}
        />
      </div>
    </>
  );
}
