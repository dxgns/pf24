"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "pf24_scope_atc_session_id";

type NavigationLike = EventTarget & {
  addEventListener(type: "navigate", listener: (event: Event & { navigationType?: string }) => void): void;
  removeEventListener(type: "navigate", listener: (event: Event & { navigationType?: string }) => void): void;
};

type ATCSessionRow = {
  id?: string;
  controller_name?: string;
  position?: string;
  is_active?: boolean;
};

function getScopeConnection() {
  const topRow = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  if (!topRow) return { connected: false, position: "" };
  const buttons = Array.from(topRow.querySelectorAll<HTMLButtonElement>(":scope > button"));
  const connectButton = buttons.find((button) => {
    const label = button.textContent?.trim().toUpperCase();
    return label === "CONNECT" || label === "DISCONNECT";
  });
  const cells = Array.from(topRow.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
  const rawPosition = cells[2]?.textContent?.trim() ?? "";
  return {
    connected: connectButton?.textContent?.trim().toUpperCase() === "DISCONNECT",
    position: rawPosition.split(/\s+/)[0]?.trim() ?? "",
  };
}

function readSessionId() {
  const current = sessionStorage.getItem(STORAGE_KEY);
  if (current) return current;

  // One-time migration from the old cross-tab localStorage key. Keeping the
  // live session id in sessionStorage prevents one Scope tab from closing or
  // reusing another tab's ATC session while still surviving a normal reload.
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!legacy) return null;
  sessionStorage.setItem(STORAGE_KEY, legacy);
  localStorage.removeItem(STORAGE_KEY);
  return legacy;
}
function writeSessionId(id: string) {
  sessionStorage.setItem(STORAGE_KEY, id);
  localStorage.removeItem(STORAGE_KEY);
}
function clearSessionId() {
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

function topConnectionButton() {
  const topRow = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(topRow?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []).find((button) => {
    const label = button.textContent?.trim().toUpperCase();
    return label === "CONNECT" || label === "DISCONNECT";
  }) ?? null;
}

function forceScopeDisconnect() {
  const topButton = topConnectionButton();
  if (topButton?.textContent?.trim().toUpperCase() !== "DISCONNECT") return;

  // Use the Scope's own disconnect UI so every dependent component receives
  // exactly the same state/events as a manual disconnect.
  topButton.click();
  window.setTimeout(() => {
    const dialog = document.querySelector<HTMLElement>(".connectBox");
    const disconnect = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((button) => button.textContent?.trim().toUpperCase() === "DISCONNECT");
    disconnect?.click();
  }, 0);
}

export default function ScopeAtcPresence({ controllerName }: { controllerName: string }) {
  const syncingRef = useRef(false);
  const lastStateRef = useRef({ connected: false, position: "" });
  const reloadingRef = useRef(false);
  const forcedDisconnectRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const removeOwnedAtis = async () => {
      const { error } = await supabase.from("atis_messages").delete().eq("created_by", controllerName);
      if (error) console.error("PF24 Scope ATIS disconnect cleanup failed:", error);
    };

    const closeSession = async () => {
      const skipAtisCleanup = forcedDisconnectRef.current;
      const sessionId = readSessionId();
      if (sessionId) {
        const { error } = await supabase
          .from("atc_sessions")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("id", sessionId);
        if (error) console.error("PF24 Scope ATC presence close failed:", error);
        clearSessionId();
      }
      if (!skipAtisCleanup) await removeOwnedAtis();
      forcedDisconnectRef.current = false;
    };

    const retireOtherSessions = async () => {
      const { error } = await supabase
        .from("atc_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("controller_name", controllerName)
        .eq("is_active", true);
      if (error) console.error("PF24 Scope duplicate ATC session cleanup failed:", error);
    };

    const openSession = async (position: string) => {
      if (!position) return;
      const existingId = readSessionId();
      if (existingId) {
        const { data, error } = await supabase
          .from("atc_sessions")
          .select("id,position,is_active")
          .eq("id", existingId)
          .maybeSingle();
        if (error) console.error("PF24 Scope ATC presence lookup failed:", error);
        if (data?.is_active && data.position === position) return;
        if (data && data.position === position) {
          // Before reopening this tab, retire any other active position owned by
          // the same controller. The current row is inactive, so it is preserved.
          await retireOtherSessions();
          const { error: reopenError } = await supabase
            .from("atc_sessions")
            .update({ is_active: true, ended_at: null })
            .eq("id", existingId);
          if (!reopenError) return;
        }
        await closeSession();
      }

      // A controller may only own one active ATC session. Retire any session
      // left active in another tab/device before publishing this new position.
      await removeOwnedAtis();
      await retireOtherSessions();

      const { data, error } = await supabase.from("atc_sessions").insert({
        controller_name: controllerName,
        position,
        started_at: new Date().toISOString(),
        is_active: true,
      }).select("id").single();

      if (!error && data?.id && !cancelled) writeSessionId(data.id);
      else if (error) console.error("PF24 Scope ATC presence insert failed:", error);
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
          if (previous.connected && previous.position && previous.position !== current.position) await closeSession();
          await openSession(current.position);
        } else if (!current.connected && previous.connected) {
          await closeSession();
        }
      } finally {
        syncingRef.current = false;
      }
    };

    const onConnectionChange = () => void sync();
    window.addEventListener("pf24-scope-connection-change", onConnectionChange);

    // If another tab/device for this same controller takes over, its openSession
    // marks this row inactive. React to that DB change by disconnecting this UI.
    const sessionChannel = supabase
      .channel(`scope-single-atc-session-${controllerName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "atc_sessions" }, (payload) => {
        const row = payload.new as ATCSessionRow;
        const ownSessionId = readSessionId();
        if (!ownSessionId || row.id !== ownSessionId || row.is_active !== false) return;
        if (reloadingRef.current || forcedDisconnectRef.current) return;

        forcedDisconnectRef.current = true;
        clearSessionId();
        forceScopeDisconnect();
      })
      .subscribe();

    lastStateRef.current = getScopeConnection();
    if (lastStateRef.current.connected && lastStateRef.current.position) void openSession(lastStateRef.current.position);

    const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
    const onNavigate = (event: Event & { navigationType?: string }) => {
      if (event.navigationType === "reload") reloadingRef.current = true;
    };
    navigation?.addEventListener("navigate", onNavigate);

    const handlePageHide = () => {
      if (reloadingRef.current) return;
      const sessionId = readSessionId();
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
        clearSessionId();
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
      window.removeEventListener("pf24-scope-connection-change", onConnectionChange);
      navigation?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("pagehide", handlePageHide);
      void supabase.removeChannel(sessionChannel);
    };
  }, [controllerName]);

  return null;
}
