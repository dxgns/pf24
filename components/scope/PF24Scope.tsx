"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import type { ScopeFlightPlan, SimAircraft } from "@/lib/scope/types";

type Props = { initialPlans: ScopeFlightPlan[]; controllerName: string };
type ATCSession = { id: string; controller_name: string; position: string; is_active: boolean };
type FacilityCode = "DEL" | "GND" | "TWR" | "APP" | "CTR";
type WindowKey = "sector" | "taxi" | "timer" | "holds" | "freq" | "metar";
type WindowState = { x: number; y: number; open: boolean; collapsed: boolean };
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
  LCLK: "Larnaca", LCPH: "Paphos", LCRA: "Akrotiri", MDPC: "Punta Cana", MDST: "Santiago",
  MDAB: "Arroyo Barril", MDCR: "Cabo Rojo", MTCA: "Les Cayes", GCLP: "Gran Canaria",
  LEMH: "Menorca", EGKK: "Gatwick", EGHI: "Southampton", EFKT: "Kittilä",
};

const FACILITY_INFO: Record<FacilityCode, string> = {
  DEL: "AUTORIZACIONES/DELIVERY",
  GND: "SUPERFICIE/GROUND",
  TWR: "TORRE/TOWER",
  APP: "APROXIMACION/APPROACH",
  CTR: "CENTRO/CENTER",
};

const FACILITY_LABELS: Array<{ value: FacilityCode; label: string }> = [
  { value: "DEL", label: "Delivery" }, { value: "GND", label: "Ground" }, { value: "TWR", label: "Tower" },
  { value: "APP", label: "Approach" }, { value: "CTR", label: "Center" },
];

const PDC_AIRPORTS = new Set(["MDPC", "LCLK", "GCLP", "LEMH", "EGKK"]);
const EMPTY_FORM: ConnectForm = { callsign: "", facility: "", rating: "", server: "", password: "", discordName: "", robloxName: "", info4: "" };

const DEFAULT_WINDOWS: Record<WindowKey, WindowState> = {
  sector: { x: 8, y: 58, open: true, collapsed: false },
  taxi: { x: 8, y: 132, open: true, collapsed: false },
  timer: { x: 760, y: 78, open: true, collapsed: false },
  holds: { x: 900, y: 68, open: true, collapsed: false },
  freq: { x: 1398, y: 64, open: true, collapsed: false },
  metar: { x: 1530, y: 64, open: true, collapsed: false },
};

const SIM_SEED: SimAircraft[] = [{ id: "sim-1", callsign: "LAN337", aircraftType: "A320", altitude: 5000, targetAltitude: 5000, heading: 180, targetHeading: 180, groundSpeed: 180, x: 73, y: 39, squawk: "9999", departure: "MDPC", arrival: "MDST" }];

