"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES, ATC_SECTOR_NAMES } from "@/lib/atcFrequencies";
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
type StoredProfile = Pick<ConnectForm, "password" | "discordName" | "robloxName">;

const AIRPORT_NAMES: Record<string, string> = {
  LCLK: "Larnaca", LCPH: "Paphos", LCRA: "Akrotiri", MDPC: "Punta Cana", MDST: "Santiago",
  MDAB: "Arroyo Barril", MDCR: "Cabo Rojo", MTCA: "Les Cayes", GCLP: "Gran Canaria",
  LEMH: "Menorca", EGKK: "Gatwick", EGHI: "Southampton", EFKT: "Kittilä",
};
const FACILITY_INFO: Record<FacilityCode, string> = {
  DEL: "AUTORIZACIONES/DELIVERY", GND: "SUPERFICIE/GROUND", TWR: "TORRE/TOWER",
  APP: "APROXIMACION/APPROACH", CTR: "CENTRO/CENTER",
};
const FACILITY_LABELS: Array<{ value: FacilityCode; label: string }> = [
  { value: "DEL", label: "Delivery" }, { value: "GND", label: "Ground" }, { value: "TWR", label: "Tower" },
  { value: "APP", label: "Approach" }, { value: "CTR", label: "Center" },
];
const CALLSIGN_OPTIONS = Object.keys(ATC_FREQUENCIES).sort();
const PDC_AIRPORTS = new Set(["MDPC", "LCLK", "GCLP", "LEMH", "EGKK"]);
const PROFILE_STORAGE_KEY = "pf24_scope_profile_v1";
const EMPTY_FORM: ConnectForm = { callsign: "", facility: "", rating: "", server: "AUTOMATIC", password: "", discordName: "", robloxName: "", info4: "" };
const DEFAULT_WINDOWS: Record<WindowKey, WindowState> = {
  sector: { x: 8, y: 50, open: true, collapsed: false }, taxi: { x: 8, y: 104, open: true, collapsed: false },
  timer: { x: 700, y: 70, open: true, collapsed: false }, holds: { x: 825, y: 58, open: true, collapsed: false },
  freq: { x: 1120, y: 48, open: true, collapsed: false }, metar: { x: 1265, y: 48, open: true, collapsed: false },
};
const SIM_SEED: SimAircraft[] = [{ id: "sim-1", callsign: "LAN337", aircraftType: "A320", altitude: 5000, targetAltitude: 5000, heading: 180, targetHeading: 180, groundSpeed: 180, x: 73, y: 39, squawk: "9999", departure: "MDPC", arrival: "MDST" }];

