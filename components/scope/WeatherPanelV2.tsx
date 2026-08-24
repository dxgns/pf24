"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  scopeClientPointToLocal,
  scopeElementLocalSize,
} from "@/lib/scope/domCoordinates";

type MetarValue = { raw: string | null; loading: boolean; error: boolean; sourceStation?: string };
type RunwaySelection = { active?: boolean };
type WeatherPanelName = "atis" | "metar";
type WeatherVisibility = { atis: boolean; metar: boolean };
type Point = { x: number; y: number };
type AtisRow = { airport_icao: string; info_letter: string; created_at: string };

const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";
const WINDOW_STORAGE_KEY = "pf24_scope_weather_window_v2";
const VISIBILITY_STORAGE_KEY = "pf24_scope_weather_visibility_v1";
const ATIS_CONFIG_STORAGE_KEY = "pf24_scope_atis_configs_v1";
const REFRESH_MS = 60_000;
const METAR_PANEL_WIDTH = 160;
const ATIS_WIDTH = 46;
const CONTROL_WIDTH = 39;
const HEADER_HEIGHT = 17;
const ROW_HEIGHT = 16;
const DEFAULT_VISIBILITY: WeatherVisibility = { metar: true, atis: false };

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

function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), Math.max(min, max)); }
function readVisibility(): WeatherVisibility {
  if (typeof window === "undefined") return DEFAULT_VISIBILITY;
  try {
    const parsed = JSON.parse(localStorage.getItem(VISIBILITY_STORAGE_KEY) ?? "{}") as Partial<WeatherVisibility>;
    return { metar: parsed.metar !== false, atis: parsed.atis === true };
  } catch { return DEFAULT_VISIBILITY; }
}
function getActiveAirports(): string[] {
  try {
    const state = JSON.parse(localStorage.getItem(RUNWAY_STORAGE_KEY) ?? "{}") as Record<string, RunwaySelection>;
    return Array.from(new Set(Object.entries(state).filter(([, value]) => Boolean(value?.active)).map(([key]) => key.split("-")[0]?.toUpperCase()).filter((value): value is string => Boolean(value && /^[A-Z0-9]{4}$/.test(value))))).sort();
  } catch { return []; }
}
function deactivateLocalAtis(airport: string) {
  try {
    const configs = JSON.parse(localStorage.getItem(ATIS_CONFIG_STORAGE_KEY) ?? "{}") as Record<string, Record<string, unknown>>;
    if (configs[airport]) {
      configs[airport] = { ...configs[airport], active: false };
      localStorage.setItem(ATIS_CONFIG_STORAGE_KEY, JSON.stringify(configs));
    }
  } catch {}
  window.dispatchEvent(new CustomEvent("pf24-atis-config-sync"));
}
function extractQnhHpa(raw: string | null): number | null {
  if (!raw) return null;
  const qnh = raw.match(/\bQ(\d{4})\b/i)?.[1];
  if (qnh) return Number(qnh);
  const altimeter = raw.match(/\bA(\d{4})\b/i)?.[1];
  return altimeter ? (Number(altimeter) / 100) * 33.8638866667 : null;
}
function transitionLevel(station: string, raw: string | null): string {
  const ta = TA_BY_AIRPORT[station];
  const qnh = extractQnhHpa(raw);
  if (!ta || qnh === null) return "---";
  const band = TRANSITION_LEVEL_TABLE.find(({ min, max }) => qnh >= min && qnh <= max);
  if (!band) return "---";
  return String(ta === 4000 ? band.ta4000 : band.ta3000).padStart(3, "0");
}
function compactMetar(station: string, raw: string | null) {
  if (!raw) return `${station} -----KT Q----`;
  const wind = raw.match(/\b(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT\b/i)?.[0]?.toUpperCase() ?? "-----KT";
  let qnh = raw.match(/\bQ\d{4}\b/i)?.[0]?.toUpperCase() ?? null;
  if (!qnh) {
    const hpa = extractQnhHpa(raw);
    if (hpa !== null) qnh = `Q${String(Math.round(hpa)).padStart(4, "0")}`;
  }
  return `${station} ${wind} ${qnh ?? "Q----"}`;
}
function formatFullMetar(raw: string) { const trimmed = raw.trim(); return /^METAR\b/i.test(trimmed) ? trimmed : `METAR ${trimmed}`; }
function findRadar() { return document.querySelector<HTMLElement>("main.fixed > section"); }
function findFooterForm() { return document.querySelector<HTMLFormElement>("main.fixed footer form"); }
function hideNativeWeather() {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"));
  windows.forEach((win) => {
    const title = win.firstElementChild?.textContent ?? "";
    if (title.includes("Metars") || title.includes("ATIS")) win.style.display = "none";
  });
}
function hideDefaultFooterMetar(form: HTMLFormElement | null) {
  if (!form) return;
  for (const child of Array.from(form.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.dataset.pf24FullMetar === "true") continue;
    if (child.textContent?.trim().startsWith("METAR")) child.style.display = "none";
  }
}
function setTransitionLevelDisplay(value: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("main.fixed header button")).find((item) => {
    const text = item.textContent?.replace(/\s+/g, " ").toUpperCase() ?? "";
    return text.includes("TRANS") && text.includes("LVL");
  });
  const spans = button?.querySelectorAll<HTMLElement>("span");
  const target = spans && spans.length > 1 ? spans[spans.length - 1] : null;
  if (target) target.textContent = value;
}
function readWindowPosition(): Point {
  try {
    const parsed = JSON.parse(localStorage.getItem(WINDOW_STORAGE_KEY) ?? "{}") as Partial<Point>;
    return { x: typeof parsed.x === "number" ? parsed.x : 1265, y: typeof parsed.y === "number" ? parsed.y : 48 };
  } catch { return { x: 1265, y: 48 }; }
}
function ListIcon() { return <svg width="10" height="8" viewBox="0 0 12 10"><rect x="2" y="1" width="8" height="8" fill="none" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="3" x2="9" y2="3" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="5" x2="9" y2="5" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="7" x2="9" y2="7" stroke="#d8e4e1" strokeWidth=".7"/></svg>; }
function CollapseIcon({ collapsed }: { collapsed: boolean }) { return <svg width="10" height="8" viewBox="0 0 12 10"><path d={collapsed ? "M2 3 L6 7 L10 3" : "M2 7 L6 3 L10 7"} fill="none" stroke="#d8e4e1" strokeWidth=".8"/></svg>; }
function CloseIcon() { return <svg width="10" height="8" viewBox="0 0 12 10"><line x1="2" y1="1" x2="10" y2="9" stroke="#d8e4e1" strokeWidth=".8"/><line x1="10" y1="1" x2="2" y2="9" stroke="#d8e4e1" strokeWidth=".8"/></svg>; }

