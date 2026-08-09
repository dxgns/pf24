"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MetarValue = { raw: string | null; loading: boolean; error: boolean };
type RunwaySelection = { active?: boolean; dep?: boolean; arr?: boolean };
type WeatherPanel = "atis" | "metar";
type Point = { x: number; y: number };

const RUNWAY_STORAGE_KEY = "pf24_scope_runways_v2";
const WINDOW_STORAGE_KEY = "pf24_scope_weather_window_v1";
const REFRESH_MS = 60_000;
const WINDOW_WIDTH = 440;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 48;

const TA_BY_AIRPORT: Record<string, 3000 | 4000> = {
  EFKT: 3000,
  EGHI: 3000,
  EGKK: 3000,
  GCLP: 3000,
  LCLK: 4000,
  LCPH: 4000,
  LCRA: 4000,
  LEMH: 3000,
  MDAB: 3000,
  MDCR: 3000,
  MDPC: 3000,
  MDST: 3000,
  MTCA: 3000,
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
    return Array.from(
      new Set(
        Object.entries(state)
          .filter(([, value]) => Boolean(value?.active))
          .map(([key]) => key.split("-")[0]?.toUpperCase())
          .filter((value): value is string => Boolean(value && /^[A-Z0-9]{4}$/.test(value))),
      ),
    ).sort();
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

function compactMetarParts(station: string, raw: string | null) {
  if (!raw) return { station, wind: "-----KT", qnh: "Q----" };

  const wind = raw.match(/\b(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT\b/i)?.[0]?.toUpperCase() ?? "-----KT";
  let qnh = raw.match(/\bQ\d{4}\b/i)?.[0]?.toUpperCase() ?? null;
  if (!qnh) {
    const hpa = extractQnhHpa(raw);
    if (hpa !== null) qnh = `Q${String(Math.round(hpa)).padStart(4, "0")}`;
  }

  return { station, wind, qnh: qnh ?? "Q----" };
}

function findRadar(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function findNativeWeatherWindow(): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"));
  return windows.find((win) => {
    const header = win.firstElementChild?.textContent ?? "";
    return header.includes("Metars") || header.includes("ATIS");
  }) ?? null;
}

function findFooterForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>("main.fixed footer form");
}

function setTransitionLevelDisplay(value: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("main.fixed header button"));
  const button = buttons.find((item) => item.textContent?.includes("TRANS") && item.textContent?.includes("LVL"));
  const spans = button?.querySelectorAll<HTMLElement>("span");
  const target = spans && spans.length > 1 ? spans[spans.length - 1] : null;
  if (target) target.textContent = value;
}

function readWindowPosition(): Point {
  try {
    const raw = localStorage.getItem(WINDOW_STORAGE_KEY);
    if (!raw) return { x: 900, y: 48 };
    const parsed = JSON.parse(raw) as Partial<Point>;
    return {
      x: typeof parsed.x === "number" && Number.isFinite(parsed.x) ? parsed.x : 900,
      y: typeof parsed.y === "number" && Number.isFinite(parsed.y) ? parsed.y : 48,
    };
  } catch {
    return { x: 900, y: 48 };
  }
}

function ListIcon() {
  return <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
    <rect x="3" y="2" width="16" height="16" fill="none" stroke="#e9e9e9" strokeWidth="1.4" />
    <line x1="6" y1="6" x2="16" y2="6" stroke="#e9e9e9" strokeWidth="1.2" />
    <line x1="6" y1="10" x2="16" y2="10" stroke="#e9e9e9" strokeWidth="1.2" />
    <line x1="6" y1="14" x2="16" y2="14" stroke="#e9e9e9" strokeWidth="1.2" />
  </svg>;
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
    <path d={collapsed ? "M4 7 L11 14 L18 7" : "M4 13 L11 6 L18 13"} fill="none" stroke="#e9e9e9" strokeWidth="1.5" />
  </svg>;
}

function CloseIcon() {
  return <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
    <line x1="4" y1="3" x2="18" y2="17" stroke="#e9e9e9" strokeWidth="1.5" />
    <line x1="18" y1="3" x2="4" y2="17" stroke="#e9e9e9" strokeWidth="1.5" />
  </svg>;
}

