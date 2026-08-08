"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

type Traffic = {
  id: string;
  callsign: string;
  aircraftType: string;
  altitude: number;
  targetAltitude: number;
  verticalRate: number;
  heading: number;
  targetHeading: number;
  groundSpeed: number;
  x: number;
  y: number;
  squawk: string;
  departure: string;
  arrival: string;
  fix: string;
};

type TrailPoint = { x: number; y: number };

const TRAFFIC_SEED: Traffic[] = [
  { id: "t1", callsign: "LAN337", aircraftType: "A320", altitude: 5000, targetAltitude: 6000, verticalRate: 1200, heading: 180, targetHeading: 180, groundSpeed: 180, x: 29, y: 34, squawk: "9999", departure: "MDPC", arrival: "MDST", fix: "VOGEP" },
  { id: "t2", callsign: "IBE6421", aircraftType: "A320", altitude: 11200, targetAltitude: 11000, verticalRate: -700, heading: 94, targetHeading: 94, groundSpeed: 286, x: 56, y: 26, squawk: "5162", departure: "GCLP", arrival: "LEMH", fix: "KOPRO" },
  { id: "t3", callsign: "BAW215", aircraftType: "B738", altitude: 7800, targetAltitude: 9000, verticalRate: 1400, heading: 315, targetHeading: 315, groundSpeed: 244, x: 72, y: 63, squawk: "4317", departure: "EGKK", arrival: "EGHI", fix: "SURLI" },
  { id: "t4", callsign: "RYR82KM", aircraftType: "B738", altitude: 14600, targetAltitude: 14000, verticalRate: -900, heading: 228, targetHeading: 228, groundSpeed: 318, x: 84, y: 31, squawk: "2743", departure: "EGHI", arrival: "EGKK", fix: "ARSOT" },
  { id: "t5", callsign: "VLG3912", aircraftType: "A320", altitude: 9200, targetAltitude: 10000, verticalRate: 1000, heading: 48, targetHeading: 48, groundSpeed: 272, x: 39, y: 69, squawk: "6031", departure: "LEMH", arrival: "GCLP", fix: "NEVLO" },
  { id: "t6", callsign: "CFG7KD", aircraftType: "A321", altitude: 6300, targetAltitude: 5000, verticalRate: -1100, heading: 132, targetHeading: 132, groundSpeed: 220, x: 18, y: 72, squawk: "2204", departure: "LCLK", arrival: "LCPH", fix: "VUPAN" },
  { id: "t7", callsign: "PAA481", aircraftType: "B739", altitude: 18100, targetAltitude: 18000, verticalRate: -400, heading: 266, targetHeading: 266, groundSpeed: 342, x: 68, y: 79, squawk: "7441", departure: "MDST", arrival: "MDPC", fix: "SULI" },
  { id: "t8", callsign: "NKS904", aircraftType: "A20N", altitude: 10400, targetAltitude: 12000, verticalRate: 1300, heading: 12, targetHeading: 12, groundSpeed: 295, x: 48, y: 48, squawk: "3526", departure: "MDPC", arrival: "MDST", fix: "PIXE" },
];

function shortestTurn(current: number, target: number) {
  return ((target - current + 540) % 360) - 180;
}

function flightLevel(altitude: number) {
  return String(Math.max(0, Math.round(altitude / 100))).padStart(3, "0");
}

function trendSymbol(verticalRate: number) {
  if (verticalRate > 150) return "↑";
  if (verticalRate < -150) return "↓";
  return "";
}

