"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

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

type Point = { x: number; y: number };

type DragState = {
  dx: number;
  dy: number;
} | null;

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

const VECTOR_LENGTH_PX = 62;
const TRAIL_DOTS = 5;
const TRAIL_SPACING_PX = 16;
const TARGET_SIZE_PX = 18;
const DETAIL_WIDTH = 190;
const DETAIL_HEIGHT = 88;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function pointFromPercent(hostSize: Point, x: number, y: number): Point {
  return { x: hostSize.x * x / 100, y: hostSize.y * y / 100 };
}

function headingUnit(heading: number): Point {
  const radians = heading * Math.PI / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

export default function TrafficSimulation() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [hostSize, setHostSize] = useState<Point>({ x: 1, y: 1 });
  const [traffic, setTraffic] = useState<Traffic[]>(TRAFFIC_SEED);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeading, setShowHeading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [detailPosition, setDetailPosition] = useState<Point | null>(null);
  const dragRef = useRef<DragState>(null);

  const selected = useMemo(() => traffic.find((a) => a.id === selectedId) ?? null, [selectedId, traffic]);

  useEffect(() => {
    const radar = findRadar();
    setHost(radar);
    if (radar) setHostSize({ x: Math.max(1, radar.clientWidth), y: Math.max(1, radar.clientHeight) });
    const retry = window.setTimeout(() => {
      const next = findRadar();
      setHost(next);
      if (next) setHostSize({ x: Math.max(1, next.clientWidth), y: Math.max(1, next.clientHeight) });
    }, 250);
    return () => window.clearTimeout(retry);
  }, []);

  useEffect(() => {
    if (!host) return;
    const update = () => setHostSize({ x: Math.max(1, host.clientWidth), y: Math.max(1, host.clientHeight) });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [host]);

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
      if (index === 5) setShowHeading((value) => !value);
      if (index === 6) setShowTrail((value) => !value);
    };
    document.addEventListener("click", onToolbarClick, true);
    return () => document.removeEventListener("click", onToolbarClick, true);
  }, []);

  useEffect(() => {
    const deselect = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pf24-traffic-target='true']")) return;
      if (target?.closest("[data-pf24-traffic-detail='true']")) return;
      setSelectedId(null);
      setDetailPosition(null);
    };
    document.addEventListener("click", deselect, true);
    return () => document.removeEventListener("click", deselect, true);
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !host) return;
      const rect = host.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left - drag.dx, 2, hostSize.x - DETAIL_WIDTH - 2);
      const y = clamp(event.clientY - rect.top - drag.dy, 2, hostSize.y - DETAIL_HEIGHT - 2);
      setDetailPosition({ x, y });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [host, hostSize.x, hostSize.y]);

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

  function selectTraffic(a: Traffic, event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setSelectedId(a.id);
    const point = pointFromPercent(hostSize, a.x, a.y);
    setDetailPosition({
      x: clamp(point.x + 38, 2, hostSize.x - DETAIL_WIDTH - 2),
      y: clamp(point.y + 70, 2, hostSize.y - DETAIL_HEIGHT - 2),
    });
  }

  function startDetailDrag(event: React.MouseEvent<HTMLDivElement>) {
    if (!detailPosition) return;
    event.stopPropagation();
    dragRef.current = {
      dx: event.clientX - (host?.getBoundingClientRect().left ?? 0) - detailPosition.x,
      dy: event.clientY - (host?.getBoundingClientRect().top ?? 0) - detailPosition.y,
    };
  }

  if (!host) return null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden" data-pf24-traffic-sim="true">
      <svg className="absolute inset-0 h-full w-full" width={hostSize.x} height={hostSize.y} viewBox={`0 0 ${hostSize.x} ${hostSize.y}`} preserveAspectRatio="none" aria-hidden="true">
        {traffic.map((a) => {
          const point = pointFromPercent(hostSize, a.x, a.y);
          const unit = headingUnit(a.heading);
          const vectorEnd = { x: point.x + unit.x * VECTOR_LENGTH_PX, y: point.y + unit.y * VECTOR_LENGTH_PX };
          return <g key={a.id}>
            {showTrail && Array.from({ length: TRAIL_DOTS }, (_, index) => {
              const distance = (index + 1) * TRAIL_SPACING_PX;
              return <circle
                key={`${a.id}-trail-${index}`}
                cx={point.x - unit.x * distance}
                cy={point.y - unit.y * distance}
                r="2.2"
                fill="#00d000"
                opacity={0.95 - index * 0.11}
              />;
            })}
            {showHeading && <line x1={point.x} y1={point.y} x2={vectorEnd.x} y2={vectorEnd.y} stroke="#00e000" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>}
          </g>;
        })}
      </svg>

      {traffic.map((a) => {
        const active = a.id === selectedId;
        const fl = flightLevel(a.altitude);
        const trend = trendSymbol(a.verticalRate);
        const point = pointFromPercent(hostSize, a.x, a.y);
        return <div key={a.id} className="absolute" style={{ left: point.x, top: point.y }}>
          <button
            type="button"
            data-pf24-traffic-target="true"
            onClick={(event) => selectTraffic(a, event)}
            className="pointer-events-auto absolute z-[10] -translate-x-1/2 -translate-y-1/2"
            style={{ width: TARGET_SIZE_PX, height: TARGET_SIZE_PX }}
            aria-label={`Seleccionar ${a.callsign}`}
          >
            <span className={`absolute inset-0 rotate-45 border ${active ? "border-[#00ff00]" : "border-[#00d800]"}`}/>
          </button>
          <div className="pointer-events-none absolute left-[17px] top-[15px] z-[9] w-[132px] whitespace-nowrap text-left font-mono text-[#00e000]">
            <div className="text-[9px] leading-[11px]">I</div>
            <div className="text-[13px] leading-[14px]">{a.callsign}</div>
            <div className="text-[12px] leading-[14px]">A{fl}{trend}&nbsp;&nbsp;{String(Math.round(a.groundSpeed)).padStart(3, "0")}</div>
            <div className="pl-[64px] text-[12px] leading-[13px]">{a.arrival}</div>
          </div>
        </div>;
      })}

      {selected && detailPosition && <div
        data-pf24-traffic-detail="true"
        onMouseDown={startDetailDrag}
        className="pointer-events-auto absolute z-[12] w-[190px] cursor-move select-none font-mono text-[12px] leading-[17px] text-[#00e000]"
        style={{ left: detailPosition.x, top: detailPosition.y }}
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
