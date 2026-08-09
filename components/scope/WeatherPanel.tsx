"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MetarValue = { raw: string | null; loading: boolean; error: boolean };
type RunwaySelection = { active?: boolean; dep?: boolean; arr?: boolean };
type WeatherPanelName = "atis" | "metar";
type Point = { x: number; y: number };

const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";
const WINDOW_STORAGE_KEY = "pf24_scope_weather_window_v2";
const REFRESH_MS = 60_000;
const METAR_PANEL_WIDTH = 190;
const ATIS_WIDTH = 50;
const CONTROL_WIDTH = 42;
const HEADER_HEIGHT = 18;
const ROW_HEIGHT = 18;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

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

function formatFullMetar(raw: string) {
  const trimmed = raw.trim();
  return /^METAR\b/i.test(trimmed) ? trimmed : `METAR ${trimmed}`;
}

function findRadar(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function findNativeWeatherWindow(): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"));
  return windows.find((win) => {
    const text = win.firstElementChild?.textContent ?? "";
    return text.includes("Metars") || text.includes("ATIS");
  }) ?? null;
}

function findFooterForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>("main.fixed footer form");
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
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("main.fixed header button"));
  const button = buttons.find((item) => item.textContent?.includes("TRANS") && item.textContent?.includes("LVL"));
  if (!button) return;
  const spans = button.querySelectorAll<HTMLElement>("span");
  const target = spans.length > 1 ? spans[spans.length - 1] : null;
  if (target) target.textContent = value;
}

function readWindowPosition(): Point {
  try {
    const raw = localStorage.getItem(WINDOW_STORAGE_KEY);
    if (!raw) return { x: 1265, y: 48 };
    const parsed = JSON.parse(raw) as Partial<Point>;
    return {
      x: typeof parsed.x === "number" && Number.isFinite(parsed.x) ? parsed.x : 1265,
      y: typeof parsed.y === "number" && Number.isFinite(parsed.y) ? parsed.y : 48,
    };
  } catch {
    return { x: 1265, y: 48 };
  }
}

function ListIcon() {
  return <svg width="11" height="9" viewBox="0 0 12 10" aria-hidden="true"><rect x="2" y="1" width="8" height="8" fill="none" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="3" x2="9" y2="3" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="5" x2="9" y2="5" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="7" x2="9" y2="7" stroke="#d8e4e1" strokeWidth=".7"/></svg>;
}
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return <svg width="11" height="9" viewBox="0 0 12 10" aria-hidden="true"><path d={collapsed ? "M2 3 L6 7 L10 3" : "M2 7 L6 3 L10 7"} fill="none" stroke="#d8e4e1" strokeWidth=".8"/></svg>;
}
function CloseIcon() {
  return <svg width="11" height="9" viewBox="0 0 12 10" aria-hidden="true"><line x1="2" y1="1" x2="10" y2="9" stroke="#d8e4e1" strokeWidth=".8"/><line x1="10" y1="1" x2="2" y2="9" stroke="#d8e4e1" strokeWidth=".8"/></svg>;
}

