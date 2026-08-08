"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

type MetarValue = { raw: string | null; loading: boolean; error: boolean };
type RunwaySelection = { active?: boolean; dep?: boolean; arr?: boolean };
type MetarTab = "atis" | "metar";

const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";
const REFRESH_MS = 60_000;

const TA_BY_AIRPORT: Record<string, 3000 | 4000> = {
  EFKT: 3000, EGHI: 3000, EGKK: 3000, GCLP: 3000, LCLK: 4000, LCPH: 4000, LCRA: 4000,
  LEMH: 3000, MDAB: 3000, MDCR: 3000, MDPC: 3000, MDST: 3000, MTCA: 3000,
};

const TRANSITION_LEVEL_TABLE = [
  { min: 942.2, max: 959.4, ta3000: 60, ta4000: 70 },
  { min: 959.5, max: 977.1, ta3000: 55, ta4000: 65 },
  { min: 977.2, max: 995.0, ta3000: 50, ta4000: 60 },
  { min: 995.1, max: 1013.2, ta3000: 45, ta4000: 55 },
  { min: 1013.3, max: 1031.6, ta3000: 40, ta4000: 50 },
  { min: 1031.7, max: 1050.3, ta3000: 35, ta4000: 45 },
] as const;

function getActiveAirports(): string[] {
  try {
    const raw = localStorage.getItem(RUNWAY_STORAGE_KEY);
    if (!raw) return [];
    const state = JSON.parse(raw) as Record<string, RunwaySelection>;
    return Array.from(new Set(Object.entries(state)
      .filter(([, value]) => Boolean(value?.active))
      .map(([key]) => key.split("-")[0]?.toUpperCase())
      .filter((value): value is string => Boolean(value && /^[A-Z0-9]{4}$/.test(value))))).sort();
  } catch {
    return [];
  }
}

function extractQnhHpa(raw: string | null): number | null {
  if (!raw) return null;
  const qnh = raw.match(/\bQ(\d{4})\b/i)?.[1];
  if (qnh) {
    const value = Number(qnh);
    return Number.isFinite(value) ? value : null;
  }
  const altimeter = raw.match(/\bA(\d{4})\b/i)?.[1];
  if (!altimeter) return null;
  const value = (Number(altimeter) / 100) * 33.8638866667;
  return Number.isFinite(value) ? value : null;
}

function transitionLevel(station: string, raw: string | null): string {
  const ta = TA_BY_AIRPORT[station];
  const qnh = extractQnhHpa(raw);
  if (!ta || qnh === null) return "---";
  const band = TRANSITION_LEVEL_TABLE.find(({ min, max }) => qnh >= min && qnh <= max);
  if (!band) return "---";
  return String(ta === 4000 ? band.ta4000 : band.ta3000).padStart(3, "0");
}

function compactMetar(station: string, raw: string | null): string {
  if (!raw) return `${station} -----KT Q----`;
  const wind = raw.match(/\b(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT\b/i)?.[0]?.toUpperCase() ?? "-----KT";
  let qnh = raw.match(/\bQ\d{4}\b/i)?.[0]?.toUpperCase() ?? null;
  if (!qnh) {
    const hpa = extractQnhHpa(raw);
    if (hpa !== null) qnh = `Q${String(Math.round(hpa)).padStart(4, "0")}`;
  }
  return `${station} ${wind} ${qnh ?? "Q----"}`;
}

function findMetarHost(): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("section > div.absolute.z-30"));
  return windows.find((win) => {
    const text = win.firstElementChild?.textContent ?? "";
    return text.includes("Metars") || text.includes("ATIS");
  }) ?? null;
}

function findFooterForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>("main.fixed footer form");
}

function findTransitionLevelValue(): HTMLElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("main.fixed header button"));
  const button = buttons.find((item) => item.textContent?.includes("TRANS") && item.textContent?.includes("LVL"));
  if (!button) return null;
  const spans = button.querySelectorAll<HTMLElement>("span");
  return spans.length > 1 ? spans[spans.length - 1] : null;
}

function setTransitionLevelDisplay(value: string) {
  const target = findTransitionLevelValue();
  if (target) target.textContent = value;
}

