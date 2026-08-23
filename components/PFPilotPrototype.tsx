"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PilotFlightPlanForm from "@/components/PilotFlightPlanForm";
import PilotFlightPlans from "@/components/PilotFlightPlans";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES, ATC_SECTOR_NAMES } from "@/lib/atcFrequencies";
import {
  getTransponderModeFromNotes,
  setTransponderModeInNotes,
} from "@/lib/flightPlanGameCallsign";

type ToolId = "cabin" | "flightplan" | "atis" | "frequencies" | "chat";
type CabinTab = "xpdr" | "altimeter" | "autopilot" | "warning";
type TransponderMode = "OFF" | "STBY" | "ON" | "ALT";
type WarningTest = "NONE" | "TA" | "RA" | "TERRAIN";
type PressureUnit = "HPA" | "INHG";

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  started_at: string;
  is_active: boolean;
};

type AtisMessage = {
  id: string;
  airport_icao: string;
  info_letter: string;
  metar: string;
  approach_primary: string;
  approach_optional: string | null;
  runway: string;
  extra_info: string | null;
  remarks: string | null;
  full_text: string;
  created_by: string | null;
  created_at: string;
};

type RadioChannel = {
  label: string;
  frequency: string;
  kind: "ATC" | "UNICOM" | "ATIS";
};

type ChatMessage = {
  id: string;
  sender: string;
  channel: string;
  text: string;
  time: string;
};

type PilotPlan = {
  id: string;
  transponder: string;
  notes: string | null;
  status: string;
  created_by: string | null;
  [key: string]: unknown;
};

const TOOLS: Array<{ id: ToolId; label: string; subtitle: string }> = [
  { id: "cabin", label: "CABIN", subtitle: "Herramientas de vuelo" },
  { id: "flightplan", label: "FLIGHT PLAN", subtitle: "Plan operacional" },
  { id: "atis", label: "ATIS", subtitle: "Información activa" },
  { id: "frequencies", label: "FREQUENCIES", subtitle: "Radio / sectores" },
  { id: "chat", label: "CHATBOX", subtitle: "Mensajería" },
];

const CABIN_TABS: Array<{ id: CabinTab; label: string }> = [
  { id: "xpdr", label: "TRANSPONDER" },
  { id: "altimeter", label: "ALTIMETER" },
  { id: "autopilot", label: "PILOTO AUTOMÁTICO" },
  { id: "warning", label: "WARNING" },
];

