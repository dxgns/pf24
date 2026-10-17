"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const ATIS_AIRPORTS = new Set([
  "MDPC",
  "MDST",
  "LCLK",
  "LCPH",
  "EGKK",
  "EGHI",
  "LEMH",
  "GCLP",
  "EFKT",
]);

type PublishedAtis = { airport_icao: string; created_by: string | null; created_at: string };

function topConnectButton() {
  const top = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(top?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []).find((button) => {
    const value = button.textContent?.trim().toUpperCase();
    return value === "CONNECT" || value === "DISCONNECT";
  }) ?? null;
}

function scopeConnected() {
  return topConnectButton()?.textContent?.trim().toUpperCase() === "DISCONNECT";
}

function airportSelect(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLSelectElement>("select")).find((select) => {
    const row = select.closest("div");
    return row?.textContent?.toUpperCase().includes("AIRPORT") ?? false;
  }) ?? null;
}

function findAtisDialog() {
  return document.querySelector<HTMLElement>("[data-pf24-atis-dialog='true']");
}

function latestPublishedByAirport(rows: PublishedAtis[]) {
  const latest = new Map<string, PublishedAtis>();
  for (const row of rows) {
    const airport = String(row.airport_icao ?? "").trim().toUpperCase();
    if (!airport || !ATIS_AIRPORTS.has(airport)) continue;
    const current = latest.get(airport);
    if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
      latest.set(airport, { ...row, airport_icao: airport });
    }
  }
  return latest;
}

async function loadPublished() {
  const { data, error } = await supabase
    .from("atis_messages")
    .select("airport_icao,created_by,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("PF24 ATIS publication state lookup failed:", error);
    return null;
  }

  return latestPublishedByAirport((data ?? []) as PublishedAtis[]);
}

function setDialogLocked(dialog: HTMLElement, locked: boolean) {
  dialog.dataset.pf24AtisLockedByOther = locked ? "true" : "false";

  dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea").forEach((field) => {
    field.disabled = locked;
    field.setAttribute("aria-disabled", locked ? "true" : "false");
  });
}

function setSendVisibility(dialog: HTMLElement, visible: boolean) {
  const send = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim().toUpperCase() === "SEND",
  );
  if (!send) return;

  send.style.display = visible ? "" : "none";
  send.disabled = !visible;
  send.setAttribute("aria-hidden", visible ? "false" : "true");
}

export default function ScopeAtisJurisdictionGuard({ controllerName }: { controllerName: string }) {
  const publishedRef = useRef<Map<string, PublishedAtis>>(new Map());

  const enforce = useCallback(() => {
    const connected = scopeConnected();
    const dialog = findAtisDialog();
    if (!dialog) return;

    const select = airportSelect(dialog);
    if (select) {
      // Connection, not facility type, controls ATIS availability. Any connected
      // ATC position may use the configured ATIS airports; disconnected users may not.
      Array.from(select.options).forEach((option) => {
        const validAirport = ATIS_AIRPORTS.has(option.value.trim().toUpperCase());
        option.disabled = !connected || !validAirport;
        option.hidden = !validAirport;
      });
    }

    const selected = select?.value?.trim().toUpperCase() ?? "";
    const owner = selected ? publishedRef.current.get(selected)?.created_by?.trim() ?? "" : "";
    const lockedByOther = Boolean(selected && owner && owner !== controllerName);
    const unavailable = !connected || !selected || !ATIS_AIRPORTS.has(selected);

    setDialogLocked(dialog, lockedByOther || unavailable);
    setSendVisibility(dialog, !lockedByOther && !unavailable);
  }, [controllerName]);

  useEffect(() => {
    let disposed = false;
    const scopeRoot = document.querySelector<HTMLElement>("main.fixed") ?? document.body;

    const refreshPublished = async () => {
      const next = await loadPublished();
      if (disposed || !next) return;
      publishedRef.current = next;
      enforce();
    };

    void refreshPublished();
    enforce();

    const schedule = () => {
      window.setTimeout(enforce, 0);
      window.setTimeout(enforce, 100);
      window.setTimeout(enforce, 350);
    };

    const onConnection = () => schedule();

    const blockUnauthorizedSend = async (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const dialog = target?.closest<HTMLElement>("[data-pf24-atis-dialog='true']");
      if (!dialog) return;

      const button = target?.closest<HTMLButtonElement>("button");
      if (button?.textContent?.trim().toUpperCase() !== "SEND") return;

      // Revalidate from the database only for the actual SEND action. Normal DOM
      // synchronization uses the realtime-backed cache and performs no queries.
      const freshPublished = await loadPublished();
      if (freshPublished) publishedRef.current = freshPublished;

      const selected = airportSelect(dialog)?.value?.trim().toUpperCase() ?? "";
      const owner = selected ? publishedRef.current.get(selected)?.created_by?.trim() ?? "" : "";
      const allowed = scopeConnected()
        && Boolean(selected)
        && ATIS_AIRPORTS.has(selected)
        && (!owner || owner === controllerName);

      if (allowed) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setSendVisibility(dialog, false);
      setDialogLocked(dialog, true);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(scopeRoot, { childList: true, subtree: true });

    const channel = supabase
      .channel("scope-atis-connection-guard-v6")
      .on("postgres_changes", { event: "*", schema: "public", table: "atis_messages" }, () => {
        void refreshPublished();
      })
      .subscribe();

    // Observer, connection events and realtime are the primary paths. This is a
    // low-frequency safety pass for legacy DOM changes that bypass those signals.
    const refreshTimer = window.setInterval(enforce, 5000);

    window.addEventListener("pf24-scope-connection-change", onConnection);
    document.addEventListener("click", schedule, true);
    document.addEventListener("click", blockUnauthorizedSend, true);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      document.removeEventListener("click", schedule, true);
      document.removeEventListener("click", blockUnauthorizedSend, true);
    };
  }, [enforce, controllerName]);

  return null;
}
