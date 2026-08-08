"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import type { ScopeFlightPlan, SimAircraft } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  controllerName: string;
};

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  is_active: boolean;
};

const SIM_SEED: SimAircraft[] = [
  {
    id: "sim-1",
    callsign: "LAN337",
    aircraftType: "A320",
    altitude: 5000,
    targetAltitude: 5000,
    heading: 180,
    targetHeading: 180,
    groundSpeed: 180,
    x: 73,
    y: 39,
    squawk: "9999",
    departure: "MDPC",
    arrival: "MDST",
  },
];

export default function PF24Scope({ initialPlans, controllerName }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("MDST_TWR");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(new Date());
  const [simEnabled, setSimEnabled] = useState(true);
  const [aircraft, setAircraft] = useState<SimAircraft[]>(SIM_SEED);
  const [selectedId, setSelectedId] = useState<string | null>(SIM_SEED[0].id);
  const [command, setCommand] = useState("");
  const [consoleLines, setConsoleLines] = useState<string[]>([
    "129.800: Hola",
    "118.600: Hola ok",
  ]);
  const [sessions, setSessions] = useState<ATCSession[]>([]);
  const [metarStation, setMetarStation] = useState("MDST");
  const [metarText, setMetarText] = useState("MDST 12003KT 01015");
  const [showChat, setShowChat] = useState(true);
  const [showClock, setShowClock] = useState(true);
  const [showHolds, setShowHolds] = useState(true);
  const [showMetar, setShowMetar] = useState(true);
  const [showAtis, setShowAtis] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [toolStates, setToolStates] = useState([false, false, false, false, false, false]);

  const frequency = ATC_FREQUENCIES[position] ?? "199.998";
  const selected = aircraft.find((item) => item.id === selectedId) ?? null;

  const activePlan = useMemo(() => {
    return plans.find((p) => p.callsign?.toUpperCase() === "LAN337") ?? plans[0] ?? null;
  }, [plans]);

  const taxiPlans = useMemo(
    () => plans.filter((p) => ["STUP", "PUSH", "TAXI_DEP", "TAXI_IN"].includes(p.sector_status)),
    [plans]
  );

  useEffect(() => {
    const stored = localStorage.getItem("pf24_scope_position");
    if (stored) setPosition(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("pf24_scope_position", position);
  }, [position]);

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
      .channel("scope-atc-sessions-ui")
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_sessions" }, loadSessions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("scope-flight-plans-ui")
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
          let x = a.x + Math.sin(headingRad) * 0.018;
          let y = a.y - Math.cos(headingRad) * 0.018;
          if (x > 95) x = 5;
          if (x < 5) x = 95;
          if (y > 88) y = 8;
          if (y < 8) y = 88;
          return { ...a, x, y };
        })
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [simEnabled]);

  async function loadMetar(station: string) {
    try {
      const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(station)}`);
      const data = (await response.json()) as { raw?: string | null };
      if (data.raw) setMetarText(data.raw);
    } catch {
      // Keep the last known METAR text.
    }
  }

  function toggleTool(index: number) {
    setToolStates((current) => current.map((value, i) => (i === index ? !value : value)));
  }

  function log(line: string) {
    setConsoleLines((current) => [...current.slice(-5), line]);
  }

  function executeCommand(raw: string) {
    const input = raw.trim();
    if (!input) return;
    log(`118.600: ${input}`);
    const [cmd, ...args] = input.split(/\s+/);
    const upper = args.map((item) => item.toUpperCase());

    if (cmd === ".help") {
      log("118.600: .fpl .metar .sim .hdg .alt .clear");
    } else if (cmd === ".sim") {
      const enabled = upper[0] !== "OFF";
      setSimEnabled(enabled);
      log(`118.600: SIM ${enabled ? "ON" : "OFF"}`);
    } else if (cmd === ".fpl") {
      const callsign = upper[0];
      const plan = plans.find((p) => p.callsign.toUpperCase() === callsign);
      log(
        plan
          ? `118.600: ${plan.callsign} ${plan.aircraft_type} ${plan.departure_icao}>${plan.arrival_icao} FL${plan.flight_level}`
          : "118.600: FPL no encontrado"
      );
    } else if (cmd === ".metar") {
      const station = upper[0] || "MDST";
      setMetarStation(station);
      loadMetar(station);
      setShowMetar(true);
    } else if (cmd === ".hdg") {
      const callsign = upper[0];
      const value = Number(upper[1]);
      if (callsign && !Number.isNaN(value)) {
        setAircraft((current) =>
          current.map((a) =>
            a.callsign.toUpperCase() === callsign ? { ...a, heading: value, targetHeading: value } : a
          )
        );
      }
    } else if (cmd === ".alt") {
      const callsign = upper[0];
      const value = Number(upper[1]);
      if (callsign && !Number.isNaN(value)) {
        setAircraft((current) =>
          current.map((a) =>
            a.callsign.toUpperCase() === callsign ? { ...a, altitude: value, targetAltitude: value } : a
          )
        );
      }
    } else if (cmd === ".clear") {
      setConsoleLines([]);
    }
    setCommand("");
  }

  const utc = now.toISOString().slice(11, 19);
  const stripTime = utc.slice(0, 8);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#151515] font-mono text-[12px] text-[#b8c8c4] select-none">
      <header className="absolute inset-x-0 top-0 z-50 h-[44px] border-b border-[#2f3437]">
        <div className="flex h-[21px] items-stretch bg-[#06443c] text-[#d9e7e2]">
          <button className="topCell px-1.5 text-[9px]">MENU</button>
          <button
            onClick={() => setShowConnectDialog(true)}
            className="topCell px-2 text-[12px]"
          >
            CONNECT
          </button>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="topCell bg-transparent px-2 text-[11px] outline-none"
          >
            {Object.keys(ATC_FREQUENCIES).map((item) => (
              <option key={item} className="bg-[#06443c]">{item}</option>
            ))}
          </select>
          <div className="topCell px-2">[{position.split("_").at(-1) ?? "TWR"}]</div>
          <div className="topCell px-3">{frequency}</div>
          <button className="topCell w-[44px] leading-[9px] text-[8px]">OPEN<br />SCT</button>
          <div className="topCell px-2 text-[12px]">{stripTime}</div>
          <button className="topCell w-[46px] leading-[9px] text-[8px]">QUICK<br />SET</button>
          {toolStates.map((active, index) => (
            <button
              key={index}
              onClick={() => toggleTool(index)}
              className={`topCell relative w-[49px] ${active ? "bg-[#0a5b50]" : ""}`}
              aria-label={`toolbar ${index + 1}`}
            >
              <ToolbarGlyph index={index} active={active} />
            </button>
          ))}
          <div className="flex-1" />
          <button className="topCell w-[30px] text-[18px]">←</button>
        </div>

        <div className="flex h-[23px] items-center bg-[#555c61] px-3 text-[10px] text-[#dedede]">
          <span className="mr-4">{stripTime}</span>
          <button onClick={() => setShowChat((v) => !v)} className="mr-4 hover:text-white">CHATBOX</button>
          <button onClick={() => setShowClock((v) => !v)} className="mr-4 hover:text-white">CLOCK</button>
          <button onClick={() => setShowHolds((v) => !v)} className="mr-4 hover:text-white">HOLDS</button>
          <button onClick={() => setShowMetar((v) => !v)} className="mr-4 hover:text-white">METAR</button>
          <button onClick={() => setShowAtis((v) => !v)} className="hover:text-white">ATIS</button>
        </div>
      </header>

      <section className="absolute inset-x-0 bottom-[112px] top-[44px] overflow-hidden bg-[#151515]">
        <button
          onClick={() => setConnected((v) => !v)}
          className="absolute left-[8px] top-[14px] z-20 border border-[#427b70] bg-[#0d1c19] px-1 py-1 text-[8px] text-[#b9d9d1]"
        >
          {connected ? "DISCONNECT" : "CONNECT"}
        </button>

        <Panel className="left-[8px] top-[50px] w-[462px]" title="SECTOR LIST">
          <div className="px-1 py-1 text-[9px]">
            <div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px] text-[#d0d3d2]">
              <span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span>
            </div>
            <div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px] text-[#00ee00]">
              <span>{activePlan?.callsign ?? "LAN337"}</span>
              <span>{activePlan?.aircraft_type ?? "A320"}</span>
              <span>{activePlan?.flight_rules ?? "I"}</span>
              <span>{activePlan?.departure_icao ?? "MDPC"}</span>
              <span>{activePlan?.arrival_icao ?? "MDST"}</span>
              <span>{activePlan?.flight_level ?? "050"}</span>
              <span>11X</span>
              <span className="truncate">PIXE6W-PIXE5-ILSZ-R11X</span>
              <span>{activePlan?.transponder ?? "9999"}</span>
              <span>XXX</span>
            </div>
          </div>
        </Panel>

        <Panel className="left-[8px] top-[104px] w-[190px]" title="COMBINED TAXI LIST">
          <div className="px-1 py-1 text-[9px]">
            <div className="grid grid-cols-[50px_43px_35px_42px_1fr] text-[#d0d3d2]">
              <span>CALLSIGN</span><span>ATYP</span><span>STS</span><span>GATE</span><span>WRN</span>
            </div>
            <div className="grid grid-cols-[50px_43px_35px_42px_1fr] text-[#00ee00]">
              <span>{taxiPlans[0]?.callsign ?? activePlan?.callsign ?? "LAN337"}</span>
              <span>{taxiPlans[0]?.aircraft_type ?? activePlan?.aircraft_type ?? "A320"}</span>
              <span>XXX</span><span>999X</span><span><span className="text-[#00ee00]">NORM</span><br /><span className="text-[#ff7a00]">PROB</span></span>
            </div>
          </div>
        </Panel>

        {showClock && (
          <div className="absolute left-[46%] top-[70px] w-[110px] border border-[#c9c9c9] bg-[#454b50] text-center text-[#f0f0f0]">
            <div className="border-b border-[#c9c9c9] text-[8px] tracking-[.25em]">TIMER</div>
            <div className="py-2 text-[24px] leading-none">99:99:99</div>
          </div>
        )}

        {showHolds && (
          <div className="absolute left-[54%] top-[58px] w-[144px] border border-[#c9c9c9] bg-[#555b60] text-[#dddddd]">
            <div className="border-b border-[#c9c9c9] text-center text-[8px]">HOLD LIST</div>
            <div className="grid grid-cols-[1fr_32px_34px] border-b border-[#c9c9c9] text-center text-[8px]"><span>CALLSIGN</span><span>FL</span><span>AFL</span></div>
            <div className="grid grid-cols-[1fr_32px_34px] text-center text-[9px] text-[#00ee00]"><span>LAN337</span><span>040</span><span>050</span></div>
            <div className="h-[54px] border-t border-[#8c8c8c] bg-[linear-gradient(to_bottom,transparent_15px,#8c8c8c_16px,transparent_17px)] bg-[length:100%_16px]" />
          </div>
        )}

        <div className="absolute right-[10px] top-[48px] flex gap-3 text-[9px]">
          <div className="min-w-[134px]">
            <div className="flex justify-between bg-[#0b443b] px-1 text-[#a9d7ce]"><span>Freq</span><span>⌃×</span></div>
            <div className="px-1 py-1 text-[#ffff00]">MDCS_CTR&nbsp;&nbsp;199.999</div>
          </div>
          {showMetar && (
            <div className="min-w-[161px]">
              <div className="flex justify-between bg-[#0b443b] px-1 text-[#a9d7ce]"><span>ATIS&nbsp;&nbsp;&nbsp;&nbsp;Metar</span><span>▢⌃×</span></div>
              <div className="px-1 py-1 text-[#00f4ff]">X&nbsp;&nbsp;{metarStation}&nbsp;&nbsp;{metarText.replace(metarStation, "").trim()}</div>
            </div>
          )}
        </div>

        {simEnabled && aircraft.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedId(a.id)}
            className="absolute z-10 text-left text-[#00ee00]"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          >
            <span className="absolute -left-[12px] -top-[28px] text-[20px]">◇</span>
            <span className="absolute -left-[35px] -top-[6px] tracking-[3px]">••••</span>
            <span className="block leading-[13px]">
              <span className="text-[10px]">I</span><br />
              <b>{a.callsign}</b><br />
              A{String(Math.round(a.altitude / 100)).padStart(3, "0")}↓&nbsp;&nbsp;{a.groundSpeed}<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{a.arrival}
            </span>
          </button>
        ))}

        {selected && (
          <div className="absolute right-[11px] top-[272px] w-[210px] text-[#00ee00]">
            <div className="text-[#ffff00]">A9999</div>
            <div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div>
            <div>050↓ VOGEP N250</div>
            <div>060 080 {selected.arrival}</div>
            <div>AHDG ASP TXT</div>
          </div>
        )}

        <div className="absolute bottom-[2px] left-[2px] text-[8px] leading-[9px]">
          <div className="text-[#d6d6d6]">LAN337</div>
          <div className="text-[#00eaff]">129.800</div>
          <div className="text-[#d6d6d6]">118.600</div>
        </div>

        {showConnectDialog && (
          <div className="absolute left-1/2 top-[44%] z-40 w-[400px] -translate-x-1/2 -translate-y-1/2 border border-[#c8c8c8] bg-[#d7d7d7] p-2 text-[9px] text-[#222] shadow-2xl">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-2 font-bold">SERVER</div>
                <DialogRow label="Callsign" value={position} />
                <DialogRow label="Facility" value="TOWER" />
                <DialogRow label="Rating" value="S2" />
                <DialogRow label="Server" value="AUTOMATIC" />
              </div>
              <div>
                <div className="mb-2 font-bold">PROFILE</div>
                <DialogRow label="Password" value="ATC 1275621" />
                <DialogRow label="DISCORD name" value={controllerName.slice(0, 16)} />
                <DialogRow label="ROBLOX name" value="PF24" />
              </div>
            </div>
            <div className="mt-2 border-t border-[#b4b4b4] pt-2">
              <div className="font-bold">INFORMATION</div>
              <DialogRow label="INFO line 1" value="SANTIAGO TORRE/TOWER" />
              <DialogRow label="INFO line 2" value="Visítanos en https://pf24.vercel.app/" />
              <DialogRow label="INFO line 3" value="PDC/DCL MDST     PDC/DCL NO DISPONIBLE" />
            </div>
            <div className="mt-3 flex justify-between">
              <button onClick={() => { setConnected(true); setShowConnectDialog(false); }} className="border border-[#b4b4b4] bg-[#ececec] px-3 py-1">Connect</button>
              <button onClick={() => setShowConnectDialog(false)} className="border border-[#b4b4b4] bg-[#ececec] px-3 py-1">Close</button>
            </div>
          </div>
        )}
      </section>

      {showChat && (
        <footer className="absolute inset-x-0 bottom-0 z-40 h-[112px] bg-[#555c61] text-[9px]">
          <div className="h-[76px] overflow-hidden px-1 py-2 leading-[12px] text-[#d0d0d0]">
            {consoleLines.map((line, index) => (
              <div key={`${line}-${index}`} className={line.startsWith("129.800") || line.startsWith("118.600") ? "" : ""}>
                <span className={line.startsWith("129.800") ? "text-[#00eaff]" : line.startsWith("118.600") ? "text-[#cfcfcf]" : ""}>{line}</span>
              </div>
            ))}
          </div>
          <form
            className="flex h-[36px] items-center border-t border-[#777] bg-[#efefef] text-[#222]"
            onSubmit={(e) => { e.preventDefault(); executeCommand(command); }}
          >
            <span className="pl-16 pr-1 text-[8px]">on 118.600</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="h-[18px] w-[385px] bg-white px-1 outline-none"
              autoFocus
            />
            <div className="ml-1 text-[8px]">METAR&nbsp;&nbsp;MDST&nbsp;&nbsp;121800Z 11012KT 9999 FEW025 SCT080 22/14 Q1013</div>
          </form>
        </footer>
      )}

      <style jsx global>{`
        .topCell { border-right: 1px solid #173d38; display: flex; align-items: center; justify-content: center; }
        .scopePanel { position: absolute; z-index: 20; color: #b7c4c1; }
        .scopePanelTitle { height: 12px; background: #0b443b; padding: 0 4px; font-size: 7px; line-height: 12px; color: #a9d7ce; }
      `}</style>
    </main>
  );
}

function Panel({ className, title, children }: { className: string; title: string; children: React.ReactNode }) {
  return (
    <div className={`scopePanel ${className}`}>
      <div className="scopePanelTitle flex items-center justify-between"><span>{title}</span><span>⌃×</span></div>
      {children}
    </div>
  );
}

function DialogRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1 grid grid-cols-[72px_1fr] items-center gap-1">
      <span>{label}</span>
      <div className="border border-[#c8c8c8] bg-[#efefef] px-1 py-[1px]">{value}</div>
    </div>
  );
}

function ToolbarGlyph({ index, active }: { index: number; active: boolean }) {
  const c = active ? "#ffffff" : "#cfe1dc";
  if (index === 0) return <span style={{ color: c }} className="text-[15px]">□↗</span>;
  if (index === 1) return <span style={{ color: c }} className="text-[17px]">□⌟</span>;
  if (index === 2) return <span style={{ color: c }} className="text-[16px]">□◌</span>;
  if (index === 3) return <span style={{ color: c }} className="text-[8px] leading-[8px]">TRANS<br />LVL&nbsp;040</span>;
  if (index === 4) return <span style={{ color: c }} className="text-[16px]">▽</span>;
  return <span style={{ color: c }} className="text-[15px]">⌁□⌁</span>;
}