function getAirportFromCallsign(callsign: string) { return callsign.trim().toUpperCase().split("_")[0] ?? ""; }
function makePosition(callsign: string, facility: FacilityCode | "") {
  const airport = getAirportFromCallsign(callsign);
  return airport && facility ? `${airport}_${facility}` : "";
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
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [toolStates, setToolStates] = useState([false, false, false, false, false]);
  const [connectForm, setConnectForm] = useState<ConnectForm>(EMPTY_FORM);
  const [windows, setWindows] = useState<Record<WindowKey, WindowState>>(DEFAULT_WINDOWS);
  const dragRef = useRef<{ key: WindowKey; dx: number; dy: number } | null>(null);

  const frequency = position ? ATC_FREQUENCIES[position] ?? "---.---" : "---.---";
  const selected = aircraft.find((item) => item.id === selectedId) ?? null;
  const facilityShort = position.split("_").at(-1) ?? "";
  const activePlan = useMemo(() => plans.find((p) => p.callsign?.toUpperCase() === "LAN337") ?? plans[0] ?? null, [plans]);
  const taxiPlans = useMemo(() => plans.filter((p) => ["STUP", "PUSH", "TAXI_DEP", "TAXI_IN"].includes(p.sector_status)), [plans]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("pf24_scope_window_layout_v2");
    if (stored) { try { setWindows({ ...DEFAULT_WINDOWS, ...JSON.parse(stored) }); } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem("pf24_scope_window_layout_v2", JSON.stringify(windows)); }, [windows]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { key, dx, dy } = dragRef.current;
      setWindows((cur) => ({ ...cur, [key]: { ...cur[key], x: Math.max(0, e.clientX - dx), y: Math.max(45, e.clientY - dy) } }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      const { data } = await supabase.from("atc_sessions").select("*").eq("is_active", true);
      setSessions((data ?? []) as ATCSession[]);
    };
    loadSessions();
    const channel = supabase.channel("scope-atc-sessions-ui").on("postgres_changes", { event: "*", schema: "public", table: "atc_sessions" }, loadSessions).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const channel = supabase.channel("scope-flight-plans-ui").on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, (payload) => {
      const next = payload.new as ScopeFlightPlan; const old = payload.old as ScopeFlightPlan;
      if (payload.eventType === "INSERT" && next.status !== "FINISHED") setPlans((c) => [next, ...c]);
      if (payload.eventType === "UPDATE") setPlans((c) => next.status === "FINISHED" ? c.filter((p) => p.id !== next.id) : c.some((p) => p.id === next.id) ? c.map((p) => p.id === next.id ? next : p) : [next, ...c]);
      if (payload.eventType === "DELETE") setPlans((c) => c.filter((p) => p.id !== old.id));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!simEnabled) return;
    const timer = window.setInterval(() => setAircraft((current) => current.map((a) => {
      const r = (a.heading * Math.PI) / 180; let x = a.x + Math.sin(r) * 0.018; let y = a.y - Math.cos(r) * 0.018;
      if (x > 95) x = 5; if (x < 5) x = 95; if (y > 88) y = 8; if (y < 8) y = 88; return { ...a, x, y };
    })), 1000);
    return () => window.clearInterval(timer);
  }, [simEnabled]);

  async function loadMetar(station: string) {
    try { const r = await fetch(`/api/scope/metar?station=${encodeURIComponent(station)}`); const d = await r.json() as { raw?: string | null }; if (d.raw) setMetarText(d.raw); } catch {}
  }

  function executeCommand(raw: string) {
    const input = raw.trim(); if (!input) return;
    setConsoleLines((c) => [...c.slice(-5), `118.600: ${input}`]);
    const [cmd, ...args] = input.split(/\s+/); const upper = args.map((a) => a.toUpperCase());
    if (cmd === ".help") setConsoleLines((c) => [...c.slice(-5), "118.600: .fpl .metar .sim .hdg .alt .clear"]);
    else if (cmd === ".sim") setSimEnabled(upper[0] !== "OFF");
    else if (cmd === ".metar") { const s = upper[0] || "MDST"; setMetarStation(s); loadMetar(s); }
    else if (cmd === ".clear") setConsoleLines([]);
    setCommand("");
  }

  function startDrag(key: WindowKey, e: React.MouseEvent) {
    const w = windows[key]; dragRef.current = { key, dx: e.clientX - w.x, dy: e.clientY - w.y };
  }
  function closeWindow(key: WindowKey) { setWindows((c) => ({ ...c, [key]: { ...c[key], open: false } })); }
  function collapseWindow(key: WindowKey) { setWindows((c) => ({ ...c, [key]: { ...c[key], collapsed: !c[key].collapsed } })); }
  function resetWindow(key: WindowKey) { setWindows((c) => ({ ...c, [key]: { ...DEFAULT_WINDOWS[key], open: true } })); }

  function openConnectDialog() { setConnectForm(EMPTY_FORM); setShowConnectDialog(true); }
  function confirmConnect() {
    const next = makePosition(connectForm.callsign, connectForm.facility); if (!next) return;
    setPosition(next); setConnected(true); setShowConnectDialog(false);
  }
  function disconnect() { setConnected(false); setPosition(""); setShowConnectDialog(false); setConnectForm(EMPTY_FORM); }

  const stripTime = now.toISOString().slice(11, 19);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#151515] font-mono text-[#d8d8d8] select-none">
      <header className="absolute inset-x-0 top-0 z-50 h-[99px] border-b border-[#202426]">
        <div className="flex h-[47px] items-stretch bg-[#064a40] text-[#e0e0e0]">
          <button className="topCell w-[50px] text-[12px] leading-[13px]"><span><span className="block border border-[#cde5df] px-[3px] text-[8px] leading-[8px]">+ - + -</span>MENU</span></button>
          <button onClick={openConnectDialog} className="topCell w-[95px] text-[20px]">CONNECT</button>
          <div className="topCell w-[280px] justify-start px-3 text-[20px]">{position ? `${position}  [${facilityShort}]` : ""}</div>
          <div className="topCell w-[122px] px-3 text-[20px]">{connected ? frequency : ""}</div>
          <div className="topGap w-[49px]" />
          <button className="topCell w-[52px] text-[10px] leading-[13px]">OPEN<br />SCT</button>
          <div className="topCell w-[118px] px-2 text-[22px]">{stripTime}</div>
          <div className="topGap w-[48px]" />
          <button className="topCell w-[54px] text-[10px] leading-[13px]">QUICK<br />SET</button>
          <button onClick={() => setToolStates((c) => c.map((v,i) => i===0?!v:v))} className={`topCell w-[48px] ${toolStates[0] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={0} active={toolStates[0]} /></button>
          <div className="topGap w-[49px]" />
          <button onClick={() => setToolStates((c) => c.map((v,i) => i===1?!v:v))} className={`topCell w-[50px] ${toolStates[1] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={1} active={toolStates[1]} /></button>
          <button onClick={() => setToolStates((c) => c.map((v,i) => i===2?!v:v))} className={`topCell w-[52px] ${toolStates[2] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={2} active={toolStates[2]} /></button>
          <button onClick={() => setToolStates((c) => c.map((v,i) => i===3?!v:v))} className={`topCell w-[116px] ${toolStates[3] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={3} active={toolStates[3]} /></button>
          <div className="topGap w-[54px]" />
          <button onClick={() => setToolStates((c) => c.map((v,i) => i===4?!v:v))} className={`topCell w-[96px] ${toolStates[4] ? "bg-[#0a5b50]" : ""}`}><ToolbarGlyph index={4} active={toolStates[4]} /></button>
          <div className="flex-1" />
        </div>
        <div className="flex h-[52px] items-start bg-[#555c61] px-[53px] pt-[8px] text-[19px] text-[#dedede]">
          <span className="mr-[28px]">{stripTime}</span>
          <button onClick={() => setShowChat((v) => !v)} className="mr-[22px]">CHATBOX</button>
          <button onClick={() => setWindows((c) => ({...c,timer:{...c.timer,open:true}}))} className="mr-[22px]">CLOCK</button>
          <button onClick={() => setWindows((c) => ({...c,holds:{...c.holds,open:true}}))} className="mr-[22px]">HOLDS</button>
          <button onClick={() => setWindows((c) => ({...c,metar:{...c.metar,open:true}}))} className="mr-[22px]">METAR</button>
          <button>ATIS</button>
        </div>
      </header>

      <section className="absolute inset-x-0 bottom-[112px] top-[99px] overflow-hidden bg-[#151515]">
        {windows.sector.open && <FloatingWindow windowKey="sector" state={windows.sector} title="SECTOR LIST" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[930px]">
          <div className="px-[8px] py-[5px] text-[20px] leading-[29px]">
            <div className="grid grid-cols-[180px_105px_65px_90px_90px_75px_95px_1fr_110px_70px]"><span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span></div>
            <div className="grid grid-cols-[180px_105px_65px_90px_90px_75px_95px_1fr_110px_70px] text-[#00e000]"><span>{activePlan?.callsign ?? "LAN337"}</span><span>{activePlan?.aircraft_type ?? "A320"}</span><span>{activePlan?.flight_rules ?? "I"}</span><span>{activePlan?.departure_icao ?? "MDPC"}</span><span>{activePlan?.arrival_icao ?? "MDST"}</span><span>{activePlan?.flight_level ?? "050"}</span><span>11X</span><span>PIXE6W-PIXE5-ILSZ-R11X</span><span>{activePlan?.transponder ?? "9999"}</span><span>XXX</span></div>
          </div>
        </FloatingWindow>}

        {windows.taxi.open && <FloatingWindow windowKey="taxi" state={windows.taxi} title="COMBINED TAXI LIST" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[620px]">
          <div className="px-[8px] py-[5px] text-[20px] leading-[28px]">
            <div className="grid grid-cols-[180px_110px_95px_125px_1fr]"><span>CALLSIGN</span><span>ATYP</span><span>STS</span><span>GATE</span><span>WRN</span></div>
            <div className="grid grid-cols-[180px_110px_95px_125px_1fr] text-[#00e000]"><span>{taxiPlans[0]?.callsign ?? activePlan?.callsign ?? "LAN337"}</span><span>{taxiPlans[0]?.aircraft_type ?? activePlan?.aircraft_type ?? "A320"}</span><span>XXX</span><span>999X</span><span>NORM<br/><span className="text-[#ff6a00]">PROB</span></span></div>
          </div>
        </FloatingWindow>}

        {windows.timer.open && <FloatingWindow windowKey="timer" state={windows.timer} title="TIMER" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[112px]" simple><div className="border border-[#c8c8c8] bg-[#4b5156] py-2 text-center text-[26px] text-white">99:99:99</div></FloatingWindow>}

        {windows.holds.open && <FloatingWindow windowKey="holds" state={windows.holds} title="HOLD LIST" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[145px]" simple><div className="border border-[#c8c8c8] bg-[#565c60] text-[9px]"><div className="grid grid-cols-[1fr_32px_34px] border-b border-[#c8c8c8] text-center"><span>CALLSIGN</span><span>FL</span><span>AFL</span></div><div className="grid grid-cols-[1fr_32px_34px] text-center text-[#00e000]"><span>LAN337</span><span>040</span><span>050</span></div><div className="h-[54px]"/></div></FloatingWindow>}

        {windows.freq.open && <FloatingWindow windowKey="freq" state={windows.freq} title="Freq" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[245px]"><div className="px-[14px] py-[12px] text-[28px] text-[#ffff00]">MDCS_CTR&nbsp;&nbsp;199.999</div></FloatingWindow>}

        {windows.metar.open && <FloatingWindow windowKey="metar" state={windows.metar} title="ATIS             Metars" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[580px]"><div className="px-[28px] py-[10px] text-[30px] text-[#00efff]">X&nbsp;&nbsp;{metarStation}&nbsp;&nbsp;{metarText.replace(metarStation, "").trim()}</div></FloatingWindow>}

        {simEnabled && aircraft.map((a) => <button key={a.id} onClick={() => setSelectedId(a.id)} className="absolute z-10 text-left text-[#00ee00]" style={{ left: `${a.x}%`, top: `${a.y}%` }}><span className="absolute -left-[12px] -top-[28px] text-[20px]">◇</span><span className="absolute -left-[35px] -top-[6px] tracking-[3px]">••••</span><span className="block leading-[13px]"><span className="text-[10px]">I</span><br/><b>{a.callsign}</b><br/>A{String(Math.round(a.altitude/100)).padStart(3,"0")}↓&nbsp;&nbsp;{a.groundSpeed}<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{a.arrival}</span></button>)}
        {selected && <div className="absolute right-[11px] top-[272px] w-[210px] text-[#00ee00]"><div className="text-[#ffff00]">A9999</div><div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div><div>050↓ VOGEP N250</div><div>060 080 {selected.arrival}</div><div>AHDG ASP TXT</div></div>}
        <div className="absolute bottom-[2px] left-[2px] text-[8px] leading-[9px]"><div>LAN337</div><div className="text-[#00eaff]">129.800</div><div>118.600</div></div>
        {showConnectDialog && <ConnectDialog form={connectForm} setForm={setConnectForm} connected={connected} onConnect={confirmConnect} onDisconnect={disconnect} onClose={() => setShowConnectDialog(false)} />}
      </section>

      {showChat && <footer className="absolute inset-x-0 bottom-0 z-40 h-[112px] bg-[#555c61] text-[9px]"><div className="h-[76px] overflow-hidden px-1 py-2 leading-[12px]">{consoleLines.map((line,index)=><div key={`${line}-${index}`}>{line}</div>)}</div><form className="flex h-[36px] items-center border-t border-[#777] bg-[#efefef] text-[#222]" onSubmit={(e)=>{e.preventDefault();executeCommand(command);}}><span className="pl-16 pr-1 text-[8px]">on 118.600</span><input value={command} onChange={(e)=>setCommand(e.target.value)} className="h-[18px] w-[385px] bg-white px-1 outline-none"/><div className="ml-1 text-[8px]">METAR&nbsp;&nbsp;MDST&nbsp;&nbsp;121800Z 11012KT 9999 FEW025 SCT080 22/14 Q1013</div></form></footer>}

      <style jsx global>{`
        .topCell{border-right:1px solid #173d38;display:flex;align-items:center;justify-content:center}.topGap{border-right:1px solid #173d38}.connectBox{border:1px solid #b7b7b7;background:#d8d8d8;box-shadow:inset 1px 1px #f8f8f8,inset -1px -1px #999}.connectField{height:20px;border:1px solid #c0c0c0;background:#efefef;box-shadow:inset 1px 1px #fff;padding:1px 5px;color:#151515}
      `}</style>
    </main>
  );
}

function FloatingWindow({ windowKey, state, title, children, onDrag, onClose, onCollapse, onReset, className="", simple=false }: {
  windowKey: WindowKey; state: WindowState; title: string; children: React.ReactNode; className?: string; simple?: boolean;
  onDrag: (key: WindowKey, e: React.MouseEvent) => void; onClose: (key: WindowKey) => void; onCollapse: (key: WindowKey) => void; onReset: (key: WindowKey) => void;
}) {
  return <div className={`absolute z-30 ${className}`} style={{ left: state.x, top: state.y }}>
    <div onMouseDown={(e)=>onDrag(windowKey,e)} className={`flex h-[28px] cursor-move items-center bg-[#064a40] text-[#dedede] ${simple ? "justify-center text-[10px]" : "text-[18px]"}`}>
      <div className="flex-1 text-center tracking-[1px]">{title}</div>
      {!simple && <div className="flex h-full">
        <button onMouseDown={(e)=>e.stopPropagation()} onClick={()=>onReset(windowKey)} title="Posición inicial" className="windowIcon"><ListIcon/></button>
        <button onMouseDown={(e)=>e.stopPropagation()} onClick={()=>onCollapse(windowKey)} title="Ocultar/mostrar información" className="windowIcon"><CollapseIcon collapsed={state.collapsed}/></button>
        <button onMouseDown={(e)=>e.stopPropagation()} onClick={()=>onClose(windowKey)} title="Cerrar" className="windowIcon"><CloseIcon/></button>
      </div>}
    </div>
    {!state.collapsed && children}
  </div>;
}

function ListIcon(){return <svg width="21" height="21" viewBox="0 0 21 21"><rect x="4" y="4" width="13" height="13" fill="none" stroke="#d8e4e1"/><line x1="6" y1="7" x2="15" y2="7" stroke="#d8e4e1"/><line x1="6" y1="10.5" x2="15" y2="10.5" stroke="#d8e4e1"/><line x1="6" y1="14" x2="15" y2="14" stroke="#d8e4e1"/></svg>}
function CollapseIcon({collapsed}:{collapsed:boolean}){return <svg width="23" height="21" viewBox="0 0 23 21"><path d={collapsed?"M4 7 L11.5 14 L19 7":"M4 14 L11.5 7 L19 14"} fill="none" stroke="#d8e4e1" strokeWidth="1.2"/></svg>}
function CloseIcon(){return <svg width="23" height="21" viewBox="0 0 23 21"><line x1="5" y1="4" x2="18" y2="17" stroke="#d8e4e1"/><line x1="18" y1="4" x2="5" y2="17" stroke="#d8e4e1"/></svg>}

function ConnectDialog({ form, setForm, connected, onConnect, onDisconnect, onClose }: { form: ConnectForm; setForm: React.Dispatch<React.SetStateAction<ConnectForm>>; connected: boolean; onConnect:()=>void; onDisconnect:()=>void; onClose:()=>void }) {
  const airport=getAirportFromCallsign(form.callsign); const airportName=AIRPORT_NAMES[airport]??"";
  const info1=airportName&&form.facility?`${airportName} ${FACILITY_INFO[form.facility]}`:"";
  const info2=airport?"Visítanos en https://pf24.vercel.app/":"";
  const info3=airport?(PDC_AIRPORTS.has(airport)?`PDC/DCL ${airport}`:"PDC/DCL NO DISPONIBLE"):"";
  const patch=<K extends keyof ConnectForm>(key:K,value:ConnectForm[K])=>setForm((c)=>({...c,[key]:value}));
  return <div className="connectBox absolute left-1/2 top-[45%] z-50 w-[500px] -translate-x-1/2 -translate-y-1/2 p-[12px] text-[10px] text-[#202020]">
    <div className="mb-2">Connect dialog</div><div className="grid grid-cols-2 gap-[14px]">
      <fieldset className="border border-[#b8b8b8] p-2"><legend>SERVER</legend><TextRow label="Callsign" value={form.callsign} onChange={(v)=>patch("callsign",v.toUpperCase())}/><SelectRow label="Facility" value={form.facility} onChange={(v)=>patch("facility",v as FacilityCode)}/><TextRow label="Rating" value={form.rating} onChange={(v)=>patch("rating",v)}/><TextRow label="Server" value={form.server} onChange={(v)=>patch("server",v)}/></fieldset>
      <fieldset className="border border-[#b8b8b8] p-2"><legend>PROFILE</legend><TextRow label="Password" value={form.password} onChange={(v)=>patch("password",v)} type="password"/><TextRow label="DISCORD name" value={form.discordName} onChange={(v)=>patch("discordName",v)}/><TextRow label="ROBLOX name" value={form.robloxName} onChange={(v)=>patch("robloxName",v)}/></fieldset>
    </div>
    <fieldset className="mt-2 border border-[#b8b8b8] p-2"><legend>INFORMATION</legend><StaticRow label="INFO line 1" value={info1}/><StaticRow label="INFO line 2" value={info2}/><StaticRow label="INFO line 3" value={info3}/><TextRow label="INFO line 4" value={form.info4} onChange={(v)=>patch("info4",v)} wide/></fieldset>
    <div className="mt-3 flex justify-between"><div className="flex gap-1"><button onClick={onConnect} disabled={!form.callsign||!form.facility} className="border bg-[#ececec] px-3 py-1 disabled:text-gray-400">Connect</button><button onClick={onDisconnect} disabled={!connected} className="border bg-[#ececec] px-3 py-1 disabled:text-gray-400">Disconnect</button></div><button onClick={onClose} className="border bg-[#ececec] px-3 py-1">Close</button></div>
  </div>;
}

function TextRow({label,value,onChange,type="text",wide=false}:{label:string;value:string;onChange:(v:string)=>void;type?:string;wide?:boolean}){return <div className={`mb-1 grid items-center gap-1 ${wide?"grid-cols-[82px_1fr]":"grid-cols-[72px_1fr]"}`}><span>{label}</span><input type={type} value={value} maxLength={20} onChange={(e)=>onChange(e.target.value)} className="connectField w-full outline-none"/></div>}
function StaticRow({label,value}:{label:string;value:string}){return <div className="mb-1 grid grid-cols-[82px_1fr] items-center gap-1"><span>{label}</span><div className="connectField truncate">{value}</div></div>}
function SelectRow({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <div className="mb-1 grid grid-cols-[72px_1fr] items-center gap-1"><span>{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="connectField w-full outline-none"><option value=""></option>{FACILITY_LABELS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>}

function ToolbarGlyph({index,active}:{index:number;active:boolean}){
  const s=active?"#fff":"#cfe1dc";
  if(index===0)return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="11" y="9" width="15" height="22" fill="none" stroke={s}/><line x1="14" y1="28" x2="23" y2="28" stroke={s}/><line x1="14" y1="25" x2="21" y2="25" stroke={s}/></svg>;
  if(index===1)return <svg width="43" height="40" viewBox="0 0 43 40"><rect x="8" y="23" width="14" height="12" fill="none" stroke={s}/><line x1="23" y1="23" x2="36" y2="7" stroke={s}/><circle cx="36" cy="6" r="1.5" fill={s}/><circle cx="29" cy="17" r="1" fill={s}/><circle cx="34" cy="28" r="1" fill={s}/></svg>;
  if(index===2)return <svg width="48" height="40" viewBox="0 0 48 40"><rect x="18" y="5" width="16" height="16" fill="none" stroke={s}/><circle cx="11" cy="32" r="1" fill={s}/><circle cx="21" cy="32" r="1" fill={s}/><circle cx="31" cy="32" r="1" fill={s}/></svg>;
  if(index===3)return <span style={{color:s}} className="flex w-full items-center justify-center text-[11px] leading-[12px]"><span>TRANS<br/>LVL</span><span className="ml-4 text-[20px]">040</span></span>;
  return <svg width="90" height="40" viewBox="0 0 90 40"><path d="M10 9 H29 L23 17 V28 H17 V17 Z" fill="none" stroke={s}/><text x="33" y="9" fontSize="8" fill={s}>FL</text><line x1="48" y1="31" x2="65" y2="8" stroke={s}/><polygon points="47,31 52,29 49,25" fill="#f2cb8d"/><rect x="64" y="6" width="6" height="6" fill="none" stroke={s}/><circle cx="76" cy="8" r="2" fill={s}/><circle cx="84" cy="8" r="2" fill={s}/><rect x="80" y="27" width="7" height="7" fill="none" stroke={s}/><circle cx="76" cy="31" r="2" fill={s}/></svg>;
}
