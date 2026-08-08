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

type FacilityCode = "DEL" | "GND" | "TWR" | "APP" | "CTR";

type ConnectForm = {
  callsign: string;
  facility: FacilityCode | "";
  rating: string;
  server: string;
  password: string;
  discordName: string;
  robloxName: string;
  info4: string;
};

const AIRPORT_NAMES: Record<string, string> = {
  LCLK: "Larnaca",
  LCPH: "Paphos",
  LCRA: "Akrotiri",
  MDPC: "Punta Cana",
  MDST: "Santiago",
  MDAB: "Arroyo Barril",
  MDCR: "Cabo Rojo",
  MTCA: "Les Cayes",
  GCLP: "Gran Canaria",
  LEMH: "Menorca",
  EGKK: "Gatwick",
  EGHI: "Southampton",
  EFKT: "Kittilä",
};

const FACILITY_INFO: Record<FacilityCode, string> = {
  DEL: "AUTORIZACIONES/DELIVERY",
  GND: "SUPERFICIE/GROUND",
  TWR: "TORRE/TOWER",
  APP: "APROXIMACION/APPROACH",
  CTR: "CENTRO/CENTER",
};

const FACILITY_LABELS: Array<{ value: FacilityCode; label: string }> = [
  { value: "DEL", label: "Delivery" },
  { value: "GND", label: "Ground" },
  { value: "TWR", label: "Tower" },
  { value: "APP", label: "Approach" },
  { value: "CTR", label: "Center" },
];

const PDC_AIRPORTS = new Set(["MDPC", "LCLK", "GCLP", "LEMH", "EGKK"]);

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

const EMPTY_FORM: ConnectForm = {
  callsign: "",
  facility: "",
  rating: "",
  server: "",
  password: "",
  discordName: "",
  robloxName: "",
  info4: "",
};

function getAirportFromCallsign(callsign: string) {
  return callsign.trim().toUpperCase().split("_")[0] ?? "";
}

function makePosition(callsign: string, facility: FacilityCode | "") {
  const airport = getAirportFromCallsign(callsign);
  if (!airport || !facility) return "";
  return `${airport}_${facility}`;
}

