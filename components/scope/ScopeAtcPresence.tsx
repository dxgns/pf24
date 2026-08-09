"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "pf24_scope_atc_session_id";

function getScopeConnection() {
  const topRow = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  if (!topRow) return { connected: false, position: "" };

  const buttons = Array.from(topRow.querySelectorAll<HTMLButtonElement>(":scope > button"));
  const connectButton = buttons.find((button) => {
    const label = button.textContent?.trim().toUpperCase();
    return label === "CONNECT" || label === "DISCONNECT";
  });

  const cells = Array.from(topRow.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
  const positionCell = cells[2];
  const rawPosition = positionCell?.textContent?.trim() ?? "";
  const position = rawPosition.split(/\s+/)[0]?.trim() ?? "";

  return {
    connected: connectButton?.textContent?.trim().toUpperCase() === "DISCONNECT",
    position,
  };
}

export default function ScopeAtcPresence({ controllerName }: { controllerName: string }) {
  const syncingRef = useRef(false);
  const lastStateRef = useRef({ connected: false, position: "" });

  useEffect(() => {
    let cancelled = false;

    const removeOwnedAtis = async () => {
      const { error } = await supabase
        .from("atis_messages")
        .delete()
        .eq("created_by", controllerName);
      if (error) console.error("PF24 Scope ATIS disconnect cleanup failed:", error);
    };

    const closeSession = async () => {
      const sessionId = localStorage.getItem(STORAGE_KEY);
      if (sessionId) {
        await supabase
          .from("atc_sessions")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("id", sessionId);
        localStorage.removeItem(STORAGE_KEY);
      }
      await removeOwnedAtis();
    };

    const openSession = async (position: string) => {
      if (!position) return;

      const existingId = localStorage.getItem(STORAGE_KEY);
      if (existingId) {
        const { data } = await supabase
          .from("atc_sessions")
          .select("id,position,is_active")
          .eq("id", existingId)
          .maybeSingle();

        if (data?.is_active && data.position === position) return;
        await closeSession();
      }

      const { data, error } = await supabase
        .from("atc_sessions")
        .insert({
          controller_name: controllerName,
          position,
          started_at: new Date().toISOString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (!error && data?.id && !cancelled) {
        localStorage.setItem(STORAGE_KEY, data.id);
      } else if (error) {
        console.error("PF24 Scope ATC presence insert failed:", error);
      }
    };

    const sync = async () => {
      if (syncingRef.current) return;
      const current = getScopeConnection();
      const previous = lastStateRef.current;

      if (current.connected === previous.connected && current.position === previous.position) return;
      lastStateRef.current = current;
      syncingRef.current = true;

      try {
        if (current.connected && current.position) {
          await openSession(current.position);
        } else if (!current.connected && previous.connected) {
          await closeSession();
        }
      } finally {
        syncingRef.current = false;
      }
    };

    const observer = new MutationObserver(() => void sync());
    const scope = document.querySelector<HTMLElement>("main.fixed");
    if (scope) observer.observe(scope, { subtree: true, childList: true, characterData: true, attributes: true });

    lastStateRef.current = getScopeConnection();
    if (lastStateRef.current.connected && lastStateRef.current.position) void openSession(lastStateRef.current.position);

    const handlePageHide = () => {
      const sessionId = localStorage.getItem(STORAGE_KEY);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) return;

      if (sessionId) {
        void fetch(`${supabaseUrl}/rest/v1/atc_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
        });
        localStorage.removeItem(STORAGE_KEY);
      }

      void fetch(`${supabaseUrl}/rest/v1/atis_messages?created_by=eq.${encodeURIComponent(controllerName)}`, {
        method: "DELETE",
        keepalive: true,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [controllerName]);

  return null;
}
