"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

type MetarValue = { raw: string | null; loading: boolean; error: boolean };
type RunwaySelection = { active?: boolean; dep?: boolean; arr?: boolean };

const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";
const REFRESH_MS = 60_000;

function getActiveAirports(): string[] {
  try {
    const raw = localStorage.getItem(RUNWAY_STORAGE_KEY);
    if (!raw) return [];
    const state = JSON.parse(raw) as Record<string, RunwaySelection>;
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

function compactMetar(station: string, raw: string | null): string {
  if (!raw) return `${station} -----KT Q----`;

  const wind = raw.match(/\b(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT\b/i)?.[0]?.toUpperCase() ?? "-----KT";
  let qnh = raw.match(/\bQ\d{4}\b/i)?.[0]?.toUpperCase() ?? null;

  if (!qnh) {
    const altimeter = raw.match(/\bA(\d{4})\b/i)?.[1];
    if (altimeter) {
      const hpa = Math.round((Number(altimeter) / 100) * 33.8638866667);
      if (Number.isFinite(hpa)) qnh = `Q${String(hpa).padStart(4, "0")}`;
    }
  }

  return `${station} ${wind} ${qnh ?? "Q----"}`;
}

function findMetarHost(): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("section > div.absolute.z-30"));
  for (const win of windows) {
    const header = win.firstElementChild;
    if (header?.textContent?.includes("Metars")) return win;
  }
  return null;
}

function findFooterForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>("main.fixed footer form");
}

export default function MetarInteraction() {
  const [metarHost, setMetarHost] = useState<HTMLElement | null>(null);
  const [footerForm, setFooterForm] = useState<HTMLFormElement | null>(null);
  const [airports, setAirports] = useState<string[]>([]);
  const [metars, setMetars] = useState<Record<string, MetarValue>>({});
  const [selectedRaw, setSelectedRaw] = useState<string | null>(null);

  const airportKey = useMemo(() => airports.join(","), [airports]);

  const syncHosts = useCallback(() => {
    setMetarHost(findMetarHost());
    setFooterForm(findFooterForm());
  }, []);

  const syncAirports = useCallback(() => {
    setAirports(getActiveAirports());
  }, []);

  useEffect(() => {
    syncHosts();
    syncAirports();

    const onScopeClick = () => {
      window.setTimeout(() => {
        syncHosts();
        syncAirports();
      }, 120);
    };

    document.addEventListener("click", onScopeClick, true);
    window.addEventListener("storage", syncAirports);
    return () => {
      document.removeEventListener("click", onScopeClick, true);
      window.removeEventListener("storage", syncAirports);
    };
  }, [syncAirports, syncHosts]);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-metar-row='true']")) return;
      setSelectedRaw(null);
    };

    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, []);

  useEffect(() => {
    const stations = airportKey ? airportKey.split(",") : [];
    let cancelled = false;

    if (stations.length === 0) {
      setMetars({});
      setSelectedRaw(null);
      return;
    }

    setMetars((current) => Object.fromEntries(stations.map((station) => [station, current[station] ?? { raw: null, loading: true, error: false }])));

    const refresh = async () => {
      const results = await Promise.all(stations.map(async (station): Promise<[string, MetarValue]> => {
        try {
          const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(station)}`, { cache: "no-store" });
          if (!response.ok) return [station, { raw: null, loading: false, error: true }];
          const data = await response.json() as { raw?: string | null };
          return [station, { raw: data.raw ?? null, loading: false, error: false }];
        } catch {
          return [station, { raw: null, loading: false, error: true }];
        }
      }));

      if (!cancelled) setMetars(Object.fromEntries(results));
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [airportKey]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24MetarInteraction = "true";
    style.textContent = `
      [data-pf24-metar-host='true'] > div:nth-child(2):not([data-pf24-metar-overlay='true']) { display: none !important; }
      main.fixed footer form > div.ml-1.text-\\[8px\\] { visibility: hidden !important; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!metarHost) return;
    metarHost.dataset.pf24MetarHost = "true";
    return () => {
      delete metarHost.dataset.pf24MetarHost;
    };
  }, [metarHost]);

  const upper = metarHost ? createPortal(
    <div className="max-h-[150px] overflow-y-auto px-1 py-1 text-[9px] leading-[13px] text-[#00efff]" data-pf24-metar-overlay="true">
      {airports.length === 0 ? (
        <div className="text-[#9ca3a3]">No active airports</div>
      ) : airports.map((station) => {
        const entry = metars[station];
        const label = entry?.loading
          ? `${station} -----KT Q----`
          : entry?.error
            ? `${station} METAR UNAVAILABLE`
            : compactMetar(station, entry?.raw ?? null);
        return (
          <button
            key={station}
            type="button"
            data-pf24-metar-row="true"
            className="block w-full whitespace-nowrap text-left hover:bg-[#0b302d]"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedRaw(entry?.raw ?? null);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>,
    metarHost,
  ) : null;

  const lower = footerForm && selectedRaw ? createPortal(
    <div className="ml-1 min-w-0 flex-1 truncate text-[8px] text-[#222]" data-pf24-full-metar="true">
      METAR&nbsp;&nbsp;{selectedRaw}
    </div>,
    footerForm,
  ) : null;

  return <>{upper}{lower}</>;
}
