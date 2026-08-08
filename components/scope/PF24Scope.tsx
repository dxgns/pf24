"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import type { ScopeFlightPlan, ScopeWindowKey, SimAircraft } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  controllerName: string;
};

type WindowPos = { x: number; y: number };
type WindowState = Record<ScopeWindowKey, { open: boolean; pos: WindowPos }>;

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  is_active: boolean;
};

const DEFAULT_WINDOWS: WindowState = {
  sector: { open: true, pos: { x: 18, y: 94 } },
  taxi: { open: true, pos: { x: 18, y: 344 } },
  holds: { open: true, pos: { x: 315, y: 94 } },
  timer: { open: true, pos: { x: 590, y: 94 } },
  metar: { open: true, pos: { x: 18, y: 540 } },
  atis: { open: false, pos: { x: 780, y: 94 } },
  atc: { open: true, pos: { x: 980, y: 94 } },
};

const SIM_SEED: SimAircraft[] = [
  {
    id: "sim-1",
    callsign: "LAN337",
    aircraftType: "A320",
    altitude: 5000,
    targetAltitude: 7000,
    heading: 315,
    targetHeading: 315,
    groundSpeed: 220,
    x: 48,
    y: 57,
    squawk: "4321",
    departure: "MDPC",
    arrival: "MDST",
  },
  {
    id: "sim-2",
    callsign: "IBE6421",
    aircraftType: "A320",
    altitude: 11000,
    targetAltitude: 11000,
    heading: 95,
    targetHeading: 95,
    groundSpeed: 280,
    x: 66,
    y: 39,
    squawk: "5162",
    departure: "GCLP",
    arrival: "LEMH",
  },
];