export default function WeatherPanel() {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [footerForm, setFooterForm] = useState<HTMLFormElement | null>(null);
  const [airports, setAirports] = useState<string[]>([]);
  const [metars, setMetars] = useState<Record<string, MetarValue>>({});
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [visible, setVisible] = useState({ metar: true, atis: false });
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
    setRadar(nextRadar);
    setFooterForm(nextFooter);
    setAirports(getActiveAirports());
    hideDefaultFooterMetar(nextFooter);
    const native = findNativeWeatherWindow();
    if (native) native.style.display = "none";
  }, []);

  useEffect(() => {
    setPosition(readWindowPosition());
    syncEnvironment();
    const onClick = () => window.setTimeout(syncEnvironment, 0);
    document.addEventListener("click", onClick, true);
    window.addEventListener("storage", syncEnvironment);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("storage", syncEnvironment);
    };
  }, [syncEnvironment]);

  useEffect(() => {
    const onToggle = (event: Event) => {
      const panel = (event as CustomEvent<WeatherPanelName>).detail;
      if (panel !== "atis" && panel !== "metar") return;
      setVisible((current) => ({ ...current, [panel]: !current[panel] }));
      setCollapsed(false);
    };
    window.addEventListener("pf24-weather-toggle", onToggle);
    return () => window.removeEventListener("pf24-weather-toggle", onToggle);
  }, []);

  useEffect(() => {
    const stations = airportKey ? airportKey.split(",") : [];
    let cancelled = false;
    if (stations.length === 0) {
      setMetars({});
      setSelectedStation(null);
      return;
    }
    const refresh = async () => {
      setMetars((current) => Object.fromEntries(stations.map((station) => [station, current[station] ?? { raw: null, loading: true, error: false }])));
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
    if (selectedStation && !airports.includes(selectedStation)) setSelectedStation(null);
  }, [airports, selectedStation]);

  useEffect(() => {
    if (!selectedStation || !visible.metar) {
      setTransitionLevelDisplay("---");
      return;
    }
    setTransitionLevelDisplay(transitionLevel(selectedStation, selectedRaw));
    return () => setTransitionLevelDisplay("---");
  }, [selectedRaw, selectedStation, visible.metar]);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-weather-window='true']")) return;
      setSelectedStation(null);
    };
    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current || !radar) return;
      const rect = radar.getBoundingClientRect();
      const maxX = Math.max(2, rect.width - totalWidth - 2);
      const bodyRows = Math.max(1, Math.min(5, airports.length));
      const totalHeight = collapsed ? HEADER_HEIGHT : HEADER_HEIGHT + bodyRows * ROW_HEIGHT;
      const maxY = Math.max(2, rect.height - totalHeight - 2);
      setPosition({
        x: clamp(event.clientX - rect.left - dragRef.current.dx, 2, maxX),
        y: clamp(event.clientY - rect.top - dragRef.current.dy, 2, maxY),
      });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPosition((current) => {
        localStorage.setItem(WINDOW_STORAGE_KEY, JSON.stringify(current));
        return current;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [airports.length, collapsed, radar, totalWidth]);

  useEffect(() => () => setTransitionLevelDisplay("---"), []);

  if (!radar || (!visible.metar && !visible.atis)) return null;

  const weatherWindow = createPortal(
    <div
      data-pf24-weather-window="true"
      className="pointer-events-auto absolute z-[31] overflow-hidden bg-[#151515] font-mono"
      style={{ left: position.x, top: position.y, width: totalWidth, minWidth: totalWidth, maxWidth: totalWidth }}
    >
      <div className="flex h-[18px] bg-[#064a40] text-[#e9e9e9]">
        {visible.atis && (
          <div
            className="flex shrink-0 cursor-move items-center justify-center border border-[#173d38] text-[9px] tracking-[.7px]"
            style={{ width: ATIS_WIDTH }}
            onMouseDown={(event) => {
              const rect = radar.getBoundingClientRect();
              dragRef.current = { dx: event.clientX - rect.left - position.x, dy: event.clientY - rect.top - position.y };
            }}
          >ATIS</div>
        )}

        {visible.metar && <div className="flex shrink-0" style={{ width: METAR_PANEL_WIDTH }}>
          <div
            className="flex cursor-move items-center justify-center border-y border-l border-[#173d38] text-[9px] tracking-[.7px]"
            style={{ width: metarTitleWidth }}
            onMouseDown={(event) => {
              const rect = radar.getBoundingClientRect();
              dragRef.current = { dx: event.clientX - rect.left - position.x, dy: event.clientY - rect.top - position.y };
            }}
          >Metars</div>
          <div className="flex h-full shrink-0 border border-[#173d38] border-l-0" style={{ width: CONTROL_WIDTH }}>
            <button type="button" aria-label="Opciones" className="flex w-[14px] items-center justify-center border-l border-[#173d38]"><ListIcon/></button>
            <button type="button" aria-label="Colapsar" onClick={() => setCollapsed((value) => !value)} className="flex w-[14px] items-center justify-center border-l border-[#173d38]"><CollapseIcon collapsed={collapsed}/></button>
            <button type="button" aria-label="Cerrar" onClick={() => setVisible({ metar: false, atis: false })} className="flex w-[14px] items-center justify-center border-l border-[#173d38]"><CloseIcon/></button>
          </div>
        </div>}
      </div>

      {!collapsed && <div data-pf24-metar-overlay="true" className="max-h-[90px] overflow-y-auto overflow-x-hidden bg-[#151515] text-[#00efff]">
        {airports.length === 0 ? (
          <div className="flex h-[18px] items-center text-[8px] text-[#8e9696]">
            {visible.atis && <div className="h-full shrink-0" style={{ width: ATIS_WIDTH }} />}
            {visible.metar && <div className="flex h-full min-w-0 items-center overflow-hidden px-[4px]" style={{ width: METAR_PANEL_WIDTH }}>No active airports</div>}
          </div>
        ) : airports.map((station) => {
          const entry = metars[station];
          const metar = entry?.loading ? `${station} -----KT Q----` : entry?.error ? `${station} METAR UNAVAILABLE` : compactMetar(station, entry?.raw ?? null);
          return <div key={station} className="flex h-[18px] min-w-0 items-center overflow-hidden">
            {visible.atis && <div className="flex h-full shrink-0 items-center px-[4px] text-[8px]" style={{ width: ATIS_WIDTH }}>X</div>}
            {visible.metar && <button
              type="button"
              data-pf24-metar-row="true"
              onClick={(event) => {
                event.stopPropagation();
                if (entry?.raw) setSelectedStation(station);
              }}
              className="flex h-full min-w-0 shrink-0 items-center overflow-hidden whitespace-nowrap px-[4px] text-left text-[8px] tracking-[.1px] hover:bg-[#0b302d]"
              style={{ width: METAR_PANEL_WIDTH }}
            >{metar}</button>}
          </div>;
        })}
      </div>}
    </div>,
    radar,
  );

  const fullMetar = footerForm && selectedRaw && visible.metar ? createPortal(
    <div data-pf24-full-metar="true" className="ml-1 min-w-0 flex-1 truncate text-[8px] text-[#222]">
      {formatFullMetar(selectedRaw)}
    </div>,
    footerForm,
  ) : null;

  return <>{weatherWindow}{fullMetar}</>;
}
