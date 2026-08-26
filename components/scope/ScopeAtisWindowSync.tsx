"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type PublishedAtis = Record<string, string>;

const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";
const WEATHER_WINDOW_SELECTOR = "[data-pf24-weather-window='true']";
const ATIS_BUTTON_SELECTOR = "button[data-pf24-atis-letter='true']";

function getActiveAirports() {
  try {
    const state = JSON.parse(localStorage.getItem(RUNWAY_STORAGE_KEY) ?? "{}") as Record<string, { active?: boolean }>;
    return Array.from(new Set(
      Object.entries(state)
        .filter(([, value]) => Boolean(value?.active))
        .map(([key]) => key.split("-")[0]?.toUpperCase())
        .filter((value): value is string => Boolean(value && /^[A-Z0-9]{4}$/.test(value))),
    )).sort();
  } catch {
    return [];
  }
}

function stationFromRow(row: HTMLElement) {
  for (const button of Array.from(row.querySelectorAll<HTMLButtonElement>("button"))) {
    if (button.matches(ATIS_BUTTON_SELECTOR)) continue;
    const match = (button.textContent ?? "").toUpperCase().match(/\b([A-Z0-9]{4})\b/);
    if (match) return match[1];
  }
  return "";
}

function updateAtisButton(button: HTMLButtonElement, letter: string) {
  if (button.textContent !== letter) button.textContent = letter;
  const disabled = letter === "-";
  if (button.disabled !== disabled) button.disabled = disabled;
}

function removeExtraRows(windowElement: HTMLElement, keep: Set<string>) {
  for (const row of Array.from(windowElement.querySelectorAll<HTMLElement>("[data-pf24-atis-sync-row]"))) {
    const station = row.dataset.pf24AtisSyncRow ?? "";
    if (!keep.has(station)) row.remove();
  }
}

function appendMissingRow(windowElement: HTMLElement, station: string, letter: string, showMetar: boolean) {
  if (windowElement.querySelector(`[data-pf24-atis-sync-row="${CSS.escape(station)}"]`)) return;

  const row = document.createElement("div");
  row.dataset.pf24AtisSyncRow = station;
  row.className = "relative flex h-[16px] w-full items-center bg-transparent text-left text-[8px] leading-none text-[#00efff]";

  const atis = document.createElement("button");
  atis.type = "button";
  atis.dataset.pf24AtisLetter = "true";
  atis.className = "flex h-full shrink-0 items-center pl-[4px] text-left text-[#00efff]";
  atis.style.width = "46px";
  atis.textContent = letter;
  atis.title = `${station} ATIS INFO ${letter}`;
  row.appendChild(atis);

  if (showMetar) {
    const text = document.createElement("div");
    text.className = "h-full min-w-0 flex-1 whitespace-nowrap bg-transparent px-[4px] text-left text-[#00efff]";
    text.textContent = `${station} ATIS INFO ${letter}`;
    row.appendChild(text);
  }

  windowElement.appendChild(row);
}

export default function ScopeAtisWindowSync() {
  const [published, setPublished] = useState<PublishedAtis>({});
  const refreshVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++refreshVersionRef.current;
    const { data, error } = await supabase
      .from("atis_messages")
      .select("airport_icao,info_letter,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("PF24 Scope ATIS window refresh failed:", error);
      return;
    }

    // A DELETE followed immediately by INSERT can produce overlapping reads.
    // Only the newest requested snapshot is allowed to update the window.
    if (version !== refreshVersionRef.current) return;

    const next: PublishedAtis = {};
    for (const row of data ?? []) {
      const station = String(row.airport_icao ?? "").trim().toUpperCase();
      if (!station || next[station]) continue;
      next[station] = String(row.info_letter ?? "-").trim().toUpperCase() || "-";
    }
    setPublished(next);
  }, []);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel("scope-atis-window-sync-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "atis_messages" }, () => void refresh())
      .subscribe();

    // Realtime remains the primary source, but a short fallback also covers
    // browsers where the publication succeeds before the postgres event arrives.
    const fallback = window.setInterval(() => void refresh(), 1500);

    const refreshBurst = () => {
      [100, 450, 1000, 2200].forEach((delay) => {
        window.setTimeout(() => void refresh(), delay);
      });
    };

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
      const isAtisDialogAction = Boolean(button.closest("[data-pf24-atis-dialog='true']"));
      if (!isAtisDialogAction || (label !== "SEND" && label !== "DELETE ATIS")) return;
      refreshBurst();
    };

    const onExplicitSync = () => refreshBurst();
    document.addEventListener("click", onClick, true);
    window.addEventListener("pf24-atis-config-sync", onExplicitSync);
    return () => {
      window.clearInterval(fallback);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pf24-atis-config-sync", onExplicitSync);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    let frame: number | null = null;

    const sync = () => {
      frame = null;
      const windowElement = document.querySelector<HTMLElement>(WEATHER_WINDOW_SELECTOR);
      if (!windowElement) return;

      const header = windowElement.firstElementChild as HTMLElement | null;
      const headerText = (header?.textContent ?? "").toUpperCase();
      const showAtis = headerText.includes("ATIS");
      const showMetar = headerText.includes("METARS");

      const extraRows = Array.from(windowElement.querySelectorAll<HTMLElement>("[data-pf24-atis-sync-row]"));
      if (!showAtis) {
        extraRows.forEach((row) => row.remove());
        return;
      }

      const normalRows = Array.from(windowElement.children)
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
        .filter((row) => row !== header && !row.dataset.pf24AtisSyncRow && Boolean(row.querySelector(ATIS_BUTTON_SELECTOR)));

      const activeAirports = getActiveAirports();
      const represented = new Set<string>();

      normalRows.forEach((row, index) => {
        const station = stationFromRow(row) || activeAirports[index] || "";
        if (!station) return;
        represented.add(station);
        const button = row.querySelector<HTMLButtonElement>(ATIS_BUTTON_SELECTOR);
        if (button) updateAtisButton(button, published[station] ?? "-");
      });

      const desiredExtras = new Set(Object.keys(published).filter((station) => !represented.has(station)));
      removeExtraRows(windowElement, desiredExtras);

      for (const station of Array.from(desiredExtras).sort()) {
        appendMissingRow(windowElement, station, published[station], showMetar);
      }
    };

    const queueSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    queueSync();
    const observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(queueSync, 500);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>("[data-pf24-atis-sync-row]").forEach((row) => row.remove());
    };
  }, [published]);

  return null;
}