export default function PF24Scope({ initialPlans, controllerName }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("MDST_TWR");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(new Date());
  const [windows, setWindows] = useState<WindowState>(DEFAULT_WINDOWS);
  const [simEnabled, setSimEnabled] = useState(true);
  const [aircraft, setAircraft] = useState<SimAircraft[]>(SIM_SEED);
  const [selectedId, setSelectedId] = useState<string | null>(SIM_SEED[0].id);
  const [zoom, setZoom] = useState(1);
  const [command, setCommand] = useState("");
  const [consoleLines, setConsoleLines] = useState<string[]>([
    "PF24 Scope beta — modo simulación activo.",
    "Escribe .help para ver comandos disponibles.",
  ]);
  const [sessions, setSessions] = useState<ATCSession[]>([]);
  const [metarStation, setMetarStation] = useState("MDST");
  const [metarText, setMetarText] = useState("METAR no cargado. Usa .metar ICAO para seleccionar estación.");
  const dragRef = useRef<{ key: ScopeWindowKey; dx: number; dy: number } | null>(null);

  const frequency = ATC_FREQUENCIES[position] ?? "---.---";
  const selected = aircraft.find((item) => item.id === selectedId) ?? null;

  const taxiPlans = useMemo(
    () => plans.filter((p) => ["STUP", "PUSH", "TAXI_DEP", "TAXI_IN"].includes(p.sector_status)),
    [plans]
  );

  useEffect(() => {
    const stored = localStorage.getItem("pf24_scope_position");
    const storedWindows = localStorage.getItem("pf24_scope_windows");
    if (stored) setPosition(stored);
    if (storedWindows) {
      try {
        setWindows(JSON.parse(storedWindows) as WindowState);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pf24_scope_position", position);
  }, [position]);

  useEffect(() => {
    localStorage.setItem("pf24_scope_windows", JSON.stringify(windows));
  }, [windows]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      const { data } = await supabase.from("atc_sessions").select("*").eq("is_active", true);
      setSessions((data ?? []) as ATCSession[]);
    };
    loadSessions();

    const channel = supabase
      .channel("scope-atc-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_sessions" }, loadSessions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-flight-plans")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, (payload) => {
        const next = payload.new as ScopeFlightPlan;
        const old = payload.old as ScopeFlightPlan;
        if (payload.eventType === "INSERT" && next.status !== "FINISHED") {
          setPlans((current) => [next, ...current]);
        }
        if (payload.eventType === "UPDATE") {
          setPlans((current) => {
            if (next.status === "FINISHED") return current.filter((p) => p.id !== next.id);
            return current.some((p) => p.id === next.id)
              ? current.map((p) => (p.id === next.id ? next : p))
              : [next, ...current];
          });
        }
        if (payload.eventType === "DELETE") {
          setPlans((current) => current.filter((p) => p.id !== old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!simEnabled) return;
    const timer = window.setInterval(() => {
      setAircraft((current) =>
        current.map((a) => {
          const headingRad = (a.heading * Math.PI) / 180;
          let x = a.x + Math.sin(headingRad) * 0.045;
          let y = a.y - Math.cos(headingRad) * 0.045;
          if (x > 97) x = 3;
          if (x < 3) x = 97;
          if (y > 94) y = 6;
          if (y < 6) y = 94;
          const altStep = Math.sign(a.targetAltitude - a.altitude) * Math.min(100, Math.abs(a.targetAltitude - a.altitude));
          const hdgDiff = ((((a.targetHeading - a.heading) % 360) + 540) % 360) - 180;
          const hdgStep = Math.sign(hdgDiff) * Math.min(2, Math.abs(hdgDiff));
          return {
            ...a,
            x,
            y,
            altitude: a.altitude + altStep,
            heading: (a.heading + hdgStep + 360) % 360,
          };
        })
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [simEnabled]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setWindows((current) => ({
        ...current,
        [drag.key]: {
          ...current[drag.key],
          pos: { x: Math.max(0, event.clientX - drag.dx), y: Math.max(70, event.clientY - drag.dy) },
        },
      }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startDrag(key: ScopeWindowKey, event: React.MouseEvent<HTMLDivElement>) {
    const pos = windows[key].pos;
    dragRef.current = { key, dx: event.clientX - pos.x, dy: event.clientY - pos.y };
  }

  function toggleWindow(key: ScopeWindowKey) {
    setWindows((current) => ({ ...current, [key]: { ...current[key], open: !current[key].open } }));
  }

  function log(line: string) {
    setConsoleLines((current) => [...current.slice(-5), line]);
  }

  function executeCommand(raw: string) {
    const input = raw.trim();
    if (!input) return;
    log(`> ${input}`);
    const [cmd, ...args] = input.split(/\s+/);
    const upper = args.map((item) => item.toUpperCase());

    if (cmd === ".help") {
      log(".fpl CALLSIGN | .metar ICAO | .sim on/off | .hdg CALLSIGN 270 | .alt CALLSIGN 7000 | .clear");
    } else if (cmd === ".sim") {
      const enabled = upper[0] !== "OFF";
      setSimEnabled(enabled);
      log(`SIM ${enabled ? "ON" : "OFF"}`);
    } else if (cmd === ".fpl") {
      const callsign = upper[0];
      const plan = plans.find((p) => p.callsign.toUpperCase() === callsign);
      log(plan ? `${plan.callsign} ${plan.aircraft_type} ${plan.departure_icao}>${plan.arrival_icao} FL${plan.flight_level}` : "FPL no encontrado");
    } else if (cmd === ".metar") {
      const station = upper[0] || "MDST";
      setMetarStation(station);
      setMetarText(`${station} — estación seleccionada. Fuente METAR externa pendiente de integrar.`);
      setWindows((current) => ({ ...current, metar: { ...current.metar, open: true } }));
    } else if (cmd === ".hdg") {
      updateSimTarget(upper[0], "heading", Number(upper[1]));
    } else if (cmd === ".alt") {
      updateSimTarget(upper[0], "altitude", Number(upper[1]));
    } else if (cmd === ".clear") {
      setConsoleLines([]);
    } else {
      log("Comando desconocido. Usa .help");
    }
    setCommand("");
  }

  function updateSimTarget(callsign: string | undefined, field: "heading" | "altitude", value: number) {
    if (!callsign || Number.isNaN(value)) {
      log("Parámetros inválidos");
      return;
    }
    let found = false;
    setAircraft((current) => current.map((a) => {
      if (a.callsign.toUpperCase() !== callsign) return a;
      found = true;
      return field === "heading"
        ? { ...a, targetHeading: ((value % 360) + 360) % 360 }
        : { ...a, targetAltitude: Math.max(0, value) };
    }));
    log(found ? `${callsign} ${field === "heading" ? "HDG" : "ALT"} ${value}` : "Aeronave simulada no encontrada");
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#07120d] font-mono text-[12px] text-[#b8d3bc] select-none">
      <header className="absolute inset-x-0 top-0 z-50 border-b border-[#4d6955] bg-[#ced5cf] text-[#101713] shadow-lg">
        <div className="flex h-8 items-stretch">
          <button className="scopeTopButton">MENU</button>
          <button onClick={() => setConnected((v) => !v)} className={`scopeTopButton font-bold ${connected ? "bg-[#8fbf92]" : "bg-[#e1aaa4]"}`}>
            {connected ? "CONNECTED" : "CONNECT"}
          </button>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="border-r border-[#7b877e] bg-[#d9ded9] px-2 font-bold outline-none">
            {Object.keys(ATC_FREQUENCIES).map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="flex items-center border-r border-[#7b877e] px-3 font-bold">{frequency}</div>
          <div className="flex flex-1 items-center gap-1 px-2">
            {(["sector", "taxi", "holds", "metar", "atis", "atc"] as ScopeWindowKey[]).map((key) => (
              <button key={key} onClick={() => toggleWindow(key)} className="rounded-sm border border-[#7b877e] bg-[#eef1ee] px-2 py-0.5 uppercase hover:bg-white">{key}</button>
            ))}
          </div>
          <div className="flex items-center border-l border-[#7b877e] px-3 font-bold">{now.toISOString().slice(11, 19)}Z</div>
        </div>
        <div className="flex h-7 items-center gap-2 border-t border-[#9ca79e] bg-[#aeb9b0] px-2 text-[11px]">
          <span className="font-bold">PF24 SCOPE BETA</span>
          <span>CTRL: {controllerName}</span>
          <span>MODE: {simEnabled ? "SIM" : "DATA ONLY"}</span>
          <span className="ml-auto">ZOOM {Math.round(zoom * 100)}%</span>
        </div>
      </header>

      <section
        className="absolute inset-x-0 bottom-[116px] top-[57px] overflow-hidden"
        onWheel={(e) => setZoom((z) => Math.min(2.5, Math.max(0.55, z + (e.deltaY < 0 ? 0.08 : -0.08))))}
        style={{
          backgroundImage: "radial-gradient(circle, rgba(109,143,116,.23) 1px, transparent 1px)",
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
        }}
      >
        <div className="absolute left-1/2 top-1/2 h-[64vh] w-[64vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#496552]/40" />
        <div className="absolute left-1/2 top-1/2 h-[32vh] w-[32vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#496552]/30" />
        <div className="absolute left-1/2 top-0 h-full border-l border-[#496552]/25" />
        <div className="absolute left-0 top-1/2 w-full border-t border-[#496552]/25" />

        {simEnabled && aircraft.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedId(a.id)}
            className="absolute z-10 text-left text-[#b7e6bd]"
            style={{ left: `${a.x}%`, top: `${a.y}%`, transform: `scale(${Math.max(.85, Math.min(1.2, zoom))})` }}
          >
            <span className="absolute -left-1 -top-1 block h-2 w-2 rotate-45 border border-current bg-[#07120d]" />
            <span className={`ml-3 block border-l pl-2 leading-[13px] ${selectedId === a.id ? "bg-[#183520]/80 text-white" : ""}`}>
              <b>{a.callsign}</b> {a.squawk}<br />
              {String(Math.round(a.altitude / 100)).padStart(3, "0")} {a.altitude < a.targetAltitude ? "↑" : a.altitude > a.targetAltitude ? "↓" : "="} {a.groundSpeed}<br />
              H{String(Math.round(a.heading)).padStart(3, "0")} {a.aircraftType}
            </span>
          </button>
        ))}

        {windows.sector.open && <ScopeWindow title="SECTOR LIST" state={windows.sector} onMouseDown={(e) => startDrag("sector", e)} width={280}>
          <div className="max-h-44 overflow-auto">
            {plans.length === 0 ? <Muted text="Sin planes activos" /> : plans.slice(0, 12).map((p) => (
              <div key={p.id} className="grid grid-cols-[70px_46px_1fr_42px] border-b border-[#506653]/40 px-2 py-1 hover:bg-[#1a2c20]">
                <b className={p.transponder === "7700" ? "text-red-400" : "text-[#c8e2cc]"}>{p.callsign}</b>
                <span>{p.aircraft_type}</span>
                <span>{p.departure_icao}→{p.arrival_icao}</span>
                <span>{p.flight_level}</span>
              </div>
            ))}
          </div>
        </ScopeWindow>}

        {windows.taxi.open && <ScopeWindow title="COMBINED TAXI LIST" state={windows.taxi} onMouseDown={(e) => startDrag("taxi", e)} width={280}>
          {taxiPlans.length === 0 ? <Muted text="No traffic" /> : taxiPlans.slice(0, 8).map((p) => <div key={p.id} className="flex justify-between border-b border-[#506653]/40 px-2 py-1"><b>{p.callsign}</b><span>{p.sector_status}</span></div>)}
        </ScopeWindow>}

        {windows.holds.open && <ScopeWindow title="HOLD LIST" state={windows.holds} onMouseDown={(e) => startDrag("holds", e)} width={255}><Muted text="No aircraft holding" /></ScopeWindow>}
        {windows.timer.open && <ScopeWindow title="TIMER" state={windows.timer} onMouseDown={(e) => startDrag("timer", e)} width={170}><div className="p-3 text-center text-lg font-bold">{now.toISOString().slice(11, 19)}</div></ScopeWindow>}
        {windows.metar.open && <ScopeWindow title={`METAR — ${metarStation}`} state={windows.metar} onMouseDown={(e) => startDrag("metar", e)} width={420}><div className="p-2 leading-5">{metarText}</div></ScopeWindow>}
        {windows.atis.open && <ScopeWindow title="ATIS" state={windows.atis} onMouseDown={(e) => startDrag("atis", e)} width={320}><Muted text="Editor ATIS será conectado al sistema existente." /></ScopeWindow>}
        {windows.atc.open && <ScopeWindow title="ATC ONLINE" state={windows.atc} onMouseDown={(e) => startDrag("atc", e)} width={250}>
          {sessions.length === 0 ? <Muted text="No ATC online" /> : sessions.slice(0, 10).map((s) => <div key={s.id} className="flex justify-between border-b border-[#506653]/40 px-2 py-1"><span>{s.position}</span><span>{ATC_FREQUENCIES[s.position] ?? "---.---"}</span></div>)}
        </ScopeWindow>}

        {selected && (
          <div className="absolute bottom-3 right-3 z-20 w-64 border border-[#718b75] bg-[#101d14]/95 shadow-xl">
            <div className="bg-[#bfc9c0] px-2 py-1 font-bold text-[#101713]">TRACK DATA</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-2">
              <span>CALLSIGN</span><b>{selected.callsign}</b>
              <span>TYPE</span><b>{selected.aircraftType}</b>
              <span>ALT</span><b>{selected.altitude}</b>
              <span>HDG</span><b>{Math.round(selected.heading)}</b>
              <span>GS</span><b>{selected.groundSpeed}</b>
              <span>SQUAWK</span><b>{selected.squawk}</b>
              <span>ROUTE</span><b>{selected.departure}→{selected.arrival}</b>
            </div>
          </div>
        )}
      </section>

      <footer className="absolute inset-x-0 bottom-0 z-40 h-[116px] border-t border-[#607364] bg-[#09130d]">
        <div className="h-[78px] overflow-hidden px-3 py-2 text-[11px] leading-4 text-[#9fb8a4]">
          {consoleLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
        </div>
        <form className="flex h-[38px] border-t border-[#405244]" onSubmit={(e) => { e.preventDefault(); executeCommand(command); }}>
          <span className="flex items-center px-3 text-[#82a789]">COMMAND</span>
          <input autoFocus value={command} onChange={(e) => setCommand(e.target.value)} className="flex-1 bg-[#0d1a11] px-2 text-[#d5ead8] outline-none" placeholder=".help" />
          <button className="border-l border-[#405244] px-5 hover:bg-[#1b3020]">EXEC</button>
        </form>
      </footer>

      <style jsx global>{`
        .scopeTopButton { border-right: 1px solid #7b877e; padding: 0 11px; background: #d9ded9; }
        .scopeTopButton:hover { background: #f2f5f2; }
      `}</style>
    </main>
  );
}

function ScopeWindow({ title, state, onMouseDown, width, children }: { title: string; state: { pos: WindowPos }; onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void; width: number; children: React.ReactNode }) {
  return (
    <div className="absolute z-30 border border-[#6e8973] bg-[#0d1a11]/95 shadow-xl" style={{ left: state.pos.x, top: state.pos.y, width }}>
      <div onMouseDown={onMouseDown} className="cursor-move border-b border-[#6e8973] bg-[#c7cec8] px-2 py-1 font-bold tracking-wide text-[#111813]">{title}</div>
      <div className="min-h-10">{children}</div>
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return <div className="p-3 text-[#718977]">{text}</div>;
}