export default function MetarInteraction() {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [footerForm, setFooterForm] = useState<HTMLFormElement | null>(null);
  const [airports, setAirports] = useState<string[]>([]);
  const [metars, setMetars] = useState<Record<string, MetarValue>>({});
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [visible, setVisible] = useState({ metar: true, atis: false });
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<Point>({ x: 900, y: 48 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const airportKey = useMemo(() => airports.join(","), [airports]);
  const selectedRaw = selectedStation ? metars[selectedStation]?.raw ?? null : null;

  const syncEnvironment = useCallback(() => {
    const nextRadar = findRadar();
    setRadar(nextRadar);
    setFooterForm(findFooterForm());
    setAirports(getActiveAirports());

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
      const panel = (event as CustomEvent<WeatherPanel>).detail;
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
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
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
      const maxX = Math.max(2, rect.width - WINDOW_WIDTH - 2);
      const bodyHeight = collapsed ? HEADER_HEIGHT : HEADER_HEIGHT + Math.max(ROW_HEIGHT, Math.min(4, Math.max(1, airports.length)) * ROW_HEIGHT);
      const maxY = Math.max(2, rect.height - bodyHeight - 2);
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
  }, [airports.length, collapsed, radar]);

  useEffect(() => () => setTransitionLevelDisplay("---"), []);

  if (!radar || (!visible.metar && !visible.atis)) return null;

  const rows = airports.length === 0 ? (
    <div className="flex h-[48px] items-center px-[14px] font-mono text-[15px] text-[#8e9696]">No active airports</div>
  ) : airports.map((station) => {
    const entry = metars[station];
    const parts = entry?.loading
      ? { station, wind: "-----KT", qnh: "Q----" }
      : entry?.error
        ? { station, wind: "METAR", qnh: "UNAVAILABLE" }
        : compactMetarParts(station, entry?.raw ?? null);

    return <button
      key={station}
      type="button"
      data-pf24-metar-row="true"
      onClick={(event) => {
        event.stopPropagation();
        if (entry?.raw) setSelectedStation(station);
      }}
      className="grid h-[48px] w-full grid-cols-[34px_86px_1fr_96px] items-center px-[14px] text-left font-mono text-[20px] leading-none tracking-[1px] text-[#00efff] hover:bg-[#0b302d]"
    >
      <span>X</span>
      <span>{parts.station}</span>
      <span>{parts.wind}</span>
      <span className="text-right">{parts.qnh}</span>
    </button>;
  });

  const weatherWindow = createPortal(
    <div
      data-pf24-weather-window="true"
      className="pointer-events-auto absolute z-[31] overflow-hidden bg-[#151515] font-mono"
      style={{ left: position.x, top: position.y, width: WINDOW_WIDTH }}
    >
      <div className="flex h-[30px] border border-[#173d38] bg-[#064a40] text-[#e9e9e9]">
        <div
          className="flex min-w-0 flex-1 cursor-move items-stretch"
          onMouseDown={(event) => {
            if (event.button !== 0 || !radar) return;
            const rect = radar.getBoundingClientRect();
            dragRef.current = {
              dx: event.clientX - rect.left - position.x,
              dy: event.clientY - rect.top - position.y,
            };
            event.preventDefault();
          }}
        >
          {visible.atis && <div className={`${visible.metar ? "w-[112px] shrink-0 border-r border-[#173d38]" : "flex-1"} flex items-center justify-center text-[20px] tracking-[2px]`}>ATIS</div>}
          {visible.metar && <div className="flex flex-1 items-center justify-center text-[20px] tracking-[2px]">Metars</div>}
        </div>

        <button type="button" className="flex h-full w-[36px] items-center justify-center border-l border-[#173d38]" aria-label="Opciones"><ListIcon /></button>
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex h-full w-[36px] items-center justify-center border-l border-[#173d38]" aria-label={collapsed ? "Expandir" : "Colapsar"}><CollapseIcon collapsed={collapsed} /></button>
        <button type="button" onClick={() => setVisible({ metar: false, atis: false })} className="flex h-full w-[36px] items-center justify-center border-l border-[#173d38]" aria-label="Cerrar"><CloseIcon /></button>
      </div>

      {!collapsed && <div className="max-h-[192px] overflow-y-auto border-x border-b border-[#151515] bg-[#151515]">
        {visible.metar ? rows : <div className="h-[48px] bg-[#151515]" />}
      </div>}
    </div>,
    radar,
  );

  const fullMetar = footerForm && selectedRaw && visible.metar ? createPortal(
    <div className="ml-1 min-w-0 flex-1 truncate text-[8px] text-[#222]" data-pf24-full-metar="true">
      METAR&nbsp;&nbsp;{selectedRaw}
    </div>,
    footerForm,
  ) : null;

  return <>{weatherWindow}{fullMetar}</>;
}
