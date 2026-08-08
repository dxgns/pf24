"use client";

import { useEffect, useRef } from "react";

type TransitionContext = {
  ta: 3000 | 4000;
  station: string;
};

const REFRESH_MS = 60_000;

function getCallsignFromScope(): string {
  const cells = Array.from(document.querySelectorAll<HTMLElement>(".scopeTopCell"));
  const text = cells[2]?.textContent?.trim() ?? "";
  return text.split(/\s+/)[0]?.toUpperCase() ?? "";
}

function getTransitionContext(callsign: string): TransitionContext | null {
  if (!callsign) return null;

  const airport = callsign.split("_")[0] ?? "";

  // Isla de Santo Domingo / Hispaniola
  if (airport.startsWith("MD") || airport === "MTCA") {
    const directStations = new Set(["MDPC", "MDST", "MDAB", "MDCR", "MTCA"]);
    return { ta: 3000, station: directStations.has(airport) ? airport : "MDPC" };
  }

  // Gran Bretaña (sectores Londres / Scottish y aeropuertos asociados)
  if (airport.startsWith("EG")) {
    const directStations = new Set(["EGKK", "EGHI"]);
    return { ta: 3000, station: directStations.has(airport) ? airport : "EGKK" };
  }

  // Cyprus
  if (airport.startsWith("LC")) {
    const directStations = new Set(["LCLK", "LCPH", "LCRA"]);
    return { ta: 4000, station: directStations.has(airport) ? airport : "LCLK" };
  }

  // Gran Canaria
  if (airport.startsWith("GC")) {
    return { ta: 3000, station: airport === "GCLP" ? "GCLP" : "GCLP" };
  }

  // Menorca
  if (airport.startsWith("LE")) {
    return { ta: 3000, station: airport === "LEMH" ? "LEMH" : "LEMH" };
  }

  // Kittilä
  if (airport.startsWith("EF")) {
    return { ta: 3000, station: airport === "EFKT" ? "EFKT" : "EFKT" };
  }

  return null;
}

function parseQnh(rawMetar: string): number | null {
  const qMatch = rawMetar.match(/\bQ(\d{4})\b/i);
  if (qMatch) return Number(qMatch[1]);

  const aMatch = rawMetar.match(/\bA(\d{4})\b/i);
  if (aMatch) {
    const inchesHg = Number(aMatch[1]) / 100;
    return Math.round(inchesHg * 33.8638866667 * 10) / 10;
  }

  return null;
}

function calculateTransitionLevel(ta: 3000 | 4000, qnh: number): number {
  let column = 0;
  if (qnh >= 1031.7) column = 5;
  else if (qnh >= 1013.3) column = 4;
  else if (qnh >= 995.1) column = 3;
  else if (qnh >= 977.2) column = 2;
  else if (qnh >= 959.5) column = 1;

  const rows: Record<3000 | 4000, number[]> = {
    3000: [60, 55, 50, 45, 40, 35],
    4000: [70, 65, 60, 55, 50, 45],
  };

  return rows[ta][column];
}

function findTransitionLevelValueElement(): HTMLElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button.scopeTopCell"));
  const button = buttons.find((item) => item.textContent?.includes("TRANS") && item.textContent?.includes("LVL"));
  if (!button) return null;

  const spans = Array.from(button.querySelectorAll<HTMLElement>("span"));
  return spans.at(-1) ?? null;
}

function updateTransitionLevelDisplay(value: string, title?: string) {
  const el = findTransitionLevelValueElement();
  if (!el) return;
  el.textContent = value;
  if (title) el.parentElement?.setAttribute("title", title);
  else el.parentElement?.removeAttribute("title");
}

export default function TransitionLevelSync() {
  const lastCallsign = useRef("");
  const requestId = useRef(0);

  useEffect(() => {
    let disposed = false;
    let intervalId: number | null = null;

    const sync = async (force = false) => {
      const callsign = getCallsignFromScope();

      if (!callsign) {
        lastCallsign.current = "";
        updateTransitionLevelDisplay("---");
        return;
      }

      if (!force && callsign === lastCallsign.current) return;
      lastCallsign.current = callsign;

      const context = getTransitionContext(callsign);
      if (!context) {
        updateTransitionLevelDisplay("---");
        return;
      }

      const currentRequest = ++requestId.current;

      try {
        const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(context.station)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { raw?: string | null };
        if (disposed || currentRequest !== requestId.current) return;

        const raw = data.raw ?? "";
        const qnh = parseQnh(raw);
        if (qnh == null) {
          updateTransitionLevelDisplay("---", `${context.station} · TA ${context.ta} FT · QNH no disponible`);
          return;
        }

        const tl = calculateTransitionLevel(context.ta, qnh);
        updateTransitionLevelDisplay(
          String(tl).padStart(3, "0"),
          `${context.station} · QNH ${qnh.toFixed(qnh % 1 === 0 ? 0 : 1)} · TA ${context.ta} FT · TL ${String(tl).padStart(3, "0")}`,
        );
      } catch {
        if (!disposed) updateTransitionLevelDisplay("---");
      }
    };

    const observer = new MutationObserver(() => void sync(false));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    void sync(true);
    intervalId = window.setInterval(() => void sync(true), REFRESH_MS);

    return () => {
      disposed = true;
      observer.disconnect();
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
