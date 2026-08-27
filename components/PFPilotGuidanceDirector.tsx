"use client";

import { useEffect, useMemo, useState } from "react";
import PFPilotAutopilotProcedures from "@/components/PFPilotAutopilotProcedures";
import PFPilotGuidanceDirectorV2 from "@/components/PFPilotGuidanceDirectorV2";
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
  const [directTarget, setDirectTarget] = useState("");
  const [skipSid, setSkipSid] = useState(false);

  useEffect(() => {
    setDirectTarget("");
    setSkipSid(false);
  }, [plan?.id]);

  const guidancePlan = useMemo(() => {
    if (!plan) return null;
    if (!skipSid && !directTarget) return plan;

    const selection = getPFPilotProcedureSelection(plan.notes);
    const notes = skipSid
      ? setPFPilotProcedureSelectionInNotes(plan.notes, { ...selection, sid: "" })
      : plan.notes;
    const route = directTarget ? routeFromWaypoint(plan.route, directTarget) : plan.route;

    return { ...plan, notes, route };
  }, [plan, directTarget, skipSid]);

  if (!plan) return <PFPilotGuidanceDirectorV2 plan={null} />;

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
            key={`guidance:${plan.id}:${skipSid ? "enroute" : "normal"}:${directTarget || "none"}`}
            plan={guidancePlan}
          />
        </div>
        <PFPilotAutopilotProcedures
          plan={plan}
          pilotId={plan.created_by}
          directTarget={directTarget}
          onDirectTo={(waypoint) => {
            setSkipSid(true);
            setDirectTarget(waypoint);
          }}
          onCancelDirect={() => setDirectTarget("")}
        />
      </div>
    </>
  );
}
