"use client";

import { useCallback, useEffect } from "react";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";
import { supabase } from "@/lib/supabase";

type FlightPlanRow = {
  id?: string;
  callsign?: string | null;
  notes?: string | null;
  assumed_by?: string | null;
  sector_status?: string | null;
  status?: string | null;
};
type SessionRow = { position?: string | null; is_active?: boolean | null };

const OWNERSHIP_EVENT = "pf24-traffic-ownership-change";
const OWNERSHIP_HINT_EVENT = "pf24-traffic-ownership-hint";

function normalize(value: string | null | undefined) { return value?.trim().toUpperCase() ?? ""; }
function planKeys(plan: FlightPlanRow) {
  const keys = new Set<string>();
  const shown = normalizeGameCallsign(String(plan.callsign ?? ""));
  const game = normalizeGameCallsign(getGameCallsignFromNotes(String(plan.notes ?? "")));
  if (shown) keys.add(shown);
  if (game) keys.add(game);
  return Array.from(keys);
}
function ownershipHint(plan: FlightPlanRow, owner: string | null, previousOwner?: string | null) {
  for (const key of planKeys(plan)) {
    window.dispatchEvent(new CustomEvent(OWNERSHIP_HINT_EVENT, { detail: { key, owner, previousOwner } }));
  }
}

export default function ScopeTrafficAutoRelease() {
  const releasePosition = useCallback(async (rawPosition: string) => {
    const position = normalize(rawPosition);
    if (!position) return;

    const { data: active, error: activeError } = await supabase
      .from("atc_sessions")
      .select("id")
      .eq("position", position)
      .eq("is_active", true)
      .limit(1);
    if (activeError) {
      console.error("PF24 Scope active-sector verification failed:", activeError);
      return;
    }
    if ((active ?? []).length > 0) return;

    const { data: owned, error: ownedError } = await supabase
      .from("flight_plans")
      .select("id,callsign,notes")
      .eq("assumed_by", position)
      .neq("status", "FINISHED");
    if (ownedError) {
      console.error("PF24 Scope disconnected-sector ownership lookup failed:", ownedError);
      return;
    }

    const { error } = await supabase
      .from("flight_plans")
      .update({ assumed_by: null, updated_at: new Date().toISOString() })
      .eq("assumed_by", position)
      .neq("status", "FINISHED");
    if (error) {
      console.error("PF24 Scope disconnected-sector traffic release failed:", error);
      return;
    }

    for (const plan of (owned ?? []) as FlightPlanRow[]) ownershipHint(plan, null, position);
    window.dispatchEvent(new Event(OWNERSHIP_EVENT));
  }, []);

  useEffect(() => {
    const sessionChannel = supabase
      .channel("scope-auto-release-disconnected-v2")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "atc_sessions" }, ({ new: next, old }) => {
        const nextRow = next as SessionRow;
        const oldRow = old as SessionRow;
        if (nextRow.is_active === false) void releasePosition(normalize(nextRow.position) || normalize(oldRow.position));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "atc_sessions" }, ({ old }) => {
        void releasePosition(normalize((old as SessionRow).position));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(sessionChannel);
    };
  }, [releasePosition]);

  return null;
}