export default function PF24Scope({ initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans);
  const [position, setPosition] = useState("");
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(new Date());
  const [simEnabled, setSimEnabled] = useState(true);
  const [aircraft, setAircraft] = useState<SimAircraft[]>(SIM_SEED);
  const [selectedId, setSelectedId] = useState<string | null>(SIM_SEED[0].id);
  const [command, setCommand] = useState("");
  const [consoleLines, setConsoleLines] = useState<string[]>(["129.800: Hola", "118.600: Hola ok"]);
  const [sessions, setSessions] = useState<ATCSession[]>([]);
  const [metarStation, setMetarStation] = useState("MDST");
  const [metarText, setMetarText] = useState("MDST 12003KT 01015");
  const [showChat, setShowChat] = useState(true);
  const [showClock, setShowClock] = useState(true);
  const [showHolds, setShowHolds] = useState(true);
  const [showMetar, setShowMetar] = useState(true);
  const [showAtis, setShowAtis] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [toolStates, setToolStates] = useState([false, false, false, false, false]);
  const [connectForm, setConnectForm] = useState<ConnectForm>(EMPTY_FORM);

  const frequency = position ? ATC_FREQUENCIES[position] ?? "---.---" : "---.---";
  const selected = aircraft.find((item) => item.id === selectedId) ?? null;
  const facilityShort = position.split("_").at(-1) ?? "";

  const activePlan = useMemo(
    () => plans.find((p) => p.callsign?.toUpperCase() === "LAN337") ?? plans[0] ?? null,
    [plans]
  );

  const taxiPlans = useMemo(
    () => plans.filter((p) => ["STUP", "PUSH", "TAXI_DEP", "TAXI_IN"].includes(p.sector_status)),
    [plans]
  );

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
        if (payload.eventType === "INSERT" && next.status !== "FINISHED") setPlans((current) => [next, ...current]);
        if (payload.eventType === "UPDATE") {
          setPlans((current) => {
            if (next.status === "FINISHED") return current.filter((p) => p.id !== next.id);
            return current.some((p) => p.id === next.id)
              ? current.map((p) => (p.id === next.id ? next : p))
              : [next, ...current];
          });
        }
        if (payload.eventType === "DELETE") setPlans((current) => current.filter((p) => p.id !== old.id));
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
    } catch {}
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
    if (cmd === ".help") log("118.600: .fpl .metar .sim .hdg .alt .clear");
    else if (cmd === ".sim") {
      const enabled = upper[0] !== "OFF";
      setSimEnabled(enabled);
      log(`118.600: SIM ${enabled ? "ON" : "OFF"}`);
    } else if (cmd === ".fpl") {
      const plan = plans.find((p) => p.callsign.toUpperCase() === upper[0]);
      log(plan ? `118.600: ${plan.callsign} ${plan.aircraft_type} ${plan.departure_icao}>${plan.arrival_icao} FL${plan.flight_level}` : "118.600: FPL no encontrado");
    } else if (cmd === ".metar") {
      const station = upper[0] || "MDST";
      setMetarStation(station);
      loadMetar(station);
      setShowMetar(true);
    } else if (cmd === ".hdg") {
      const value = Number(upper[1]);
      if (upper[0] && !Number.isNaN(value)) setAircraft((current) => current.map((a) => a.callsign.toUpperCase() === upper[0] ? { ...a, heading: value, targetHeading: value } : a));
    } else if (cmd === ".alt") {
      const value = Number(upper[1]);
      if (upper[0] && !Number.isNaN(value)) setAircraft((current) => current.map((a) => a.callsign.toUpperCase() === upper[0] ? { ...a, altitude: value, targetAltitude: value } : a));
    } else if (cmd === ".clear") setConsoleLines([]);
    setCommand("");
  }

  function openConnectDialog() {
    setConnectForm(EMPTY_FORM);
    setShowConnectDialog(true);
  }

  function confirmConnect() {
    const nextPosition = makePosition(connectForm.callsign, connectForm.facility);
    if (!nextPosition) return;
    setPosition(nextPosition);
    setConnected(true);
    setShowConnectDialog(false);
  }

  function disconnect() {
    setConnected(false);
    setPosition("");
    setShowConnectDialog(false);
    setConnectForm(EMPTY_FORM);
  }

  const utc = now.toISOString().slice(11, 19);
  const stripTime = utc.slice(0, 8);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#151515] font-mono text-[12px] text-[#b8c8c4] select-none">
      <header className="absolute inset-x-0 top-0 z-50 h-[44px] border-b border-[#2f3437]">
        <div className="flex h-[21px] items-stretch bg-[#06443c] text-[#d9e7e2]">
          <button className="topCell w-[28px] text-[8px]">MENU</button>
          <button onClick={openConnectDialog} className="topCell w-[48px] text-[10px]">CONNECT</button>
          <div className="topCell w-[133px] justify-start px-2 text-[10px]">{position ? `${position}  [${facilityShort}]` : ""}</div>
          <div className="topCell w-[78px] px-2 text-[10px]">{connected ? frequency : ""}</div>
          <button className="topCell w-[38px] leading-[8px] text-[7px]">OPEN<br />SCT</button>
          <div className="topCell w-[62px] px-2 text-[10px]">{stripTime}</div>
          <button className="topCell w-[40px] leading-[8px] text-[7px]">QUICK<br />SET</button>
          <button onClick={() => toggleTool(0)} className={`topCell w-[38px] ${toolStates[0] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={0} active={toolStates[0]} /></button>
          <button onClick={() => toggleTool(1)} className={`topCell w-[40px] ${toolStates[1] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={1} active={toolStates[1]} /></button>
          <button onClick={() => toggleTool(2)} className={`topCell w-[58px] ${toolStates[2] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={2} active={toolStates[2]} /></button>
          <button onClick={() => toggleTool(3)} className={`topCell w-[48px] ${toolStates[3] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={3} active={toolStates[3]} /></button>
          <button onClick={() => toggleTool(4)} className={`topCell w-[72px] ${toolStates[4] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={4} active={toolStates[4]} /></button>
          <div className="flex-1" />
          <button className="topCell w-[28px] text-[17px]">←</button>
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
        <Panel className="left-[8px] top-[50px] w-[462px]" title="SECTOR LIST">
          <div className="px-1 py-1 text-[9px]">
            <div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px] text-[#d0d3d2]"><span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span></div>
            <div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px] text-[#00ee00]"><span>{activePlan?.callsign ?? "LAN337"}</span><span>{activePlan?.aircraft_type ?? "A320"}</span><span>{activePlan?.flight_rules ?? "I"}</span><span>{activePlan?.departure_icao ?? "MDPC"}</span><span>{activePlan?.arrival_icao ?? "MDST"}</span><span>{activePlan?.flight_level ?? "050"}</span><span>11X</span><span className="truncate">PIXE6W-PIXE5-ILSZ-R11X</span><span>{activePlan?.transponder ?? "9999"}</span><span>XXX</span></div>
          </div>
        </Panel>

        <Panel className="left-[8px] top-[104px] w-[190px]" title="COMBINED TAXI LIST">
          <div className="px-1 py-1 text-[9px]">
            <div className="grid grid-cols-[50px_43px_35px_42px_1fr] text-[#d0d3d2]"><span>CALLSIGN</span><span>ATYP</span><span>STS</span><span>GATE</span><span>WRN</span></div>
            <div className="grid grid-cols-[50px_43px_35px_42px_1fr] text-[#00ee00]"><span>{taxiPlans[0]?.callsign ?? activePlan?.callsign ?? "LAN337"}</span><span>{taxiPlans[0]?.aircraft_type ?? activePlan?.aircraft_type ?? "A320"}</span><span>XXX</span><span>999X</span><span><span className="text-[#00ee00]">NORM</span><br /><span className="text-[#ff7a00]">PROB</span></span></div>
          </div>
        </Panel>

        {showClock && <div className="absolute left-[46%] top-[70px] w-[110px] border border-[#c9c9c9] bg-[#454b50] text-center text-[#f0f0f0]"><div className="border-b border-[#c9c9c9] text-[8px] tracking-[.25em]">TIMER</div><div className="py-2 text-[24px] leading-none">99:99:99</div></div>}
        {showHolds && <div className="absolute left-[54%] top-[58px] w-[144px] border border-[#c9c9c9] bg-[#555b60] text-[#dddddd]"><div className="border-b border-[#c9c9c9] text-center text-[8px]">HOLD LIST</div><div className="grid grid-cols-[1fr_32px_34px] border-b border-[#c9c9c9] text-center text-[8px]"><span>CALLSIGN</span><span>FL</span><span>AFL</span></div><div className="grid grid-cols-[1fr_32px_34px] text-center text-[9px] text-[#00ee00]"><span>LAN337</span><span>040</span><span>050</span></div><div className="h-[54px] border-t border-[#8c8c8c]" /></div>}

        <div className="absolute right-[10px] top-[48px] flex gap-3 text-[9px]"><div className="min-w-[134px]"><div className="flex justify-between bg-[#0b443b] px-1 text-[#a9d7ce]"><span>Freq</span><span>⌃×</span></div><div className="px-1 py-1 text-[#ffff00]">MDCS_CTR&nbsp;&nbsp;199.999</div></div>{showMetar && <div className="min-w-[161px]"><div className="flex justify-between bg-[#0b443b] px-1 text-[#a9d7ce]"><span>ATIS&nbsp;&nbsp;&nbsp;&nbsp;Metar</span><span>▢⌃×</span></div><div className="px-1 py-1 text-[#00f4ff]">X&nbsp;&nbsp;{metarStation}&nbsp;&nbsp;{metarText.replace(metarStation, "").trim()}</div></div>}</div>

        {simEnabled && aircraft.map((a) => <button key={a.id} onClick={() => setSelectedId(a.id)} className="absolute z-10 text-left text-[#00ee00]" style={{ left: `${a.x}%`, top: `${a.y}%` }}><span className="absolute -left-[12px] -top-[28px] text-[20px]">◇</span><span className="absolute -left-[35px] -top-[6px] tracking-[3px]">••••</span><span className="block leading-[13px]"><span className="text-[10px]">I</span><br /><b>{a.callsign}</b><br />A{String(Math.round(a.altitude / 100)).padStart(3, "0")}↓&nbsp;&nbsp;{a.groundSpeed}<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{a.arrival}</span></button>)}
        {selected && <div className="absolute right-[11px] top-[272px] w-[210px] text-[#00ee00]"><div className="text-[#ffff00]">A9999</div><div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div><div>050↓ VOGEP N250</div><div>060 080 {selected.arrival}</div><div>AHDG ASP TXT</div></div>}

        <div className="absolute bottom-[2px] left-[2px] text-[8px] leading-[9px]"><div className="text-[#d6d6d6]">LAN337</div><div className="text-[#00eaff]">129.800</div><div className="text-[#d6d6d6]">118.600</div></div>

        {showConnectDialog && <ConnectDialog form={connectForm} setForm={setConnectForm} connected={connected} onConnect={confirmConnect} onDisconnect={disconnect} onClose={() => setShowConnectDialog(false)} />}
      </section>

      {showChat && <footer className="absolute inset-x-0 bottom-0 z-40 h-[112px] bg-[#555c61] text-[9px]"><div className="h-[76px] overflow-hidden px-1 py-2 leading-[12px] text-[#d0d0d0]">{consoleLines.map((line, index) => <div key={`${line}-${index}`}><span className={line.startsWith("129.800") ? "text-[#00eaff]" : line.startsWith("118.600") ? "text-[#cfcfcf]" : ""}>{line}</span></div>)}</div><form className="flex h-[36px] items-center border-t border-[#777] bg-[#efefef] text-[#222]" onSubmit={(e) => { e.preventDefault(); executeCommand(command); }}><span className="pl-16 pr-1 text-[8px]">on 118.600</span><input value={command} onChange={(e) => setCommand(e.target.value)} className="h-[18px] w-[385px] bg-white px-1 outline-none" autoFocus /><div className="ml-1 text-[8px]">METAR&nbsp;&nbsp;MDST&nbsp;&nbsp;121800Z 11012KT 9999 FEW025 SCT080 22/14 Q1013</div></form></footer>}

      <style jsx global>{`
        .topCell { border-right: 1px solid #173d38; display: flex; align-items: center; justify-content: center; }
        .scopePanel { position: absolute; z-index: 20; color: #b7c4c1; }
        .scopePanelTitle { height: 12px; background: #0b443b; padding: 0 4px; font-size: 7px; line-height: 12px; color: #a9d7ce; }
        .connectBox { border: 1px solid #b7b7b7; background: #d8d8d8; box-shadow: inset 1px 1px #f8f8f8, inset -1px -1px #999; }
        .connectField { height: 20px; border: 1px solid #c0c0c0; background: #efefef; box-shadow: inset 1px 1px #fff; padding: 1px 5px; color: #151515; }
      `}</style>
    </main>
  );
}

function Panel({ className, title, children }: { className: string; title: string; children: React.ReactNode }) {
  return <div className={`scopePanel ${className}`}><div className="scopePanelTitle flex items-center justify-between"><span>{title}</span><span>⌃×</span></div>{children}</div>;
}

function ConnectDialog({ form, setForm, connected, onConnect, onDisconnect, onClose }: {
  form: ConnectForm;
  setForm: React.Dispatch<React.SetStateAction<ConnectForm>>;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const airport = getAirportFromCallsign(form.callsign);
  const airportName = AIRPORT_NAMES[airport] ?? "";
  const info1 = airportName && form.facility ? `${airportName} ${FACILITY_INFO[form.facility]}` : "";
  const info2 = airport ? "Visítanos en https://pf24.vercel.app/" : "";
  const info3 = airport ? (PDC_AIRPORTS.has(airport) ? `PDC/DCL ${airport}` : "PDC/DCL NO DISPONIBLE") : "";

  function patch<K extends keyof ConnectForm>(key: K, value: ConnectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="connectBox absolute left-1/2 top-[45%] z-40 w-[500px] -translate-x-1/2 -translate-y-1/2 p-[12px] text-[10px] text-[#202020]">
      <div className="mb-[8px] text-[9px]">Connect dialog</div>
      <div className="grid grid-cols-2 gap-[14px]">
        <fieldset className="border border-[#b8b8b8] px-[9px] pb-[10px] pt-[6px]">
          <legend className="px-[3px] text-[10px] font-bold tracking-[.03em]">SERVER</legend>
          <TextRow label="Callsign" value={form.callsign} onChange={(v) => patch("callsign", v.toUpperCase())} maxLength={20} />
          <SelectRow label="Facility" value={form.facility} onChange={(v) => patch("facility", v as FacilityCode)} options={FACILITY_LABELS} />
          <TextRow label="Rating" value={form.rating} onChange={(v) => patch("rating", v)} maxLength={20} />
          <TextRow label="Server" value={form.server} onChange={(v) => patch("server", v)} maxLength={20} />
        </fieldset>
        <fieldset className="border border-[#b8b8b8] px-[9px] pb-[10px] pt-[6px]">
          <legend className="px-[3px] text-[10px] font-bold tracking-[.03em]">PROFILE</legend>
          <TextRow label="Password" value={form.password} onChange={(v) => patch("password", v)} maxLength={20} type="password" />
          <TextRow label="DISCORD name" value={form.discordName} onChange={(v) => patch("discordName", v)} maxLength={20} />
          <TextRow label="ROBLOX name" value={form.robloxName} onChange={(v) => patch("robloxName", v)} maxLength={20} />
        </fieldset>
      </div>
      <fieldset className="mt-[7px] border border-[#b8b8b8] px-[9px] pb-[10px] pt-[6px]">
        <legend className="px-[3px] text-[10px] font-bold tracking-[.03em]">INFORMATION</legend>
        <StaticRow label="INFO line 1" value={info1} />
        <StaticRow label="INFO line 2" value={info2} />
        <StaticRow label="INFO line 3" value={info3} />
        <TextRow label="INFO line 4" value={form.info4} onChange={(v) => patch("info4", v)} maxLength={20} wide />
      </fieldset>
      <div className="mt-[10px] flex items-center justify-between">
        <div className="flex gap-[5px]">
          <button onClick={onConnect} disabled={!form.callsign || !form.facility} className="min-w-[64px] border border-[#b4b4b4] bg-[#ececec] px-3 py-[2px] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#999] disabled:text-[#aaa]">Connect</button>
          <button onClick={onDisconnect} disabled={!connected} className="min-w-[78px] border border-[#b4b4b4] bg-[#ececec] px-3 py-[2px] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#999] disabled:bg-[#d4d4d4] disabled:text-[#aaa]">Disconnect</button>
        </div>
        <button onClick={onClose} className="min-w-[58px] border border-[#b4b4b4] bg-[#ececec] px-3 py-[2px] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#999]">Close</button>
      </div>
    </div>
  );
}

function TextRow({ label, value, onChange, maxLength, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; type?: string; wide?: boolean }) {
  return <div className={`mb-[4px] grid items-center gap-[6px] ${wide ? "grid-cols-[82px_1fr]" : "grid-cols-[72px_1fr]"}`}><span>{label}</span><input type={type} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className="connectField w-full outline-none" /></div>;
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return <div className="mb-[4px] grid grid-cols-[82px_1fr] items-center gap-[6px]"><span>{label}</span><div className="connectField truncate">{value}</div></div>;
}

function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <div className="mb-[4px] grid grid-cols-[72px_1fr] items-center gap-[6px]"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="connectField w-full outline-none"><option value=""></option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

function ToolbarGlyph({ index, active }: { index: number; active: boolean }) {
  const stroke = active ? "#ffffff" : "#cfe1dc";
  if (index === 0) return <svg width="28" height="19" viewBox="0 0 28 19" aria-hidden="true"><rect x="3" y="8" width="9" height="8" fill="none" stroke={stroke} strokeWidth="1" /><line x1="11" y1="8" x2="20" y2="2" stroke={stroke} strokeWidth="1" /><rect x="19" y="1" width="4" height="4" fill="none" stroke={stroke} strokeWidth="1" /></svg>;
  if (index === 1) return <svg width="30" height="19" viewBox="0 0 30 19" aria-hidden="true"><rect x="3" y="2" width="12" height="14" fill="none" stroke={stroke} strokeWidth="1" /><line x1="16" y1="14" x2="24" y2="5" stroke={stroke} strokeWidth="1" strokeDasharray="2 2" /><circle cx="25" cy="4" r="1.5" fill="none" stroke={stroke} strokeWidth="1" /></svg>;
  if (index === 2) return <span style={{ color: stroke }} className="text-[7px] leading-[7px]">TRANS<br />LVL&nbsp;&nbsp;040</span>;
  if (index === 3) return <svg width="28" height="19" viewBox="0 0 28 19" aria-hidden="true"><path d="M5 3 H22 L16 9 V15 H11 V9 Z" fill="none" stroke={stroke} strokeWidth="1" /><rect x="21" y="1" width="4" height="4" fill="none" stroke={stroke} strokeWidth="1" /></svg>;
  return <svg width="58" height="19" viewBox="0 0 58 19" aria-hidden="true"><line x1="6" y1="15" x2="20" y2="3" stroke={stroke} strokeWidth="1" /><rect x="4" y="13" width="4" height="4" fill="none" stroke={stroke} strokeWidth="1" /><rect x="19" y="1" width="4" height="4" fill="none" stroke={stroke} strokeWidth="1" /><circle cx="35" cy="5" r="1.5" fill={stroke} /><circle cx="43" cy="5" r="1.5" fill={stroke} /><circle cx="35" cy="13" r="1.5" fill={stroke} /><rect x="41" y="10" width="5" height="5" fill="none" stroke={stroke} strokeWidth="1" /><line x1="35" y1="5" x2="43" y2="5" stroke={stroke} strokeWidth="0.8" /><line x1="35" y1="5" x2="35" y2="13" stroke={stroke} strokeWidth="0.8" /></svg>;
}
