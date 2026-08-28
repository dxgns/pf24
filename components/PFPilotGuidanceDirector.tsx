"use client";

import { useEffect, useMemo, useState } from "react";
import PFPilotAutopilotProcedures from "@/components/PFPilotAutopilotProcedures";
import PFPilotGuidanceDirectorV2 from "@/components/PFPilotGuidanceDirectorV2";
import {
  getGameCallsignFromNotes,
  normalizeGameCallsign,
  setGameCallsignInNotes,
} from "@/lib/flightPlanGameCallsign";
import {
  connectProjectFlightTraffic,
  normalizeProjectFlightCallsign,
  type ProjectFlightTelemetry,
} from "@/lib/pfpilot/projectFlightLive";
import {
  setPFPilotDirectTargetInNotes,
  type PFPilotDirectTarget,
} from "@/lib/pfpilot/directTo";
import {
  getPFPilotProcedureSelection,
  setPFPilotProcedureSelectionInNotes,
} from "@/lib/pfpilot/procedureSelection";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";

type PilotPlan = {
  id: string;
  callsign?: string | null;
  created_by?: string | null;
  notes?: string | null;
  route?: string;
  [key: string]: unknown;
};

type CachedTraffic = {
  item: ProjectFlightTelemetry;
  seenAt: number;
};

const TRAFFIC_RESOLUTION_CACHE_MS = 15000;

function routeToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function routeFromWaypoint(route: unknown, waypoint: string) {
  const tokens = String(route ?? "").trim().split(/\s+/).filter(Boolean);
  const index = tokens.findIndex((token) => routeToken(token) === waypoint);
  if (index < 0) return String(route ?? "");
  return tokens.slice(index).join(" ");
}

function callsignVariants(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Set<string>();

  const variants = new Set<string>();
  const compact = normalizeGameCallsign(raw).replace(/-/g, "");
  const projectFlight = normalizeProjectFlightCallsign(raw);
  const airlineRaw = normalizeAirlineCallsign(raw);
  const airlineProjectFlight = normalizeAirlineCallsign(projectFlight);

  for (const variant of [compact, projectFlight, airlineRaw, airlineProjectFlight]) {
    const normalized = normalizeGameCallsign(variant).replace(/-/g, "");
    if (normalized) variants.add(normalized);
  }
  return variants;
}

function flightSuffix(value: string | null | undefined) {
  const compact = normalizeGameCallsign(String(value ?? "")).replace(/-/g, "");
  return compact.match(/(\d{1,4}[A-Z]?)$/)?.[1] ?? "";
}

function canonicalTrafficCallsign(item: ProjectFlightTelemetry) {
  return normalizeAirlineCallsign(
    normalizeProjectFlightCallsign(item.rawCallsign || item.callsign),
  );
}

function trafficMatchesExpected(item: ProjectFlightTelemetry, expected: Set<string>) {
  if (expected.size === 0) return false;
  const variants = new Set<string>([
    ...callsignVariants(item.rawCallsign),
    ...callsignVariants(item.callsign),
  ]);
  return Array.from(variants).some((variant) => expected.has(variant));
}

export default function PFPilotGuidanceDirector({ plan }: { plan: PilotPlan | null }) {
  const [directTarget, setDirectTarget] = useState<PFPilotDirectTarget | null>(null);
  const [skipSid, setSkipSid] = useState(false);
  const [resolvedTrafficCallsign, setResolvedTrafficCallsign] = useState("");

  const expectedTrafficCallsign = useMemo(
    () => getGameCallsignFromNotes(plan?.notes) || String(plan?.callsign ?? ""),
    [plan?.notes, plan?.callsign],
  );

  useEffect(() => {
    setDirectTarget(null);
    setSkipSid(false);
    setResolvedTrafficCallsign("");
  }, [plan?.id]);

  useEffect(() => {
    if (!plan?.id || !expectedTrafficCallsign || resolvedTrafficCallsign) return;

    const expectedVariants = callsignVariants(expectedTrafficCallsign);
    const expectedSuffix = flightSuffix(expectedTrafficCallsign);
    const cache = new Map<string, CachedTraffic>();

    const resolve = () => {
      const now = Date.now();
      for (const [key, value] of cache) {
        if (now - value.seenAt > TRAFFIC_RESOLUTION_CACHE_MS) cache.delete(key);
      }

      const rows = Array.from(cache.values()).map((value) => value.item);
      const exact = rows.filter((item) => trafficMatchesExpected(item, expectedVariants));
      if (exact.length === 1) {
        const canonical = canonicalTrafficCallsign(exact[0]);
        if (canonical) setResolvedTrafficCallsign(canonical);
        return;
      }

      // Project Flight may expose the airline telephony while the FPL stores a
      // different prefix. If the flight-number suffix identifies exactly one live
      // aircraft, use that unique aircraft and then switch the inner director to
      // its canonical callsign. Ambiguous suffixes are deliberately ignored.
      if (!expectedSuffix) return;
      const suffixMatches = rows.filter((item) =>
        [item.rawCallsign, item.callsign].some((value) => flightSuffix(value) === expectedSuffix),
      );
      if (suffixMatches.length !== 1) return;

      const canonical = canonicalTrafficCallsign(suffixMatches[0]);
      if (canonical) setResolvedTrafficCallsign(canonical);
    };

    return connectProjectFlightTraffic({
      onState: () => undefined,
      onTraffic: (traffic) => {
        const now = Date.now();
        for (const item of traffic) {
          const key = item.id || item.username || item.callsign || item.rawCallsign;
          if (!key) continue;
          cache.set(key, { item, seenAt: now });
        }
        resolve();
      },
    });
  }, [plan?.id, expectedTrafficCallsign, resolvedTrafficCallsign]);

  const guidancePlan = useMemo(() => {
    if (!plan) return null;
    if (!skipSid && !directTarget && !resolvedTrafficCallsign) return plan;

    const selection = getPFPilotProcedureSelection(plan.notes);
    let notes = skipSid
      ? setPFPilotProcedureSelectionInNotes(plan.notes, { ...selection, sid: "" })
      : String(plan.notes ?? "");
    notes = setPFPilotDirectTargetInNotes(notes, directTarget);
    if (resolvedTrafficCallsign) notes = setGameCallsignInNotes(notes, resolvedTrafficCallsign);

    const route = directTarget?.kind === "ENROUTE"
      ? routeFromWaypoint(plan.route, directTarget.waypoint)
      : plan.route;

    return { ...plan, notes, route };
  }, [plan, directTarget?.kind, directTarget?.waypoint, skipSid, resolvedTrafficCallsign]);

  if (!plan) return <PFPilotGuidanceDirectorV2 plan={null} />;

  const directKey = directTarget ? `${directTarget.kind}:${directTarget.waypoint}` : "none";
  const trafficKey = resolvedTrafficCallsign || "unresolved";

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
        .pf24-autopilot-composite > .pf24-guidance-host > div > :first-child > :nth-child(3) > :first-child > :nth-child(1) {
          order: 2;
        }
        .pf24-autopilot-composite > .pf24-guidance-host > div > :first-child > :nth-child(3) > :first-child > :nth-child(2) {
          order: 1;
        }
        .pf24-autopilot-composite > .pf24-guidance-host > div > :first-child > :nth-child(3) > :first-child > :nth-child(3) {
          order: 3;
        }
      `}</style>
      <div className="pf24-autopilot-composite mt-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="pf24-guidance-host">
          <PFPilotGuidanceDirectorV2
            key={`guidance:${plan.id}:${skipSid ? "sid-skipped" : "normal"}:${directKey}:${trafficKey}`}
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