function latestAtisByAirport(items: AtisMessage[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return Object.values(
    sorted.reduce<Record<string, AtisMessage>>((acc, item) => {
      if (!acc[item.airport_icao]) acc[item.airport_icao] = item;
      return acc;
    }, {})
  );
}

function formatUtc(date = new Date()) {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}Z`;
}

function normalizeXpdr(value: string) {
  return value.replace(/[^0-7]/g, "").slice(0, 4);
}

function stdPressure(unit: PressureUnit) {
  return unit === "INHG" ? "29.92" : "1013";
}

function convertPressure(value: string, from: PressureUnit, to: PressureUnit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || from === to) return value;
  if (from === "HPA" && to === "INHG") return (numeric * 0.0295299830714).toFixed(2);
  return String(Math.round(numeric / 0.0295299830714));
}

export default function PFPilotPrototype({
  pilotId,
  pilotName,
  initialPlans,
  initialSessions,
  initialAtis,
}: {
  pilotId: string;
  pilotName: string;
  initialPlans: any[];
  initialSessions: ATCSession[];
  initialAtis: AtisMessage[];
}) {
  const initialActivePlan = (initialPlans.find((plan) => plan.status !== "FINISHED") ?? null) as PilotPlan | null;

  const [activeTool, setActiveTool] = useState<ToolId>("cabin");
  const [cabinTab, setCabinTab] = useState<CabinTab>("xpdr");
  const [sessions, setSessions] = useState(initialSessions);
  const [atis, setAtis] = useState(() => latestAtisByAirport(initialAtis));
  const [openAtisId, setOpenAtisId] = useState<string | null>(null);
  const [pilotPlan, setPilotPlan] = useState<PilotPlan | null>(initialActivePlan);

  const [xpdrCode, setXpdrCode] = useState(() => normalizeXpdr(initialActivePlan?.transponder ?? "2000") || "2000");
  const [xpdrMode, setXpdrMode] = useState<TransponderMode>(() => getTransponderModeFromNotes(initialActivePlan?.notes));
  const xpdrCodeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [qnh, setQnh] = useState("1013");
  const [qnhUnit, setQnhUnit] = useState<PressureUnit>("HPA");
  const [isStd, setIsStd] = useState(true);

  const [apEnabled, setApEnabled] = useState(false);
  const [targetWaypoint, setTargetWaypoint] = useState("");
  const [targetHeading, setTargetHeading] = useState("090");
  const [targetAltitude, setTargetAltitude] = useState("10000");
  const [targetSpeed, setTargetSpeed] = useState("250");
  const [currentAltitude, setCurrentAltitude] = useState("32000");
  const [groundSpeed, setGroundSpeed] = useState("420");
  const [warningTest, setWarningTest] = useState<WarningTest>("NONE");

  const [activeRadio, setActiveRadio] = useState<RadioChannel>({
    label: "UNICOM",
    frequency: "122.800",
    kind: "UNICOM",
  });
  const [standbyRadio, setStandbyRadio] = useState<RadioChannel | null>(null);

  const [chatMode, setChatMode] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [chatTarget, setChatTarget] = useState("");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "SYSTEM",
      channel: "UNICOM",
      text: "PFPilot ChatBox prototype ready. Realtime transport will be connected in the next phase.",
      time: formatUtc(),
    },
  ]);

  useEffect(() => {
    async function refreshSessions() {
      const { data } = await supabase
        .from("atc_sessions")
        .select("*")
        .eq("is_active", true)
        .order("started_at", { ascending: false });
      setSessions((data ?? []) as ATCSession[]);
    }

    async function refreshAtis() {
      const { data } = await supabase
        .from("atis_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      setAtis(latestAtisByAirport((data ?? []) as AtisMessage[]));
    }

    const atcChannel = supabase
      .channel("pfpilot-atc-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atc_sessions" },
        refreshSessions
      )
      .subscribe();

    const atisChannel = supabase
      .channel("pfpilot-atis")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atis_messages" },
        refreshAtis
      )
      .subscribe();

    return () => {
      supabase.removeChannel(atcChannel);
      supabase.removeChannel(atisChannel);
    };
  }, []);

  useEffect(() => {
    async function refreshPilotPlan() {
      const { data, error } = await supabase
        .from("flight_plans")
        .select("*")
        .eq("created_by", pilotId)
        .neq("status", "FINISHED")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("PFPilot active flight refresh failed:", error);
        return;
      }

      setPilotPlan(((data ?? [])[0] ?? null) as PilotPlan | null);
    }

    const channel = supabase
      .channel(`pfpilot-active-flight-${pilotId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        refreshPilotPlan,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pilotId]);

  useEffect(() => {
    if (!pilotPlan) return;
    const nextCode = normalizeXpdr(pilotPlan.transponder ?? "");
    if (nextCode.length === 4) setXpdrCode(nextCode);
    setXpdrMode(getTransponderModeFromNotes(pilotPlan.notes));
  }, [pilotPlan?.id, pilotPlan?.transponder, pilotPlan?.notes]);

  useEffect(() => {
    if (!pilotPlan?.id || xpdrCode.length !== 4) return;
    if (xpdrCodeSaveTimer.current) clearTimeout(xpdrCodeSaveTimer.current);

    xpdrCodeSaveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("flight_plans")
        .update({ transponder: xpdrCode, updated_at: new Date().toISOString() })
        .eq("id", pilotPlan.id)
        .eq("created_by", pilotId)
        .neq("status", "FINISHED");

      if (error) console.error("PFPilot transponder code save failed:", error);
    }, 250);

    return () => {
      if (xpdrCodeSaveTimer.current) clearTimeout(xpdrCodeSaveTimer.current);
    };
  }, [pilotId, pilotPlan?.id, xpdrCode]);

  useEffect(() => {
    if (!pilotPlan?.id) return;

    let cancelled = false;
    const saveMode = async () => {
      const { data, error: readError } = await supabase
        .from("flight_plans")
        .select("notes")
        .eq("id", pilotPlan.id)
        .eq("created_by", pilotId)
        .neq("status", "FINISHED")
        .maybeSingle();

      if (cancelled || readError || !data) {
        if (readError) console.error("PFPilot transponder mode read failed:", readError);
        return;
      }

      const notes = setTransponderModeInNotes(data.notes, xpdrMode);
      const { error } = await supabase
        .from("flight_plans")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", pilotPlan.id)
        .eq("created_by", pilotId)
        .neq("status", "FINISHED");

      if (error) console.error("PFPilot transponder mode save failed:", error);
    };

    void saveMode();
    return () => {
      cancelled = true;
    };
  }, [pilotId, pilotPlan?.id, xpdrMode]);

  const radioChannels = useMemo(() => {
    const atcChannels: RadioChannel[] = sessions
      .filter((session) => ATC_FREQUENCIES[session.position])
      .map((session) => ({
        label: session.position,
        frequency: ATC_FREQUENCIES[session.position],
        kind: "ATC" as const,
      }));

    return [
      { label: "UNICOM", frequency: "122.800", kind: "UNICOM" as const },
      ...atcChannels,
    ];
  }, [sessions]);

  const altitudeNow = Number(currentAltitude) || 0;
  const altitudeTarget = Number(targetAltitude) || 0;
  const gs = Math.max(1, Number(groundSpeed) || 1);
  const altitudeDelta = altitudeNow - altitudeTarget;
  const descentDistance = altitudeDelta > 0 ? altitudeDelta / 300 : 0;
  const climbDistance = altitudeDelta < 0 ? Math.abs(altitudeDelta) / 500 : 0;
  const todMinutes = descentDistance > 0 ? (descentDistance / gs) * 60 : 0;
  const tocMinutes = climbDistance > 0 ? (climbDistance / gs) * 60 : 0;

  function selectTool(id: ToolId) {
    setActiveTool((current) => (current === id ? "cabin" : id));
  }

  function tune(channel: RadioChannel) {
    if (
      channel.label === activeRadio.label &&
      channel.frequency === activeRadio.frequency
    ) {
      return;
    }
    setStandbyRadio(channel);
  }

  function swapRadios() {
    if (!standbyRadio) return;
    const previousActive = activeRadio;
    setActiveRadio(standbyRadio);
    setStandbyRadio(previousActive);
  }

  function sendChatMessage() {
    const text = chatText.trim();
    if (!text) return;
    const channel = chatMode === "PUBLIC" ? activeRadio.label : chatTarget.trim() || "PRIVATE";
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        sender: pilotName || "PILOT",
        channel,
        text,
        time: formatUtc(),
      },
    ]);
    setChatText("");
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mono text-xs tracking-[0.25em] text-sky-300/70">PFPILOT</p>
              <h2 className="mt-2 text-xl font-extrabold">Flight deck</h2>
            </div>
            <span className="h-3 w-3 rounded-full bg-green-400 shadow-[0_0_16px_rgba(74,222,128,0.8)]" />
          </div>
          <div className="mt-5 grid gap-2 text-xs text-slate-400">
            <div className="flex justify-between"><span>XPDR</span><span className="mono text-slate-200">{xpdrCode} {xpdrMode}</span></div>
            <div className="flex justify-between"><span>ALT</span><span className="mono text-slate-200">{isStd ? `STD ${qnh} ${qnhUnit}` : `${qnh} ${qnhUnit}`}</span></div>
            <div className="flex justify-between"><span>RADIO</span><span className="mono text-sky-300">{activeRadio.frequency}</span></div>
            <div className="flex justify-between"><span>WARNING</span><span className={warningTest === "NONE" ? "mono text-green-300" : "mono text-amber-300"}>{warningTest === "NONE" ? "NORMAL" : warningTest}</span></div>
          </div>
        </div>

        <nav className="panel rounded-3xl p-3">
          <div className="grid gap-2">
            {TOOLS.map((tool) => {
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectTool(tool.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-sky-400/70 bg-sky-400/10 text-sky-200"
                      : "border-white/10 bg-[#020617]/70 text-slate-300 hover:border-sky-400/40 hover:text-sky-200"
                  }`}
                >
                  <p className="mono text-xs font-bold tracking-[0.12em]">{tool.label}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{tool.subtitle}</p>
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      <section className="min-w-0">
        {activeTool === "cabin" && (
          <ToolWindow title="CABIN" subtitle="Principal flight tools">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {CABIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCabinTab(tab.id)}
                  className={`rounded-xl border px-3 py-3 mono text-xs font-bold transition ${
                    cabinTab === tab.id
                      ? "border-sky-400 bg-sky-400/10 text-sky-200"
                      : "border-white/10 bg-slate-950 text-slate-400 hover:text-sky-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {cabinTab === "xpdr" && (
              <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.3fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <p className="mono text-xs text-slate-500">SQUAWK CODE</p>
                  <input
                    value={xpdrCode}
                    onChange={(event) => setXpdrCode(normalizeXpdr(event.target.value))}
                    inputMode="numeric"
                    maxLength={4}
                    className="mono mt-3 w-full rounded-xl border border-sky-400/30 bg-[#020617] px-4 py-4 text-center text-4xl font-bold tracking-[0.35em] text-sky-200 outline-none focus:border-sky-400"
                  />
                  <p className="mt-3 text-xs text-slate-500">Solo dígitos octales 0–7. El código se sincroniza con el plan de vuelo activo.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <p className="mono text-xs text-slate-500">TRANSPONDER MODE</p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {(["OFF", "STBY", "ON", "ALT"] as TransponderMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setXpdrMode(mode)}
                        className={`rounded-xl border px-2 py-4 mono text-xs font-bold ${
                          xpdrMode === mode
                            ? "border-green-400/70 bg-green-400/10 text-green-300"
                            : "border-white/10 bg-[#020617] text-slate-400"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-400">
                    <span className="mono text-sky-300">STATUS</span> · Code {xpdrCode || "----"} / Mode {xpdrMode}
                  </div>
                </div>
              </div>
            )}

            {cabinTab === "altimeter" && (
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="mono text-xs text-slate-500">BAROMETRIC SETTING</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsStd(true);
                        setQnh(stdPressure(qnhUnit));
                      }}
                      className={`rounded-lg border px-3 py-1.5 mono text-xs ${isStd ? "border-green-400/60 bg-green-400/10 text-green-300" : "border-white/10 text-slate-400"}`}
                    >
                      STD
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={qnh}
                      onChange={(event) => {
                        setIsStd(false);
                        setQnh(event.target.value.replace(/[^0-9.]/g, "").slice(0, 6));
                      }}
                      className="mono min-w-0 flex-1 rounded-xl border border-white/10 bg-[#020617] px-4 py-4 text-center text-3xl font-bold text-sky-200 outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextUnit: PressureUnit = qnhUnit === "HPA" ? "INHG" : "HPA";
                        setQnh((current) => isStd ? stdPressure(nextUnit) : convertPressure(current, qnhUnit, nextUnit));
                        setQnhUnit(nextUnit);
                      }}
                      className="rounded-xl border border-white/10 bg-[#020617] px-4 mono text-xs font-bold text-slate-300"
                    >
                      {qnhUnit}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <p className="mono text-xs text-slate-500">SELECTED REFERENCE</p>
                  <p className="mono mt-4 text-4xl font-extrabold text-white">
                    {isStd ? "STD" : qnh || "----"}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {isStd ? "QNE · 1013 hPa / 29.92 inHg" : `QNH manual · ${qnhUnit}`}
                  </p>
                </div>
              </div>
            )}

            {cabinTab === "autopilot" && (
              <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="mono text-xs text-slate-500">GUIDANCE DIRECTOR</p>
                      <p className="mt-1 text-sm text-slate-400">Da instrucciones al piloto; no controla la aeronave.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setApEnabled((current) => !current)}
                      className={`rounded-xl border px-4 py-2 mono text-xs font-bold ${apEnabled ? "border-green-400/60 bg-green-400/10 text-green-300" : "border-white/10 text-slate-400"}`}
                    >
                      {apEnabled ? "GUIDANCE ON" : "GUIDANCE OFF"}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Field label="TARGET WPT" value={targetWaypoint} onChange={setTargetWaypoint} placeholder="PIXES" />
                    <Field label="HDG" value={targetHeading} onChange={setTargetHeading} placeholder="090" />
                    <Field label="ALTITUDE" value={targetAltitude} onChange={setTargetAltitude} placeholder="10000" suffix="FT" />
                    <Field label="SPEED" value={targetSpeed} onChange={setTargetSpeed} placeholder="250" suffix="KT" />
                    <Field label="CURRENT ALT" value={currentAltitude} onChange={setCurrentAltitude} placeholder="32000" suffix="FT" />
                    <Field label="GROUND SPEED" value={groundSpeed} onChange={setGroundSpeed} placeholder="420" suffix="KT" />
                  </div>

                  <div className={`mt-5 rounded-2xl border p-5 ${apEnabled ? "border-sky-400/40 bg-sky-400/5" : "border-white/10 bg-[#020617]"}`}>
                    <p className="mono text-xs text-slate-500">PFPILOT ADVISORY</p>
                    {apEnabled ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <p>FLY HEADING <span className="mono font-bold text-sky-300">{targetHeading || "---"}°</span>{targetWaypoint ? <> DIRECT <span className="mono font-bold text-sky-300">{targetWaypoint.toUpperCase()}</span></> : null}</p>
                        <p>MAINTAIN <span className="mono font-bold text-sky-300">{targetAltitude || "-----"} FT</span> · SPEED <span className="mono font-bold text-sky-300">{targetSpeed || "---"} KT</span></p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Activa GUIDANCE para mostrar instrucciones de vuelo.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                    <p className="mono text-xs text-slate-500">TOD / TOC ESTIMATE</p>
                    {altitudeDelta > 0 ? (
                      <>
                        <p className="mono mt-4 text-3xl font-bold text-sky-300">TOD {descentDistance.toFixed(1)} NM</p>
                        <p className="mt-2 text-sm text-slate-400">≈ {todMinutes.toFixed(1)} min at {gs.toFixed(0)} kt · prototype 300 ft/NM rule.</p>
                      </>
                    ) : altitudeDelta < 0 ? (
                      <>
                        <p className="mono mt-4 text-3xl font-bold text-sky-300">TOC {climbDistance.toFixed(1)} NM</p>
                        <p className="mt-2 text-sm text-slate-400">≈ {tocMinutes.toFixed(1)} min at {gs.toFixed(0)} kt · prototype climb estimate.</p>
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-green-300">Target altitude reached.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-6 text-amber-100/80">
                    La siguiente fase conectará posición, ruta, waypoints y restricciones publicadas para que estas instrucciones se calculen automáticamente.
                  </div>
                </div>
              </div>
            )}

            {cabinTab === "warning" && (
              <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.9fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <p className="mono text-xs text-slate-500">CONFLICT PARAMETERS</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Metric label="HORIZONTAL" value="1.5 NM" />
                    <Metric label="IFR VERTICAL" value="800 FT" />
                    <Metric label="VFR / MIXED" value="250 FT" />
                  </div>
                  <div className="mt-5 rounded-xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-400">
                    La lógica final reutilizará el detector del Scope con estos mínimos reducidos y exclusión de tráfico en tierra.
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 ${warningTest === "NONE" ? "border-green-400/30 bg-green-400/5" : warningTest === "RA" || warningTest === "TERRAIN" ? "border-red-400/60 bg-red-400/10" : "border-amber-400/60 bg-amber-400/10"}`}>
                  <p className="mono text-xs text-slate-500">WARNING DISPLAY TEST</p>
                  <p className={`mono mt-4 text-4xl font-extrabold ${warningTest === "NONE" ? "text-green-300" : warningTest === "RA" || warningTest === "TERRAIN" ? "text-red-300" : "text-amber-300"}`}>
                    {warningTest === "NONE" ? "NORMAL" : warningTest}
                  </p>
                  <p className="mt-2 min-h-10 text-sm text-slate-300">
                    {warningTest === "TA" && "TRAFFIC · TRAFFIC"}
                    {warningTest === "RA" && "RESOLUTION ADVISORY · FOLLOW RA"}
                    {warningTest === "TERRAIN" && "TERRAIN · PULL UP"}
                    {warningTest === "NONE" && "No active warning."}
                  </p>
                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {(["NONE", "TA", "RA", "TERRAIN"] as WarningTest[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setWarningTest(value)}
                        className="rounded-lg border border-white/10 bg-[#020617] px-2 py-2 mono text-[10px] font-bold text-slate-300 hover:border-sky-400/40"
                      >
                        {value === "NONE" ? "RESET" : value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ToolWindow>
        )}

        {activeTool === "flightplan" && (
          <ToolWindow title="FLIGHT PLAN" subtitle="Create and manage the active plan">
            <div className="-mt-8">
              <PilotFlightPlanForm />
              <PilotFlightPlans initialPlans={initialPlans} pilotId={pilotId} />
            </div>
          </ToolWindow>
        )}

        {activeTool === "atis" && (
          <ToolWindow title="ATIS" subtitle="Latest active information by airport">
            {atis.length === 0 ? (
              <EmptyState text="No hay ATIS publicados actualmente." />
            ) : (
              <div className="grid gap-3">
                {atis.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <button
                      type="button"
                      onClick={() => setOpenAtisId((current) => (current === item.id ? null : item.id))}
                      className="w-full text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="mono font-bold text-sky-300">{item.airport_icao} INFO {item.info_letter}</p>
                          <p className="mt-1 text-sm text-slate-400">RWY {item.runway} · APPR {item.approach_primary}{item.approach_optional ? ` / ${item.approach_optional}` : ""}</p>
                        </div>
                        <span className="mono text-xs text-slate-500">{new Date(item.created_at).toISOString().slice(11, 16)}Z</span>
                      </div>
                    </button>
                    {openAtisId === item.id && (
                      <div className="mt-4 grid gap-4 border-t border-white/10 pt-4">
                        <div>
                          <p className="mono text-[10px] text-slate-500">METAR</p>
                          <p className="mono mt-1 text-xs leading-6 text-slate-300">{item.metar}</p>
                        </div>
                        <div>
                          <p className="mono text-[10px] text-slate-500">FULL ATIS</p>
                          <p className="mt-1 text-sm leading-7 text-slate-200">{item.full_text}</p>
                        </div>
                        <p className="text-xs text-slate-500">Publicado por {item.created_by ?? "sector desconocido"}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ToolWindow>
        )}

        {activeTool === "frequencies" && (
          <ToolWindow title="FREQUENCIES" subtitle="COM radio and active sectors">
            <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-400/30 bg-slate-950 p-5">
                  <p className="mono text-xs text-slate-500">ACTIVE</p>
                  <p className="mono mt-2 text-4xl font-extrabold text-sky-300">{activeRadio.frequency}</p>
                  <p className="mt-1 text-sm text-slate-300">{activeRadio.label}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <p className="mono text-xs text-slate-500">STANDBY</p>
                  <p className="mono mt-2 text-3xl font-extrabold text-white">{standbyRadio?.frequency ?? "---.---"}</p>
                  <p className="mt-1 text-sm text-slate-400">{standbyRadio?.label ?? "No frequency selected"}</p>
                  <button
                    type="button"
                    disabled={!standbyRadio}
                    onClick={swapRadios}
                    className="mt-4 w-full rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 mono text-xs font-bold text-sky-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ⇄ SWAP ACTIVE / STBY
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mono mb-3 text-xs text-slate-500">AVAILABLE RADIO CHANNELS</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {radioChannels.map((channel) => (
                      <button
                        key={`${channel.label}-${channel.frequency}`}
                        type="button"
                        onClick={() => tune(channel)}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-left hover:border-sky-400/40"
                      >
                        <div>
                          <p className="mono text-xs font-bold text-slate-200">{channel.label}</p>
                          {channel.kind === "ATC" && (
                            <p className="mt-1 text-[10px] text-slate-500">{ATC_SECTOR_NAMES[channel.label] ?? sessions.find((item) => item.position === channel.label)?.controller_name ?? "ATC"}</p>
                          )}
                        </div>
                        <span className="mono text-sm font-bold text-sky-300">{channel.frequency}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mono mb-3 text-xs text-slate-500">ATIS CHANNELS</p>
                  {atis.length === 0 ? (
                    <p className="text-sm text-slate-500">No active ATIS.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {atis.map((item) => {
                        const channel: RadioChannel = {
                          label: `${item.airport_icao} ATIS`,
                          frequency: "ATIS",
                          kind: "ATIS",
                        };
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => tune(channel)}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-left hover:border-sky-400/40"
                          >
                            <div>
                              <p className="mono text-xs font-bold text-slate-200">{item.airport_icao} ATIS</p>
                              <p className="mt-1 text-[10px] text-slate-500">INFO {item.info_letter}</p>
                            </div>
                            <span className="mono text-xs font-bold text-sky-300">DATA</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">Las frecuencias numéricas ATIS quedan pendientes de la tabla oficial de PF24; no se inventan valores en este prototipo.</p>
                </div>
              </div>
            </div>
          </ToolWindow>
        )}

        {activeTool === "chat" && (
          <ToolWindow title="CHATBOX" subtitle="Public and private text channels">
            <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                <p className="mono text-xs text-slate-500">CHANNEL MODE</p>
                <div className="mt-3 grid gap-2">
                  {(["PUBLIC", "PRIVATE"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setChatMode(mode)}
                      className={`rounded-xl border px-3 py-3 mono text-xs font-bold ${chatMode === mode ? "border-sky-400 bg-sky-400/10 text-sky-200" : "border-white/10 bg-[#020617] text-slate-400"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {chatMode === "PUBLIC" ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#020617] p-3">
                    <p className="mono text-[10px] text-slate-500">CURRENT CHANNEL</p>
                    <p className="mono mt-1 text-sm font-bold text-sky-300">{activeRadio.label}</p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <label className="mono text-[10px] text-slate-500">ACTIVE USER / CALLSIGN</label>
                    <input
                      value={chatTarget}
                      onChange={(event) => setChatTarget(event.target.value.toUpperCase())}
                      placeholder="N123PF"
                      className="mono mt-2 w-full rounded-xl border border-white/10 bg-[#020617] px-3 py-3 text-sm text-white outline-none focus:border-sky-400"
                    />
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                <div className="h-[360px] space-y-3 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div key={message.id} className="rounded-xl border border-white/10 bg-[#020617] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="mono text-[10px] font-bold text-sky-300">{message.sender} · {message.channel}</p>
                        <span className="mono text-[10px] text-slate-600">{message.time}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{message.text}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 p-3">
                  <div className="flex gap-2">
                    <input
                      value={chatText}
                      onChange={(event) => setChatText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") sendChatMessage();
                      }}
                      placeholder={chatMode === "PUBLIC" ? `Mensaje en ${activeRadio.label}` : "Mensaje privado"}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      onClick={sendChatMessage}
                      className="rounded-xl border border-sky-400/50 bg-sky-400/10 px-4 mono text-xs font-bold text-sky-200"
                    >
                      SEND
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600">Prototype: messages are local to this browser until the PF24 realtime chat transport is connected.</p>
                </div>
              </div>
            </div>
          </ToolWindow>
        )}
      </section>
    </div>
  );
}

function ToolWindow({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel rounded-3xl p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="mono text-xs tracking-[0.22em] text-sky-300/70">PFPILOT MODULE</p>
          <h2 className="mt-1 text-2xl font-extrabold text-white">{title}</h2>
        </div>
        <p className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: string;
}) {
  return (
    <label>
      <span className="mono text-[10px] text-slate-500">{label}</span>
      <div className="mt-1 flex overflow-hidden rounded-xl border border-white/10 bg-[#020617] focus-within:border-sky-400/60">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder={placeholder}
          className="mono min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
        />
        {suffix && <span className="mono flex items-center border-l border-white/10 px-3 text-[10px] text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#020617] p-4">
      <p className="mono text-[10px] text-slate-500">{label}</p>
      <p className="mono mt-2 text-xl font-bold text-sky-300">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
