"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type Measurement = { id: number; first: string; second: string };
type RenderedMeasurement = Measurement & { a: Point; b: Point; distanceNm: number };

const RADAR_VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const TIMER_PRESETS = [30, 60, 90, 120, 180] as const;

function findScopeWindow(title: string): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"));
  return windows.find((win) => win.firstElementChild?.textContent?.toUpperCase().includes(title.toUpperCase())) ?? null;
}

function findWeatherWindow(): HTMLElement | null {
  return findScopeWindow("Metars") ?? findScopeWindow("ATIS");
}

function findSecondBarButton(label: string): HTMLButtonElement | null {
  const bar = document.querySelector<HTMLElement>("main.fixed header > div:last-child");
  return Array.from(bar?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === label) ?? null;
}

function findDistanceButton(): HTMLButtonElement | null {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  const buttons = Array.from(row?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []);
  return buttons.at(-1) ?? null;
}

function trafficCallsign(target: Element): string | null {
  const hit = target.closest<HTMLElement>("[data-pf24-traffic-select='true']");
  if (!hit) return null;
  const label = hit.getAttribute("aria-label") ?? "";
  return label.match(/(?:Seleccionar|Abrir información de)\s+(.+)$/i)?.[1]?.trim() ?? null;
}

function trafficCenter(callsign: string): Point | null {
  const hits = Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-traffic-select='true']"));
  const target = hits.find((item) => (item.getAttribute("aria-label") ?? "").trim() === `Seleccionar ${callsign}`)
    ?? hits.find((item) => (item.getAttribute("aria-label") ?? "").endsWith(callsign));
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  const radar = document.querySelector<HTMLElement>("main.fixed > section");
  if (!radar) return null;
  const radarRect = radar.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - radarRect.left, y: rect.top + rect.height / 2 - radarRect.top };
}

function radarZoom() {
  try {
    const raw = localStorage.getItem(RADAR_VIEWPORT_KEY);
    const parsed = raw ? JSON.parse(raw) as { zoom?: number } : null;
    return typeof parsed?.zoom === "number" && Number.isFinite(parsed.zoom) ? parsed.zoom : 1;
  } catch {
    return 1;
  }
}

function playTimerSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch {}
}

function TimerPanel() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running || deadlineRef.current === null) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        deadlineRef.current = null;
        setRunning(false);
        playTimerSound();
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [running]);

  const start = (seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setRunning(true);
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return <div className="absolute inset-0 flex flex-col bg-[#151515] text-[#e8e8e8]" data-pf24-functional-timer="true">
    <div className="flex h-[22px] items-center justify-center border-b border-[#151515] bg-[#2b2b2b] text-[12px] leading-none">{minutes}:{String(seconds).padStart(2, "0")}</div>
    <div className="grid h-[21px] grid-cols-5 bg-[#1f1f1f] text-[11px]">
      {TIMER_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => start(preset)} className="border-r border-[#050505] last:border-r-0 hover:bg-[#303030]">{preset}</button>)}
    </div>
  </div>;
}