export default function MetarInteraction() {
  const [metarHost, setMetarHost] = useState<HTMLElement | null>(null);
  const [titleHost, setTitleHost] = useState<HTMLElement | null>(null);
  const [footerForm, setFooterForm] = useState<HTMLFormElement | null>(null);
  const [airports, setAirports] = useState<string[]>([]);
  const [metars, setMetars] = useState<Record<string, MetarValue>>({});
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MetarTab>("metar");

  const airportKey = useMemo(() => airports.join(","), [airports]);
  const selectedRaw = selectedStation ? metars[selectedStation]?.raw ?? null : null;

  const syncHosts = useCallback(() => {
    const host = findMetarHost();
    setMetarHost(host);
    const header = host?.firstElementChild;
    setTitleHost(header?.firstElementChild instanceof HTMLElement ? header.firstElementChild : null);
    setFooterForm(findFooterForm());
  }, []);

  const syncAirports = useCallback(() => setAirports(getActiveAirports()), []);

  useEffect(() => {
    syncHosts();
    syncAirports();
    const onScopeClick = () => window.setTimeout(() => { syncHosts(); syncAirports(); }, 120);
    document.addEventListener("click", onScopeClick, true);
    window.addEventListener("storage", syncAirports);
    return () => {
      document.removeEventListener("click", onScopeClick, true);
      window.removeEventListener("storage", syncAirports);
    };
  }, [syncAirports, syncHosts]);

  useEffect(() => {
    const onTabRequest = (event: Event) => {
      const detail = (event as CustomEvent<MetarTab>).detail;
      if (detail === "atis" || detail === "metar") setActiveTab(detail);
    };
    window.addEventListener("pf24-metar-tab", onTabRequest);
    return () => window.removeEventListener("pf24-metar-tab", onTabRequest);
  }, []);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-metar-row='true']")) return;
      setSelectedStation(null);
    };
    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, []);

  useEffect(() => {
    if (selectedStation && !airports.includes(selectedStation)) setSelectedStation(null);
  }, [airports, selectedStation]);

  useEffect(() => {
    if (!selectedStation || activeTab !== "metar") {
      setTransitionLevelDisplay("---");
      return;
    }
    setTransitionLevelDisplay(transitionLevel(selectedStation, selectedRaw));
    return () => setTransitionLevelDisplay("---");
  }, [activeTab, selectedRaw, selectedStation]);

  useEffect(() => {
    const stations = airportKey ? airportKey.split(",") : [];
    let cancelled = false;
    if (stations.length === 0) {
      setMetars({});
      setSelectedStation(null);
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
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [airportKey]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24MetarInteraction = "true";
    style.textContent = `
      [data-pf24-metar-host='true'] { width: 330px !important; }
      [data-pf24-metar-host='true'] > div:nth-child(2):not([data-pf24-metar-overlay='true']) { display: none !important; }
      [data-pf24-metar-title='true'] { padding: 0 !important; font-size: 0 !important; }
      main.fixed footer form > div.ml-1.text-\\[8px\\]:not([data-pf24-full-metar='true']) { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!metarHost) return;
    metarHost.dataset.pf24MetarHost = "true";
    return () => { delete metarHost.dataset.pf24MetarHost; };
  }, [metarHost]);

  useEffect(() => {
    if (!titleHost) return;
    titleHost.dataset.pf24MetarTitle = "true";
    return () => { delete titleHost.dataset.pf24MetarTitle; };
  }, [titleHost]);

  useEffect(() => () => setTransitionLevelDisplay("---"), []);

  const tabs = titleHost ? createPortal(
    <div className="flex h-full w-full text-[11px] leading-none" data-pf24-metar-tabs="true">
      <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setActiveTab("atis"); }} className={`w-[58px] border-r border-[#173d38] ${activeTab === "atis" ? "bg-[#0a554a]" : ""}`}>ATIS</button>
      <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setActiveTab("metar"); }} className={`flex-1 ${activeTab === "metar" ? "bg-[#0a554a]" : ""}`}>Metars</button>
    </div>, titleHost) : null;

  const upper = metarHost ? createPortal(
    <div className="max-h-[96px] overflow-y-auto px-1 py-1 text-[9px] leading-[13px] text-[#00efff]" data-pf24-metar-overlay="true">
      {activeTab === "atis" ? (
        <div className="min-h-[26px] px-1 py-1 text-[#9ca3a3]">No ATIS available</div>
      ) : airports.length === 0 ? (
        <div className="text-[#9ca3a3]">No active airports</div>
      ) : airports.map((station) => {
        const entry = metars[station];
        const label = entry?.loading ? `${station} -----KT Q----` : entry?.error ? `${station} METAR UNAVAILABLE` : compactMetar(station, entry?.raw ?? null);
        return <button key={station} type="button" data-pf24-metar-row="true" className="block w-full whitespace-nowrap text-left hover:bg-[#0b302d]" onClick={(event) => { event.stopPropagation(); if (entry?.raw) setSelectedStation(station); }}>{label}</button>;
      })}
    </div>, metarHost) : null;

  const lower = footerForm && selectedRaw && activeTab === "metar" ? createPortal(
    <div className="ml-1 min-w-0 flex-1 truncate text-[8px] text-[#222]" data-pf24-full-metar="true">METAR&nbsp;&nbsp;{selectedRaw}</div>, footerForm) : null;

  return <>{tabs}{upper}{lower}</>;
}