function getAirportFromCallsign(callsign: string) { return callsign.trim().toUpperCase().split("_")[0] ?? ""; }
function callsignMatchesFacility(callsign: string, facility: FacilityCode | "") {
  const normalized = callsign.trim().toUpperCase();
  return Boolean(normalized && facility && normalized.endsWith(`_${facility}`));
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
  const [showMenu, setShowMenu] = useState(false);
  const [showScopeConfig, setShowScopeConfig] = useState(false);
  const [scopeZoom, setScopeZoom] = useState(100);
  const [toolStates, setToolStates] = useState([false, false, false, false, false, false]);
  const [connectForm, setConnectForm] = useState<ConnectForm>(EMPTY_FORM);
  const [windows, setWindows] = useState<Record<WindowKey, WindowState>>(DEFAULT_WINDOWS);
  const dragRef = useRef<{ key: WindowKey; dx: number; dy: number } | null>(null);

  const frequency = position ? ATC_FREQUENCIES[position] ?? "---.---" : "---.---";
  const selected = aircraft.find((item) => item.id === selectedId) ?? null;
  const facilityShort = position.split("_").at(-1) ?? "";
  const activePlan = useMemo(() => plans.find((p) => p.callsign?.toUpperCase() === "LAN337") ?? plans[0] ?? null, [plans]);
  const taxiPlans = useMemo(() => plans.filter((p) => ["STUP", "PUSH", "TAXI_DEP", "TAXI_IN"].includes(p.sector_status)), [plans]);

  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    const stored = localStorage.getItem("pf24_scope_window_layout_v3");
    if (stored) { try { setWindows({ ...DEFAULT_WINDOWS, ...JSON.parse(stored) }); } catch {} }
    const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (storedProfile) { try {
      const p = JSON.parse(storedProfile) as Partial<StoredProfile>;
      setConnectForm((c) => ({ ...c, password: typeof p.password === "string" ? p.password : "", discordName: typeof p.discordName === "string" ? p.discordName : "", robloxName: typeof p.robloxName === "string" ? p.robloxName : "" }));
    } catch {} }
  }, []);
  useEffect(() => { localStorage.setItem("pf24_scope_window_layout_v3", JSON.stringify(windows)); }, [windows]);
  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ password: connectForm.password, discordName: connectForm.discordName, robloxName: connectForm.robloxName }));
  }, [connectForm.password, connectForm.discordName, connectForm.robloxName]);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { key, dx, dy } = dragRef.current;
      setWindows((cur) => ({ ...cur, [key]: { ...cur[key], x: Math.max(0, e.clientX - dx), y: Math.max(44, e.clientY - dy) } }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  useEffect(() => {
    const load = async () => { const { data } = await supabase.from("atc_sessions").select("*").eq("is_active", true); setSessions((data ?? []) as ATCSession[]); };
    load(); const ch = supabase.channel("scope-atc-sessions-ui").on("postgres_changes", { event: "*", schema: "public", table: "atc_sessions" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  useEffect(() => {
    const ch = supabase.channel("scope-flight-plans-ui").on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, (payload) => {
      const next = payload.new as ScopeFlightPlan; const old = payload.old as ScopeFlightPlan;
      if (payload.eventType === "INSERT" && next.status !== "FINISHED") setPlans((c) => [next, ...c]);
      if (payload.eventType === "UPDATE") setPlans((c) => next.status === "FINISHED" ? c.filter((p) => p.id !== next.id) : c.some((p) => p.id === next.id) ? c.map((p) => p.id === next.id ? next : p) : [next, ...c]);
      if (payload.eventType === "DELETE") setPlans((c) => c.filter((p) => p.id !== old.id));
    }).subscribe(); return () => { supabase.removeChannel(ch); };
  }, []);
  useEffect(() => {
    if (!simEnabled) return;
    const t = window.setInterval(() => setAircraft((current) => current.map((a) => {
      const r = a.heading * Math.PI / 180; let x = a.x + Math.sin(r) * .018; let y = a.y - Math.cos(r) * .018;
      if (x > 95) x = 5; if (x < 5) x = 95; if (y > 88) y = 8; if (y < 8) y = 88; return { ...a, x, y };
    })), 1000); return () => window.clearInterval(t);
  }, [simEnabled]);

  async function loadMetar(station: string) { try { const r = await fetch(`/api/scope/metar?station=${encodeURIComponent(station)}`); const d = await r.json() as { raw?: string | null }; if (d.raw) setMetarText(d.raw); } catch {} }
  function executeCommand(raw: string) {
    const input = raw.trim(); if (!input) return;
    setConsoleLines((c) => [...c.slice(-5), `118.600: ${input}`]);
    const [cmd, ...args] = input.split(/\s+/); const upper = args.map((a) => a.toUpperCase());
    if (cmd === ".help") setConsoleLines((c) => [...c.slice(-5), "118.600: .fpl .metar .sim .hdg .alt .clear"]);
    else if (cmd === ".sim") setSimEnabled(upper[0] !== "OFF");
    else if (cmd === ".metar") { const s = upper[0] || "MDST"; setMetarStation(s); loadMetar(s); }
    else if (cmd === ".clear") setConsoleLines([]); setCommand("");
  }
  function startDrag(key: WindowKey, e: React.MouseEvent) { const w = windows[key]; dragRef.current = { key, dx: e.clientX - w.x, dy: e.clientY - w.y }; }
  function closeWindow(key: WindowKey) { setWindows((c) => ({ ...c, [key]: { ...c[key], open: false } })); }
  function collapseWindow(key: WindowKey) { setWindows((c) => ({ ...c, [key]: { ...c[key], collapsed: !c[key].collapsed } })); }
  function resetWindow(key: WindowKey) { setWindows((c) => ({ ...c, [key]: { ...DEFAULT_WINDOWS[key], open: true } })); }
  function confirmConnect() {
    const callsign = connectForm.callsign.trim().toUpperCase();
    if (!ATC_FREQUENCIES[callsign] || !callsignMatchesFacility(callsign, connectForm.facility)) return;
    setPosition(callsign); setConnected(true); setShowConnectDialog(false);
  }
  function disconnect() { setConnected(false); setPosition(""); setShowConnectDialog(false); }
  function toggleTool(index: number) { setToolStates((c) => c.map((v, i) => i === index ? !v : v)); }

  const stripTime = now.toISOString().slice(11, 19);
  return <main className="fixed inset-0 overflow-hidden bg-[#151515] font-mono text-[12px] text-[#d8d8d8] select-none">
    <header className="absolute inset-x-0 top-0 z-50 h-[44px] border-b border-[#202426]">
      <div className="flex h-[21px] items-stretch bg-[#064a40] text-[#e2e2e2]">
        <button onClick={() => setShowMenu((v) => !v)} className="scopeTopCell w-[26px] text-[7px] leading-[7px]"><span className="flex h-full flex-col items-center justify-center"><MenuGlyph/><span className="mt-[1px]">MENU</span></span></button>
        <button onClick={() => setShowConnectDialog(true)} className={`scopeTopCell w-[48px] text-[10px] ${connected ? "scopeConnected" : ""}`}>{connected ? "DISCONNECT" : "CONNECT"}</button>
        <div className="scopeTopCell w-[116px] justify-start px-[5px] text-[10px] tracking-[.3px]">{position ? `${position}  [${facilityShort}]` : ""}</div>
        <div className="scopeTopCell w-[52px] text-[10px] tracking-[.5px]">{connected ? frequency : ""}</div>
        <div className="scopeTopGap w-[21px]" />
        <button className="scopeTopCell w-[24px] text-[6px] leading-[6px]">OPEN<br/>SCT</button>
        <div className="scopeTopCell w-[52px] text-[10px] tracking-[.3px]">{stripTime}</div>
        <div className="scopeTopGap w-[21px]" />
        <button className="scopeTopCell w-[24px] text-[6px] leading-[6px]">QUICK<br/>SET</button>
        <button onClick={() => toggleTool(0)} className={`scopeTopCell w-[25px] ${toolStates[0] ? "scopeToolOn" : ""}`}><ToolbarGlyph kind="screen" active={toolStates[0]}/></button>
        <div className="scopeTopGap w-[21px]" />
        <button onClick={() => toggleTool(1)} className={`scopeTopCell w-[25px] ${toolStates[1] ? "scopeToolOn" : ""}`}><ToolbarGlyph kind="vector" active={toolStates[1]}/></button>
        <button onClick={() => toggleTool(2)} className={`scopeTopCell w-[25px] ${toolStates[2] ? "scopeToolOn" : ""}`}><ToolbarGlyph kind="dots" active={toolStates[2]}/></button>
        <button onClick={() => toggleTool(3)} className={`scopeTopCell w-[58px] ${toolStates[3] ? "scopeToolOn" : ""}`}><div className="flex w-full items-center justify-center"><span className="text-[6px] leading-[6px]">TRANS<br/>LVL</span><span className="ml-[8px] text-[11px]">040</span></div></button>
        <div className="scopeTopGap w-[22px]" />
        <button onClick={() => toggleTool(4)} className={`scopeTopCell w-[48px] ${toolStates[4] ? "scopeToolOn" : ""}`}><ToolbarGlyph kind="filter" active={toolStates[4]}/></button>
        <button onClick={() => toggleTool(5)} className={`scopeTopCell w-[50px] ${toolStates[5] ? "scopeToolOn" : ""}`}><ToolbarGlyph kind="route" active={toolStates[5]}/></button>
        <div className="flex-1" />
      </div>

      {showMenu && <div className="scopeMenu absolute left-[2px] top-[21px] z-[80] w-[205px] bg-[#064a40] text-[#e2e2e2]">
        <div className="scopeMenuTitle flex h-[12px] items-center justify-center border-b border-[#102f2a] text-[7px]">Title Menu</div>
        <button onClick={() => { setShowScopeConfig(true); setShowMenu(false); }} className="block w-full border-b border-[#102f2a] px-[8px] py-[7px] text-left text-[12px] leading-none hover:bg-[#0a554a]">Scope configuration</button>
        <div className="h-[118px]" />
      </div>}

      <div className="flex h-[23px] items-center border-t border-[#30383b] bg-[#555c61] pl-[27px] text-[10px] text-[#e3e3e3]">
        <span className="mr-[14px]">{stripTime}</span>
        <button onClick={() => setShowChat((v) => !v)} className="mr-[12px]">CHATBOX</button>
        <button onClick={() => setWindows((c) => ({...c,timer:{...c.timer,open:true}}))} className="mr-[12px]">CLOCK</button>
        <button onClick={() => setWindows((c) => ({...c,holds:{...c.holds,open:true}}))} className="mr-[12px]">HOLDS</button>
        <button onClick={() => setWindows((c) => ({...c,metar:{...c.metar,open:true}}))} className="mr-[12px]">METAR</button>
        <button>ATIS</button>
      </div>
    </header>

    <section className="absolute inset-x-0 bottom-[112px] top-[44px] overflow-hidden bg-[#151515]">
      {windows.sector.open && <FloatingWindow windowKey="sector" state={windows.sector} title="SECTOR LIST" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[462px]"><div className="px-1 py-1 text-[9px] leading-[13px]"><div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px]"><span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span></div><div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px] text-[#00e000]"><span>{activePlan?.callsign ?? "LAN337"}</span><span>{activePlan?.aircraft_type ?? "A320"}</span><span>{activePlan?.flight_rules ?? "I"}</span><span>{activePlan?.departure_icao ?? "MDPC"}</span><span>{activePlan?.arrival_icao ?? "MDST"}</span><span>{activePlan?.flight_level ?? "050"}</span><span>11X</span><span className="truncate">PIXE6W-PIXE5-ILSZ-R11X</span><span>{activePlan?.transponder ?? "9999"}</span><span>XXX</span></div></div></FloatingWindow>}
      {windows.taxi.open && <FloatingWindow windowKey="taxi" state={windows.taxi} title="COMBINED TAXI LIST" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[190px]"><div className="px-1 py-1 text-[9px] leading-[13px]"><div className="grid grid-cols-[50px_43px_35px_42px_1fr]"><span>CALLSIGN</span><span>ATYP</span><span>STS</span><span>GATE</span><span>WRN</span></div><div className="grid grid-cols-[50px_43px_35px_42px_1fr] text-[#00e000]"><span>{taxiPlans[0]?.callsign ?? activePlan?.callsign ?? "LAN337"}</span><span>{taxiPlans[0]?.aircraft_type ?? activePlan?.aircraft_type ?? "A320"}</span><span>XXX</span><span>999X</span><span>NORM<br/><span className="text-[#ff6a00]">PROB</span></span></div></div></FloatingWindow>}
      {windows.timer.open && <FloatingWindow windowKey="timer" state={windows.timer} title="TIMER" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[110px]" simple><div className="border border-[#c8c8c8] bg-[#4b5156] py-2 text-center text-[24px] text-white">99:99:99</div></FloatingWindow>}
      {windows.holds.open && <FloatingWindow windowKey="holds" state={windows.holds} title="HOLD LIST" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[144px]" simple><div className="border border-[#c8c8c8] bg-[#565c60] text-[9px]"><div className="grid grid-cols-[1fr_32px_34px] border-b border-[#c8c8c8] text-center"><span>CALLSIGN</span><span>FL</span><span>AFL</span></div><div className="grid grid-cols-[1fr_32px_34px] text-center text-[#00e000]"><span>LAN337</span><span>040</span><span>050</span></div><div className="h-[54px]"/></div></FloatingWindow>}
      {windows.freq.open && <FloatingWindow windowKey="freq" state={windows.freq} title="Freq" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[134px]"><div className="px-1 py-1 text-[9px] text-[#ffff00]">MDCS_CTR&nbsp;&nbsp;199.999</div></FloatingWindow>}
      {windows.metar.open && <FloatingWindow windowKey="metar" state={windows.metar} title="ATIS        Metars" onDrag={startDrag} onClose={closeWindow} onCollapse={collapseWindow} onReset={resetWindow} className="w-[185px]"><div className="px-1 py-1 text-[9px] text-[#00efff]">X&nbsp;&nbsp;{metarStation}&nbsp;&nbsp;{metarText.replace(metarStation, "").trim()}</div></FloatingWindow>}
      {simEnabled && aircraft.map((a) => <button key={a.id} onClick={() => setSelectedId(a.id)} className="absolute z-10 text-left text-[#00ee00]" style={{ left: `${a.x}%`, top: `${a.y}%` }}><span className="absolute -left-[12px] -top-[28px] text-[20px]">◇</span><span className="absolute -left-[35px] -top-[6px] tracking-[3px]">••••</span><span className="block leading-[13px]"><span className="text-[10px]">I</span><br/><b>{a.callsign}</b><br/>A{String(Math.round(a.altitude/100)).padStart(3,"0")}↓&nbsp;&nbsp;{a.groundSpeed}<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{a.arrival}</span></button>)}
      {selected && <div className="absolute right-[11px] top-[272px] w-[210px] text-[#00ee00]"><div className="text-[#ffff00]">A9999</div><div>{selected.callsign} -- &nbsp;{selected.aircraftType}</div><div>050↓ VOGEP N250</div><div>060 080 {selected.arrival}</div><div>AHDG ASP TXT</div></div>}
      <div className="absolute bottom-[2px] left-[2px] text-[8px] leading-[9px]"><div>LAN337</div><div className="text-[#00eaff]">129.800</div><div>118.600</div></div>
      {showConnectDialog && <ConnectDialog form={connectForm} setForm={setConnectForm} connected={connected} onConnect={confirmConnect} onDisconnect={disconnect} onClose={() => setShowConnectDialog(false)}/>} 
    </section>

    {showScopeConfig && <ScopeConfiguration zoom={scopeZoom} setZoom={setScopeZoom} onClose={() => setShowScopeConfig(false)} />}

    {showChat && <footer className="absolute inset-x-0 bottom-0 z-40 h-[112px] bg-[#555c61] text-[9px]"><div className="h-[76px] overflow-hidden px-1 py-2 leading-[12px]">{consoleLines.map((line,index)=><div key={`${line}-${index}`}>{line}</div>)}</div><form className="flex h-[36px] items-center border-t border-[#777] bg-[#efefef] text-[#222]" onSubmit={(e)=>{e.preventDefault();executeCommand(command);}}><span className="pl-16 pr-1 text-[8px]">on 118.600</span><input value={command} onChange={(e)=>setCommand(e.target.value)} className="h-[18px] w-[385px] bg-white px-1 outline-none"/><div className="ml-1 text-[8px]">METAR&nbsp;&nbsp;MDST&nbsp;&nbsp;121800Z 11012KT 9999 FEW025 SCT080 22/14 Q1013</div></form></footer>}
    <style jsx global>{`
      .scopeTopCell{border-right:1px solid #173d38;display:flex;align-items:center;justify-content:center;min-width:0}.scopeTopGap{border-right:1px solid #173d38}.scopeToolOn{background:#0a5b50}.scopeConnected{border-top:1px solid #fff!important;border-bottom:1px solid #fff!important;border-left:1px solid #fff!important;border-right:1px solid #fff!important}.connectBox{border:1px solid #b7b7b7;background:#d8d8d8;box-shadow:inset 1px 1px #f8f8f8,inset -1px -1px #999}.connectField{height:20px;border:1px solid #c0c0c0;background:#efefef;box-shadow:inset 1px 1px #fff;padding:1px 5px;color:#151515}.windowIcon{width:16px;height:12px;display:flex;align-items:center;justify-content:center}.scopeMenu{box-shadow:0 0 0 1px #102f2a}.scopeConfigField{height:24px;border:1px solid #d4d4d4;background:#efefef;color:#111;box-shadow:inset 1px 1px #fff;padding:0 28px 0 8px}
    `}</style>
  </main>;
}

function FloatingWindow({ windowKey, state, title, children, onDrag, onClose, onCollapse, onReset, className="", simple=false }: { windowKey: WindowKey; state: WindowState; title: string; children: React.ReactNode; className?: string; simple?: boolean; onDrag:(key:WindowKey,e:React.MouseEvent)=>void; onClose:(key:WindowKey)=>void; onCollapse:(key:WindowKey)=>void; onReset:(key:WindowKey)=>void; }) {
  return <div className={`absolute z-30 ${className}`} style={{ left: state.x, top: state.y }}><div onMouseDown={(e)=>onDrag(windowKey,e)} className={`flex h-[12px] cursor-move items-center bg-[#064a40] text-[#dedede] ${simple?"justify-center text-[7px]":"text-[7px]"}`}><div className="flex-1 px-1 tracking-[.4px]">{title}</div>{!simple&&<div className="flex h-full"><button onMouseDown={(e)=>e.stopPropagation()} onClick={()=>onReset(windowKey)} className="windowIcon"><ListIcon/></button><button onMouseDown={(e)=>e.stopPropagation()} onClick={()=>onCollapse(windowKey)} className="windowIcon"><CollapseIcon collapsed={state.collapsed}/></button><button onMouseDown={(e)=>e.stopPropagation()} onClick={()=>onClose(windowKey)} className="windowIcon"><CloseIcon/></button></div>}</div>{!state.collapsed&&children}</div>;
}
function ListIcon(){return <svg width="12" height="10" viewBox="0 0 12 10"><rect x="2" y="1" width="8" height="8" fill="none" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="3" x2="9" y2="3" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="5" x2="9" y2="5" stroke="#d8e4e1" strokeWidth=".7"/><line x1="3" y1="7" x2="9" y2="7" stroke="#d8e4e1" strokeWidth=".7"/></svg>}
function CollapseIcon({collapsed}:{collapsed:boolean}){return <svg width="12" height="10" viewBox="0 0 12 10"><path d={collapsed?"M2 3 L6 7 L10 3":"M2 7 L6 3 L10 7"} fill="none" stroke="#d8e4e1" strokeWidth=".8"/></svg>}
function CloseIcon(){return <svg width="12" height="10" viewBox="0 0 12 10"><line x1="2" y1="1" x2="10" y2="9" stroke="#d8e4e1" strokeWidth=".8"/><line x1="10" y1="1" x2="2" y2="9" stroke="#d8e4e1" strokeWidth=".8"/></svg>}

function ConnectDialog({ form, setForm, connected, onConnect, onDisconnect, onClose }: { form:ConnectForm; setForm:React.Dispatch<React.SetStateAction<ConnectForm>>; connected:boolean; onConnect:()=>void; onDisconnect:()=>void; onClose:()=>void }) {
  const callsign=form.callsign.trim().toUpperCase(); const airport=getAirportFromCallsign(callsign); const sectorName=ATC_SECTOR_NAMES[callsign]??""; const airportName=AIRPORT_NAMES[airport]??""; const placeName=sectorName||airportName;
  const info1=placeName&&form.facility?`${placeName} ${FACILITY_INFO[form.facility]}`:""; const info2=airport?"Visítanos en https://pf24.vercel.app/":""; const info3=airport?(PDC_AIRPORTS.has(airport)?`PDC/DCL ${airport}`:"PDC/DCL NO DISPONIBLE"):"";
  const facilityMatches=callsignMatchesFacility(callsign,form.facility); const allFieldsComplete=Boolean(callsign&&ATC_FREQUENCIES[callsign]&&form.facility&&facilityMatches&&form.rating.trim()&&form.server.trim()&&form.password.trim()&&form.discordName.trim()&&form.robloxName.trim()&&info1&&info2&&info3);
  const patch=<K extends keyof ConnectForm>(key:K,value:ConnectForm[K])=>setForm((c)=>({...c,[key]:value}));
  return <div className="connectBox absolute left-1/2 top-[45%] z-50 w-[640px] -translate-x-1/2 -translate-y-1/2 p-[16px] text-[10px] text-[#202020]"><div className="mb-2">Connect dialog</div><div className="grid grid-cols-2 gap-[18px]"><fieldset className="border border-[#b8b8b8] p-2"><legend>SERVER</legend><CallsignRow value={form.callsign} onChange={(v)=>patch("callsign",v.toUpperCase())}/><SelectRow label="Facility" value={form.facility} onChange={(v)=>patch("facility",v as FacilityCode)}/><TextRow label="Rating" value={form.rating} onChange={(v)=>patch("rating",v.toUpperCase())} maxLength={2}/><StaticRow label="Server" value="AUTOMATIC"/></fieldset><fieldset className="border border-[#b8b8b8] p-2"><legend>PROFILE</legend><TextRow label="Password" value={form.password} onChange={(v)=>patch("password",v)} type="password"/><TextRow label="DISCORD name" value={form.discordName} onChange={(v)=>patch("discordName",v)}/><TextRow label="ROBLOX name" value={form.robloxName} onChange={(v)=>patch("robloxName",v)}/></fieldset></div><fieldset className="mt-2 border border-[#b8b8b8] p-2"><legend>INFORMATION</legend><StaticRow label="INFO line 1" value={info1}/><StaticRow label="INFO line 2" value={info2}/><StaticRow label="INFO line 3" value={info3}/><TextRow label="INFO line 4" value={form.info4} onChange={(v)=>patch("info4",v)} wide/></fieldset><div className="mt-3 flex justify-between"><div className="flex gap-1"><button onClick={onConnect} disabled={!allFieldsComplete||connected} className="border bg-[#ececec] px-3 py-1 disabled:text-gray-400">Connect</button><button onClick={onDisconnect} disabled={!connected} className="border bg-[#ececec] px-3 py-1 disabled:text-gray-400">Disconnect</button></div><button onClick={onClose} className="border bg-[#ececec] px-3 py-1">Close</button></div></div>;
}
function CallsignRow({value,onChange}:{value:string;onChange:(v:string)=>void}){return <div className="relative mb-1 grid grid-cols-[72px_1fr] items-center gap-1"><span>Callsign</span><div><input list="scope-callsigns" value={value} maxLength={20} onChange={(e)=>onChange(e.target.value)} className="connectField w-full outline-none" autoComplete="off"/><datalist id="scope-callsigns">{CALLSIGN_OPTIONS.map((option)=><option key={option} value={option}/>)}</datalist></div></div>}
function TextRow({label,value,onChange,type="text",wide=false,maxLength=20}:{label:string;value:string;onChange:(v:string)=>void;type?:string;wide?:boolean;maxLength?:number}){return <div className={`mb-1 grid items-center gap-1 ${wide?"grid-cols-[82px_1fr]":"grid-cols-[72px_1fr]"}`}><span>{label}</span><input type={type} value={value} maxLength={maxLength} onChange={(e)=>onChange(e.target.value)} className="connectField w-full outline-none"/></div>}
function StaticRow({label,value}:{label:string;value:string}){return <div className="mb-1 grid grid-cols-[82px_1fr] items-center gap-1"><span>{label}</span><div className="connectField truncate">{value}</div></div>}
function SelectRow({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <div className="mb-1 grid grid-cols-[72px_1fr] items-center gap-1"><span>{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="connectField w-full outline-none"><option value=""></option>{FACILITY_LABELS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>}

function ScopeConfiguration({ zoom, setZoom, onClose }: { zoom:number; setZoom:React.Dispatch<React.SetStateAction<number>>; onClose:()=>void }) {
  const updateZoom=(value:number)=>setZoom(Math.max(25,Math.min(400,Math.round(value))));
  return <div className="absolute left-1/2 top-1/2 z-[90] h-[330px] w-[620px] -translate-x-1/2 -translate-y-1/2 border border-[#888] bg-[#cecece] font-mono text-[#111] shadow-[0_2px_10px_rgba(0,0,0,.5)]">
    <div className="flex h-[23px] items-stretch border-b border-white bg-[#cecece] text-[14px]">
      <div className="flex items-center border-r border-white px-[12px]">General</div>
      <div className="flex items-center border-r border-[#c2c2c2] px-[12px] text-[#aaa]">Personalization</div>
      <button onClick={onClose} className="ml-auto w-[28px] border-l border-[#bbb] text-[16px]">×</button>
    </div>
    <div className="px-[18px] pt-[30px] text-[14px]">
      <div className="flex items-center gap-[14px]">
        <span>Default scope zoom</span>
        <div className="relative flex h-[24px] w-[200px] items-center bg-[#efefef]">
          <input value={`${zoom}%`} readOnly className="scopeConfigField h-full w-full text-center text-[15px] outline-none" />
          <div className="absolute right-0 top-0 flex h-full w-[26px] border-l border-[#bcbcbc] bg-[#d9d9d9]">
            <button onClick={()=>updateZoom(zoom-5)} className="flex w-1/2 items-center justify-center border-r border-[#aaa] text-[9px]">▾</button>
            <button onClick={()=>updateZoom(zoom+5)} className="flex w-1/2 items-center justify-center text-[9px]">▴</button>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function MenuGlyph() {
  return <svg width="21" height="8" viewBox="0 0 100 38" aria-hidden="true">
    <rect x="3" y="3" width="94" height="32" fill="none" stroke="#e2e2e2" strokeWidth="4"/>
    <path d="M18 19h13M24.5 12.5v13M38 19h13M44.5 12.5v13M57 19h13M76 19h13M82.5 12.5v13" fill="none" stroke="#e2e2e2" strokeWidth="4" strokeLinecap="square"/>
  </svg>;
}

function ToolbarGlyph({kind,active}:{kind:"screen"|"vector"|"dots"|"filter"|"route";active:boolean}) {
  const s=active?"#ffffff":"#e2e2e2";
  const orange="#ff7433";
  if(kind==="screen")return <svg width="21" height="19" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="30" y="7" width="40" height="78" fill="none" stroke={s} strokeWidth="7"/>
    <text x="50" y="66" textAnchor="middle" fontSize="20" fontFamily="monospace" fill={s}>36</text>
    <rect x="37" y="70" width="7" height="12" fill={s}/><rect x="49" y="70" width="7" height="12" fill={s}/><rect x="61" y="70" width="7" height="12" fill={s}/><rect x="73" y="70" width="7" height="12" fill={s}/>
  </svg>;
  if(kind==="vector")return <svg width="22" height="19" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="13" y="51" width="37" height="37" fill="none" stroke={s} strokeWidth="7"/>
    <line x1="59" y1="43" x2="73" y2="29" stroke={s} strokeWidth="7"/>
    <line x1="81" y1="21" x2="94" y2="8" stroke={s} strokeWidth="7"/>
  </svg>;
  if(kind==="dots")return <svg width="22" height="19" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="57" y="7" width="37" height="37" fill="none" stroke={s} strokeWidth="7"/>
    <circle cx="13" cy="91" r="4.5" fill={s}/><circle cx="39" cy="85" r="4.5" fill={s}/><circle cx="64" cy="77" r="4.5" fill={s}/><circle cx="77" cy="61" r="4.5" fill={s}/>
  </svg>;
  if(kind==="filter")return <svg width="41" height="19" viewBox="0 0 110 100" aria-hidden="true">
    <polygon points="9,91 30,52 51,91" fill={s}/>
    <line x1="45" y1="81" x2="74" y2="50" stroke={orange} strokeWidth="5"/>
    <rect x="72" y="10" width="25" height="25" fill="none" stroke={s} strokeWidth="6"/>
    <line x1="84.5" y1="42" x2="84.5" y2="55" stroke={s} strokeWidth="6"/>
    <line x1="84.5" y1="64" x2="84.5" y2="77" stroke={s} strokeWidth="6"/>
  </svg>;
  return <svg width="47" height="19" viewBox="0 0 120 100" aria-hidden="true">
    <circle cx="16" cy="20" r="5" fill={s}/>
    <rect x="37" y="10" width="25" height="25" fill="none" stroke={s} strokeWidth="6"/>
    <line x1="53" y1="35" x2="72" y2="78" stroke={orange} strokeWidth="5"/>
    <rect x="64" y="70" width="25" height="25" fill="none" stroke={s} strokeWidth="6"/>
    <line x1="72" y1="20" x2="86" y2="20" stroke={s} strokeWidth="6"/><line x1="94" y1="20" x2="108" y2="20" stroke={s} strokeWidth="6"/>
    <line x1="13" y1="82" x2="27" y2="82" stroke={s} strokeWidth="6"/><line x1="35" y1="82" x2="49" y2="82" stroke={s} strokeWidth="6"/>
    <circle cx="109" cy="83" r="5" fill={s}/>
  </svg>;
}