export default function WeatherPanelV2() {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [footerForm, setFooterForm] = useState<HTMLFormElement | null>(null);
  const [airports, setAirports] = useState<string[]>([]);
  const [metars, setMetars] = useState<Record<string, MetarValue>>({});
  const [atisLetters, setAtisLetters] = useState<Record<string, string>>({});
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [atisPopup, setAtisPopup] = useState<string | null>(null);
  const [deletingAtis, setDeletingAtis] = useState<string | null>(null);
  const [visible, setVisible] = useState<WeatherVisibility>(() => readVisibility());
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<Point>({ x: 1265, y: 48 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const airportKey = useMemo(() => airports.join(","), [airports]);
  const selectedRaw = selectedStation ? metars[selectedStation]?.raw ?? null : null;
  const totalWidth = (visible.metar ? METAR_PANEL_WIDTH : 0) + (visible.atis ? ATIS_WIDTH : 0);
  const metarTitleWidth = METAR_PANEL_WIDTH - CONTROL_WIDTH;

  const syncEnvironment = useCallback(() => {
    const nextRadar = findRadar();
    const nextFooter = findFooterForm();
    setRadar(nextRadar); setFooterForm(nextFooter); setAirports(getActiveAirports()); hideNativeWeather(); hideDefaultFooterMetar(nextFooter);
  }, []);
  const loadAtis = useCallback(async () => {
    const { data } = await supabase.from("atis_messages").select("airport_icao,info_letter,created_at").order("created_at", { ascending: false });
    const next: Record<string, string> = {};
    for (const row of (data ?? []) as AtisRow[]) if (!next[row.airport_icao]) next[row.airport_icao] = row.info_letter;
    setAtisLetters(next);
  }, []);

  useEffect(() => { localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visible)); }, [visible]);
  useEffect(() => {
    setPosition(readWindowPosition()); syncEnvironment(); void loadAtis();
    const onClick = () => window.setTimeout(syncEnvironment, 0);
    document.addEventListener("click", onClick, true);
    window.addEventListener("storage", syncEnvironment);
    const channel = supabase.channel("scope-weather-atis-v2").on("postgres_changes", { event: "*", schema: "public", table: "atis_messages" }, () => void loadAtis()).subscribe();
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("storage", syncEnvironment); supabase.removeChannel(channel); };
  }, [loadAtis, syncEnvironment]);
  useEffect(() => {
    const onToggle = (event: Event) => {
      const panel = (event as CustomEvent<WeatherPanelName>).detail;
      if (panel !== "atis" && panel !== "metar") return;
      setVisible((current) => ({ ...current, [panel]: !current[panel] })); setCollapsed(false);
    };
    window.addEventListener("pf24-weather-toggle", onToggle);
    return () => window.removeEventListener("pf24-weather-toggle", onToggle);
  }, []);
  useEffect(() => {
    const stations = airportKey ? airportKey.split(",") : [];
    let cancelled = false;
    if (stations.length === 0) { setMetars({}); setSelectedStation(null); setAtisPopup(null); return; }
    const refresh = async () => {
      setMetars((current) => Object.fromEntries(stations.map((station) => [station, current[station] ?? { raw: null, loading: true, error: false, sourceStation: station }])));
      const results = await Promise.all(stations.map(async (station): Promise<[string, MetarValue]> => {
        try {
          const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(station)}`, { cache: "no-store" });
          if (!response.ok) return [station, { raw: null, loading: false, error: true, sourceStation: station }];
          const data = await response.json() as { raw?: string | null; sourceStation?: string };
          return [station, { raw: data.raw ?? null, loading: false, error: false, sourceStation: data.sourceStation?.toUpperCase() || station }];
        } catch { return [station, { raw: null, loading: false, error: true, sourceStation: station }]; }
      }));
      if (!cancelled) setMetars(Object.fromEntries(results));
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [airportKey]);
  useEffect(() => {
    if (!selectedStation || !visible.metar) { setTransitionLevelDisplay("---"); return; }
    setTransitionLevelDisplay(transitionLevel(selectedStation, selectedRaw));
  }, [selectedRaw, selectedStation, visible.metar]);
  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-atis-letter='true']") || target?.closest("[data-pf24-atis-delete-popup='true']")) return;
      setAtisPopup(null);
      if (target?.closest("[data-pf24-weather-window='true']")) return;
      setSelectedStation(null);
    };
    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, []);
  useEffect(() => {
    if (!radar) return;

    const clampCurrentPosition = () => {
      const size = scopeElementLocalSize(radar);
      const totalHeight = collapsed ? HEADER_HEIGHT : HEADER_HEIGHT + Math.max(1, airports.length) * ROW_HEIGHT;
      const maxX = Math.max(2, size.x - totalWidth - 2);
      const maxY = Math.max(2, size.y - totalHeight - 2);
      setPosition((current) => ({
        x: clamp(current.x, 2, maxX),
        y: clamp(current.y, 2, maxY),
      }));
    };

    const onMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const cursor = scopeClientPointToLocal(radar, event.clientX, event.clientY);
      const size = scopeElementLocalSize(radar);
      const maxX = Math.max(2, size.x - totalWidth - 2);
      const totalHeight = collapsed ? HEADER_HEIGHT : HEADER_HEIGHT + Math.max(1, airports.length) * ROW_HEIGHT;
      const maxY = Math.max(2, size.y - totalHeight - 2);
      setPosition({
        x: clamp(cursor.x - dragRef.current.dx, 2, maxX),
        y: clamp(cursor.y - dragRef.current.dy, 2, maxY),
      });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPosition((current) => { localStorage.setItem(WINDOW_STORAGE_KEY, JSON.stringify(current)); return current; });
    };

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(clampCurrentPosition) : null;
    resizeObserver?.observe(radar);
    clampCurrentPosition();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [airports.length, collapsed, radar, totalWidth]);

  const deleteAtis = async (station: string) => {
    try {
      setDeletingAtis(station);
      const { error } = await supabase.from("atis_messages").delete().eq("airport_icao", station);
      if (error) { console.error("PF24 Scope ATIS removal failed:", error); return; }
      deactivateLocalAtis(station); setAtisPopup(null); await loadAtis();
    } finally { setDeletingAtis(null); }
  };

  if (!radar || (!visible.metar && !visible.atis)) return null;

  const startDrag = (event: React.MouseEvent) => {
    const cursor = scopeClientPointToLocal(radar, event.clientX, event.clientY);
    dragRef.current = {
      dx: cursor.x - position.x,
      dy: cursor.y - position.y,
    };
  };

  const weatherWindow = createPortal(
    <div data-pf24-weather-window="true" className="pointer-events-auto absolute z-[31] overflow-visible bg-transparent font-mono" style={{ left: position.x, top: position.y, width: totalWidth, minWidth: totalWidth, maxWidth: totalWidth }}>
      <div className="flex h-[17px] overflow-hidden bg-[#064a40] text-[#e9e9e9]">
        {visible.atis && <div className="flex shrink-0 items-center justify-center border border-[#173d38] text-[8px] tracking-[.5px]" style={{ width: ATIS_WIDTH }} onMouseDown={startDrag}>ATIS</div>}
        {visible.metar && <div className="flex shrink-0" style={{ width: METAR_PANEL_WIDTH }}>
          <div className="flex items-center justify-center border-y border-l border-[#173d38] text-[8px] tracking-[.5px]" style={{ width: metarTitleWidth }} onMouseDown={startDrag}>Metars</div>
          <button type="button" className="flex w-[13px] items-center justify-center border border-[#173d38]"><ListIcon/></button>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex w-[13px] items-center justify-center border-y border-r border-[#173d38]"><CollapseIcon collapsed={collapsed}/></button>
          <button type="button" onClick={() => setVisible({ metar: false, atis: false })} className="flex w-[13px] items-center justify-center border-y border-r border-[#173d38]"><CloseIcon/></button>
        </div>}
      </div>
      {!collapsed && airports.map((station) => {
        const entry = metars[station];
        const atisLetter = atisLetters[station] ?? "-";
        const metarStation = entry?.sourceStation || station;
        return <div key={station} className="relative flex h-[16px] w-full items-center bg-transparent text-left text-[8px] leading-none text-[#00efff]">
          {visible.atis && <button type="button" data-pf24-atis-letter="true" disabled={atisLetter === "-"} onClick={(event) => { event.stopPropagation(); setAtisPopup((current) => current === station ? null : station); }} className="flex h-full shrink-0 items-center pl-[4px] text-left text-[#00efff] disabled:text-[#00efff]" style={{ width: ATIS_WIDTH }}>{atisLetter}</button>}
          {visible.metar && <button type="button" title={metarStation !== station ? `${station} usa METAR de ${metarStation}` : undefined} onClick={(event) => { event.stopPropagation(); setAtisPopup(null); setSelectedStation((current) => current === station ? null : station); }} className="h-full min-w-0 flex-1 whitespace-nowrap bg-transparent px-[4px] text-left text-[#00efff]">{entry?.loading ? `${station} LOADING...` : entry?.error ? `${station} METAR UNAVAILABLE` : compactMetar(metarStation, entry?.raw ?? null)}</button>}
          {visible.atis && atisPopup === station && atisLetter !== "-" && <div data-pf24-atis-delete-popup="true" className="absolute left-[2px] top-[16px] z-[95] min-w-[82px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
            <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-center text-[9px]">ATIS {station}</div>
            <button type="button" disabled={deletingAtis === station} onClick={(event) => { event.stopPropagation(); void deleteAtis(station); }} className="block w-full px-[6px] py-[4px] text-left text-[9px] hover:bg-[#0a5b50] disabled:text-[#899]">{deletingAtis === station ? "DELETING..." : "DELETE ATIS"}</button>
          </div>}
        </div>;
      })}
    </div>, radar,
  );

  const fullMetar = footerForm && selectedStation && selectedRaw && visible.metar ? createPortal(<div data-pf24-full-metar="true" className="ml-1 max-w-[900px] truncate text-[8px] text-[#222]">{formatFullMetar(selectedRaw)}</div>, footerForm) : null;
  return <>{weatherWindow}{fullMetar}</>;
}