function findRadar(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function getToolbarButtons(): HTMLButtonElement[] {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return row ? Array.from(row.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

export default function TrafficSimulation() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [traffic, setTraffic] = useState<Traffic[]>(TRAFFIC_SEED);
  const [selectedId, setSelectedId] = useState<string>(TRAFFIC_SEED[0].id);
  const [showHeading, setShowHeading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>(() => Object.fromEntries(TRAFFIC_SEED.map((a) => [a.id, []])));

  const selected = useMemo(() => traffic.find((a) => a.id === selectedId) ?? null, [selectedId, traffic]);

  useEffect(() => {
    setHost(findRadar());
    const retry = window.setTimeout(() => setHost(findRadar()), 250);
    return () => window.clearTimeout(retry);
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficSimulation = "true";
    style.textContent = `
      main.fixed > section > button.absolute.z-10 { display: none !important; }
      main.fixed > section > div.absolute.right-\\[11px\\].top-\\[272px\\] { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const onToolbarClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const buttons = getToolbarButtons();
      const index = buttons.indexOf(button);
      // Top-bar vector glyph = HDG vector; dotted glyph = history trail.
      if (index === 5) setShowHeading((v) => !v);
      if (index === 6) setShowTrail((v) => !v);
    };
    document.addEventListener("click", onToolbarClick, true);
    return () => document.removeEventListener("click", onToolbarClick, true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const dt = 0.25;
      setTraffic((current) => current.map((a) => {
        const turn = shortestTurn(a.heading, a.targetHeading);
        const heading = (a.heading + Math.max(-0.5, Math.min(0.5, turn)) + 360) % 360;
        const radians = heading * Math.PI / 180;
        const motion = (a.groundSpeed / 250) * 0.012;
        let x = a.x + Math.sin(radians) * motion;
        let y = a.y - Math.cos(radians) * motion;
        if (x > 98) x = 2;
        if (x < 2) x = 98;
        if (y > 96) y = 4;
        if (y < 4) y = 96;

        const remaining = a.targetAltitude - a.altitude;
        const step = (a.verticalRate / 60) * dt;
        let altitude = a.altitude;
        let verticalRate = a.verticalRate;
        if (Math.abs(remaining) <= Math.abs(step)) {
          altitude = a.targetAltitude;
          verticalRate = 0;
        } else {
          altitude += step;
        }
        return { ...a, x, y, heading, altitude, verticalRate };
      }));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTrails((current) => {
        const next = { ...current };
        for (const a of traffic) {
          next[a.id] = [...(current[a.id] ?? []), { x: a.x, y: a.y }].slice(-6);
        }
        return next;
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [traffic]);

  if (!host) return null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden" data-pf24-traffic-sim="true">
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {traffic.map((a) => {
          const points = trails[a.id] ?? [];
          const vectorLength = Math.max(3.5, Math.min(8, a.groundSpeed / 45));
          const r = a.heading * Math.PI / 180;
          const x2 = a.x + Math.sin(r) * vectorLength;
          const y2 = a.y - Math.cos(r) * vectorLength;
          return <g key={a.id}>
            {showTrail && points.map((p, i) => <circle key={`${a.id}-${i}`} cx={`${p.x}%`} cy={`${p.y}%`} r="2" fill="#00d000" opacity={0.45 + i * 0.08}/>) }
            {showHeading && <line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="#00e000" strokeWidth="1.5"/>}
          </g>;
        })}
      </svg>

      {traffic.map((a) => {
        const active = a.id === selectedId;
        const fl = flightLevel(a.altitude);
        const trend = trendSymbol(a.verticalRate);
        return <button
          key={a.id}
          type="button"
          onClick={() => setSelectedId(a.id)}
          className="pointer-events-auto absolute z-[9] h-4 w-4 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${a.x}%`, top: `${a.y}%` }}
          aria-label={`Seleccionar ${a.callsign}`}
        >
          <span className={`absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rotate-45 border ${active ? "border-[#00ff00]" : "border-[#00d800]"}`}/>
          {active && <span className="absolute left-[13px] top-[10px] h-px w-[34px] origin-left bg-[#00e000] rotate-[118deg]"/>}
          <span className="absolute left-[-105px] top-[25px] w-[150px] text-left font-mono text-[12px] leading-[15px] text-[#00e000]">
            <span className="block text-[10px]">I</span>
            <span className="block text-[16px] leading-[17px]">{a.callsign}</span>
            <span className="block text-[15px] leading-[17px]">A{fl}{trend}&nbsp;&nbsp; {Math.round(a.groundSpeed)}</span>
            <span className="block pl-[62px] text-[15px] leading-[16px]">{a.arrival}</span>
          </span>
        </button>;
      })}

      {selected && <div
        className="absolute z-[9] w-[190px] font-mono text-[12px] leading-[17px] text-[#00e000]"
        style={{ left: `min(calc(${selected.x}% + 42px), calc(100% - 195px))`, top: `min(calc(${selected.y}% + 82px), calc(100% - 90px))` }}
      >
        <div className="text-[#ffff00]">A{selected.squawk}</div>
        <div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div>
        <div>{flightLevel(selected.altitude)}{trendSymbol(selected.verticalRate)} {selected.fix} N{Math.round(selected.groundSpeed)}</div>
        <div>{flightLevel(selected.targetAltitude)} 080 {selected.arrival}</div>
        <div>AHDG ASP TXT</div>
      </div>}
    </div>,
    host,
  );
}