export default function ScopeFunctionalExtras() {
  const [timerBody, setTimerBody] = useState<HTMLElement | null>(null);
  const [radarHost, setRadarHost] = useState<HTMLElement | null>(null);
  const [distanceMode, setDistanceMode] = useState(false);
  const [firstTraffic, setFirstTraffic] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const suppressDistanceClick = useRef(false);
  const windowVisibility = useRef<Record<string, boolean>>({});
  const openingWeatherHost = useRef(false);

  const syncHosts = useCallback(() => {
    const timerWindow = findScopeWindow("TIMER");
    const body = timerWindow?.children[1] instanceof HTMLElement ? timerWindow.children[1] : null;
    setTimerBody(body);
    setRadarHost(document.querySelector<HTMLElement>("main.fixed > section"));
    if (body) body.style.position = "relative";
  }, []);

  const syncPasswordLabel = useCallback(() => {
    const dialog = document.querySelector<HTMLElement>(".connectBox");
    if (!dialog) return;
    const rows = Array.from(dialog.querySelectorAll<HTMLElement>("div.mb-1"));
    for (const row of rows) {
      const label = row.firstElementChild;
      if (label instanceof HTMLElement && label.textContent?.trim() === "Password") label.textContent = "Password ATC";
    }
  }, []);

  useEffect(() => {
    syncHosts();
    syncPasswordLabel();
    const onClick = () => window.setTimeout(() => { syncHosts(); syncPasswordLabel(); }, 0);
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [syncHosts, syncPasswordLabel]);

  useEffect(() => {
    if (measurements.length === 0) return;
    const timer = window.setInterval(() => setRenderTick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [measurements.length]);

  useEffect(() => {
    const onToolbarClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.dataset.pf24TopAtis === "true") return;

      const distanceButton = findDistanceButton();
      if (target === distanceButton) {
        if (suppressDistanceClick.current) {
          suppressDistanceClick.current = false;
          return;
        }
        setDistanceMode((enabled) => {
          const next = !enabled;
          if (!next) setFirstTraffic(null);
          return next;
        });
        return;
      }

      const label = target.textContent?.trim();
      if (!["CLOCK", "HOLDS", "METAR", "ATIS"].includes(label ?? "")) return;

      if (label === "METAR" || label === "ATIS") {
        if (openingWeatherHost.current && label === "METAR") return;
        const panel = label === "ATIS" ? "atis" : "metar";
        const host = findWeatherWindow();
        if (!host && label === "ATIS") {
          openingWeatherHost.current = true;
          findSecondBarButton("METAR")?.click();
          openingWeatherHost.current = false;
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("pf24-weather-toggle", { detail: panel })), 40);
          return;
        }
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("pf24-weather-toggle", { detail: panel })), 0);
        return;
      }

      const key = label === "CLOCK" ? "TIMER" : "HOLD LIST";
      const before = findScopeWindow(key);
      const wasVisible = before ? before.style.display !== "none" : false;
      window.setTimeout(() => {
        const host = findScopeWindow(key);
        if (!host) return;
        const hidden = windowVisibility.current[key] ?? !wasVisible;
        const shouldHide = before && wasVisible && !hidden;
        if (shouldHide) {
          host.style.display = "none";
          windowVisibility.current[key] = true;
        } else {
          host.style.display = "";
          windowVisibility.current[key] = false;
        }
      }, 0);
    };

    document.addEventListener("click", onToolbarClick, true);
    return () => document.removeEventListener("click", onToolbarClick, true);
  }, []);

  useEffect(() => {
    const onTrafficClick = (event: MouseEvent) => {
      if (!distanceMode) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const callsign = trafficCallsign(target);
      if (!callsign) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!firstTraffic) {
        setFirstTraffic(callsign);
        return;
      }
      if (firstTraffic === callsign) return;
      setMeasurements((current) => [...current, { id: Date.now(), first: firstTraffic, second: callsign }]);
      setFirstTraffic(null);
      setDistanceMode(false);
      const button = findDistanceButton();
      if (button) {
        suppressDistanceClick.current = true;
        window.setTimeout(() => button.click(), 0);
      }
    };
    document.addEventListener("click", onTrafficClick, true);
    return () => document.removeEventListener("click", onTrafficClick, true);
  }, [distanceMode, firstTraffic]);

  const renderedMeasurements = useMemo<RenderedMeasurement[]>(() => {
    void renderTick;
    const zoom = Math.max(0.01, radarZoom());
    return measurements.flatMap((measurement) => {
      const a = trafficCenter(measurement.first);
      const b = trafficCenter(measurement.second);
      if (!a || !b) return [];
      const distanceNm = Math.hypot(b.x - a.x, b.y - a.y) / zoom / 20;
      return [{ ...measurement, a, b, distanceNm }];
    });
  }, [measurements, renderTick]);

  const timerPortal = timerBody ? createPortal(<TimerPanel />, timerBody) : null;
  const measurementPortal = radarHost ? createPortal(
    <svg className="pointer-events-none absolute inset-0 z-[11] h-full w-full" data-pf24-distance-layer="true">
      {renderedMeasurements.map((measurement) => {
        const midX = (measurement.a.x + measurement.b.x) / 2;
        const midY = (measurement.a.y + measurement.b.y) / 2;
        return <g key={measurement.id}>
          <line x1={measurement.a.x} y1={measurement.a.y} x2={measurement.b.x} y2={measurement.b.y} stroke="#8a8a8a" strokeWidth="2" className="pointer-events-auto cursor-pointer" onDoubleClick={(event) => { event.stopPropagation(); setMeasurements((current) => current.filter((item) => item.id !== measurement.id)); }} />
          <text x={midX + 8} y={midY - 5} fill="#8a8a8a" fontSize="12" fontFamily="monospace">{Math.max(0.1, measurement.distanceNm).toFixed(1)}nm</text>
        </g>;
      })}
    </svg>, radarHost) : null;

  return <>{timerPortal}{measurementPortal}</>;
}
