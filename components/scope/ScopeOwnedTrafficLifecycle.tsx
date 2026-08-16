"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type StoredConnection = { callsign?: string };
type NavigationLike = EventTarget & {
  addEventListener(type: "navigate", listener: (event: Event & { navigationType?: string }) => void): void;
  removeEventListener(type: "navigate", listener: (event: Event & { navigationType?: string }) => void): void;
};

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";

function readPosition() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return stored?.callsign?.trim().toUpperCase() ?? "";
  } catch { return ""; }
}

export default function ScopeOwnedTrafficLifecycle() {
  const positionRef = useRef("");
  const reloadingRef = useRef(false);

  useEffect(() => {
    positionRef.current = readPosition();

    const releaseOwned = async (position: string) => {
      if (!position) return;
      const { error } = await supabase
        .from("flight_plans")
        .update({ assumed_by: null, updated_at: new Date().toISOString() })
        .eq("assumed_by", position)
        .neq("status", "FINISHED");
      if (error) console.error("PF24 Scope owned traffic cleanup failed:", error);
      window.dispatchEvent(new CustomEvent("pf24-traffic-ownership-change"));
    };

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const previous = positionRef.current;
      if (detail?.connected) {
        positionRef.current = detail.callsign?.trim().toUpperCase() || readPosition();
        return;
      }
      positionRef.current = "";
      if (previous) void releaseOwned(previous);
    };
    window.addEventListener("pf24-scope-connection-change", onConnection);

    const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
    const onNavigate = (event: Event & { navigationType?: string }) => {
      if (event.navigationType === "reload") reloadingRef.current = true;
    };
    navigation?.addEventListener("navigate", onNavigate);

    const onPageHide = () => {
      if (reloadingRef.current) return;
      const position = positionRef.current || readPosition();
      if (!position) return;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) return;
      void fetch(`${supabaseUrl}/rest/v1/flight_plans?assumed_by=eq.${encodeURIComponent(position)}&status=neq.FINISHED`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ assumed_by: null, updated_at: new Date().toISOString() }),
      });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      navigation?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
