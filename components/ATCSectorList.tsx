"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import AtisCreator from "@/components/AtisCreator";
import LatestAtisPanel from "@/components/LatestAtisPanel";

type FlightPlan = {
  id: string;
  callsign: string;
  aircraft_type: string;
  flight_rules: string;
  departure_icao: string;
  arrival_icao: string;
  route: string;
  flight_level: string;
  transponder: string;
  status: string;
  sector_status: string;
  notes: string | null;
  assumed_by: string | null;
  created_by: string | null;
};

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
};

const ATC_POSITIONS = [
  "MDCS_CTR", "MDCS_E_CTR", "MDCS_W_CTR", "GCCC_R6_CTR", "LECB_CTR",
  "LCCC_CTR", "LCCC_S2_CTR", "LCCC_S_CTR", "LCCC_W_CTR", "LCCC_E_CTR",
  "EFIN_D_CTR", "EGTT_CTR", "EGPX_CTR", "EGTT_S_CTR",
  "EFIN_TWR", "EFIN_DEL", "GCLP_GCA_APP", "GCLP_TWR", "GCLP_GND", "GCLP_DEL",
  "LEMH_MXX_APP", "LEMH_TWR", "LEMH_GND",
  "EGKK_APP", "EGKK_TWR", "EGKK_GND", "EGKK_P_GND", "EGKK_DEL",
  "EGHI_TWR", "LCLK_APP", "LCLK_TWR", "LCLK_GND", "LCLK_DEL",
  "LCPH_APP", "LCPH_TWR", "LCRA_TWR",
  "MDPC_APP", "MDPC_TWR", "MDPC_GND", "MDPC_R_GND", "MDPC_DEL",
  "MDST_APP", "MDST_TWR", "MDST_GND", "MDAB_I_TWR",
];

const STATUS = ["PENDING", "APPROVED", "FINISHED"];

const SECTOR_STATUS = [
  "STUP",
  "PUSH",
  "TAXI_DEP",
  "DEP",
  "APP",
  "ARR",
  "TAXI_IN",
  "PARKED",
];



export default function ATCSectorList({
  initialPlans,
  controllerName,
}: {
  initialPlans: FlightPlan[];
  controllerName: string;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [activeSessions, setActiveSessions] = useState<ATCSession[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [position, setPosition] = useState("");
  const [shiftStart, setShiftStart] = useState<Date | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [searchSector, setSearchSector] = useState("");
  const [sectorError, setSectorError] = useState("");

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const filteredPositions = ATC_POSITIONS.filter((sector) =>
    sector.toLowerCase().includes(searchSector.toLowerCase())
  );

  useEffect(() => {
    const savedPosition = localStorage.getItem("pf24_atc_position");
    const savedShift = localStorage.getItem("pf24_atc_shift_start");
    const savedSessionId = localStorage.getItem("pf24_atc_session_id");

    if (savedPosition) setPosition(savedPosition);
    if (savedShift) setShiftStart(new Date(savedShift));
    if (savedSessionId) setSessionId(savedSessionId);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadSessions() {
      const { data, error } = await supabase
        .from("atc_sessions")
        .select("*")
        .eq("is_active", true);

      if (error) {
        console.error(error);
        return;
      }

      setActiveSessions(data ?? []);
    }

    loadSessions();

    const channel = supabase
      .channel("atc-active-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atc_sessions" },
        (payload) => {
          loadSessions();

          const savedSessionId = localStorage.getItem("pf24_atc_session_id");
          const updatedSession = payload.new as ATCSession;

          if (
            savedSessionId &&
            updatedSession?.id === savedSessionId &&
            !updatedSession.is_active
          ) {
            localStorage.removeItem("pf24_atc_position");
            localStorage.removeItem("pf24_atc_shift_start");
            localStorage.removeItem("pf24_atc_session_id");

            setPosition("");
            setShiftStart(null);
            setSessionId(null);
            setOpenId(null);

            alert("Tu sesión ATC fue finalizada.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("atc-sector-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        (payload) => {
          const newPlan = payload.new as FlightPlan;
          const oldPlan = payload.old as FlightPlan;

          if (payload.eventType === "INSERT") {
            if (newPlan.status !== "FINISHED") {
              setPlans((current) => [newPlan, ...current]);
              playTone("traffic");
            }
          }

          if (payload.eventType === "UPDATE") {
            if (
              isEmergencyTransponder(newPlan.transponder) &&
              newPlan.transponder !== oldPlan.transponder
            ) {
              playEmergencyAlarm();
            }

            if (newPlan.status === "FINISHED") {
              setPlans((current) =>
                current.filter((plan) => plan.id !== newPlan.id)
              );
              return;
            }

            setPlans((current) => {
              const exists = current.some((plan) => plan.id === newPlan.id);

              if (!exists) return [newPlan, ...current];

              return current.map((plan) =>
                plan.id === newPlan.id ? newPlan : plan
              );
            });
          }

          if (payload.eventType === "DELETE") {
            setPlans((current) =>
              current.filter((plan) => plan.id !== oldPlan.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function closeShiftOnUnload() {
      const savedSessionId = localStorage.getItem("pf24_atc_session_id");
      const savedPosition = localStorage.getItem("pf24_atc_position");

      if (!savedSessionId) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) return;

      fetch(`${supabaseUrl}/rest/v1/atc_sessions?id=eq.${savedSessionId}`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          is_active: false,
          ended_at: new Date().toISOString(),
        }),
      });

      if (savedPosition) {
        fetch(
          `${supabaseUrl}/rest/v1/flight_plans?assumed_by=eq.${encodeURIComponent(
            savedPosition
          )}&status=neq.FINISHED`,
          {
            method: "PATCH",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              assumed_by: null,
              updated_at: new Date().toISOString(),
            }),
          }
        );
      }

      localStorage.removeItem("pf24_atc_position");
      localStorage.removeItem("pf24_atc_shift_start");
      localStorage.removeItem("pf24_atc_session_id");
    }

    window.addEventListener("pagehide", closeShiftOnUnload);
    window.addEventListener("beforeunload", closeShiftOnUnload);

    return () => {
      window.removeEventListener("pagehide", closeShiftOnUnload);
      window.removeEventListener("beforeunload", closeShiftOnUnload);
    };
  }, []);

  function isEmergencyTransponder(code: string) {
    return code === "7600" || code === "7700";
  }

  function emergencyClass(code: string) {
    return isEmergencyTransponder(code)
      ? "border border-red-400 bg-red-500/20 text-red-300 animate-pulse"
      : "";
  }

  function playEmergencyAlarm() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) return;

      const audio = new AudioContextClass();
      const startTime = audio.currentTime;
      const duration = 5;
      const beepLength = 0.22;
      const gap = 0.38;

      for (let t = 0; t < duration; t += gap) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(880, startTime + t);

        gain.gain.setValueAtTime(0.0001, startTime + t);
        gain.gain.exponentialRampToValueAtTime(0.08, startTime + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          startTime + t + beepLength
        );

        oscillator.start(startTime + t);
        oscillator.stop(startTime + t + beepLength);
      }
    } catch {
      // El sonido no es crítico.
    }
  }

  function playTone(type: "connect" | "disconnect" | "error" | "traffic") {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) return;

      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.connect(gain);
      gain.connect(audio.destination);

      oscillator.type = type === "error" ? "square" : "sine";
      oscillator.frequency.value =
        type === "connect"
          ? 880
          : type === "disconnect"
            ? 440
            : type === "traffic"
              ? 660
              : 220;

      gain.gain.setValueAtTime(0.08, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);

      oscillator.start();
      oscillator.stop(audio.currentTime + 0.25);
    } catch {
      // El sonido no es crítico.
    }
  }

  async function contactPilot(plan: FlightPlan) {
    if (!position) return;

    const frequency = ATC_FREQUENCIES[position];

    if (!frequency) {
      alert(`No hay frecuencia configurada para ${position}.`);
      return;
    }

    const message = `Contacte ${position} en ${frequency}`;

    const { error } = await supabase.from("contact_messages").insert({
      flight_plan_id: plan.id,
      callsign: plan.callsign,
      pilot_id: plan.created_by,
      controller_position: position,
      frequency,
      message,
    });

    if (error) {
      console.error(error);
      alert("No se pudo enviar el Contact Me.");
      return;
    }

    alert(`Mensaje enviado: ${message}`);
  }

  async function selectPosition(value: string) {
    setSectorError("");

    const occupied = activeSessions.find(
      (session) => session.position === value && session.is_active
    );

    if (occupied) {
      setSectorError(`Sector ocupado por ${occupied.controller_name}`);
      playTone("error");
      return;
    }

    const start = new Date();

    const { data, error } = await supabase
      .from("atc_sessions")
      .insert({
        controller_name: controllerName,
        position: value,
        started_at: start.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setSectorError("No se pudo abrir el sector. Puede que ya esté ocupado.");
      playTone("error");
      return;
    }

    setPosition(value);
    setShiftStart(start);
    setSessionId(data.id);

    localStorage.setItem("pf24_atc_position", value);
    localStorage.setItem("pf24_atc_shift_start", start.toISOString());
    localStorage.setItem("pf24_atc_session_id", data.id);

    playTone("connect");
  }

  async function endShift() {
    if (sessionId) {
      await supabase
        .from("atc_sessions")
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    }

    if (position) {
      await supabase
        .from("flight_plans")
        .update({
          assumed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("assumed_by", position)
        .neq("status", "FINISHED");

      await supabase
        .from("atis_messages")
        .delete()
        .eq("created_by", position);
    }

    localStorage.removeItem("pf24_atc_position");
    localStorage.removeItem("pf24_atc_shift_start");
    localStorage.removeItem("pf24_atc_session_id");

    setPosition("");
    setShiftStart(null);
    setSessionId(null);
    setOpenId(null);

    playTone("disconnect");
  }

  function getShiftTime() {
    if (!shiftStart) return "00:00:00";

    const diff = Math.floor((now.getTime() - shiftStart.getTime()) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");

    return `${h}:${m}:${s}`;
  }

  function statusClass(status: string) {
    const styles: Record<string, string> = {
      PENDING: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30",
      APPROVED: "bg-blue-400/15 text-blue-300 border-blue-400/30",
      ACTIVE: "bg-green-400/15 text-green-300 border-green-400/30",
      FINISHED: "bg-slate-400/15 text-slate-300 border-slate-400/30",
      REJECTED: "bg-red-400/15 text-red-300 border-red-400/30",
    };

    return styles[status] ?? "bg-slate-400/15 text-slate-300 border-slate-400/30";
  }

  function sectorClass(status: string) {
    const styles: Record<string, string> = {
      STUP: "bg-slate-400/15 text-slate-300 border-slate-400/30",
      PUSH: "bg-blue-400/15 text-blue-300 border-blue-400/30",
      TAXI_DEP: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30",
      DEP: "bg-green-400/15 text-green-300 border-green-400/30",
      APP: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",
      ARR: "bg-purple-400/15 text-purple-300 border-purple-400/30",
      TAXI_IN: "bg-orange-400/15 text-orange-300 border-orange-400/30",
      PARKED: "bg-zinc-400/15 text-zinc-300 border-zinc-400/30",
    };

    return styles[status] ?? "bg-slate-400/15 text-slate-300 border-slate-400/30";
  }

  function badge(text: string, className: string) {
    return (
      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
        {text}
      </span>
    );
  }

  function canEditPlan(plan: FlightPlan) {
    return plan.assumed_by === position && plan.status !== "FINISHED";
  }

  function generateRandomTransponder() {
    const digits = ["0", "1", "2", "3", "4", "5", "6", "7"];

    return Array.from({ length: 4 }, () => {
      return digits[Math.floor(Math.random() * digits.length)];
    }).join("");
  }

  function autoSave(id: string, field: keyof FlightPlan, value: string) {
    const targetPlan = plans.find((plan) => plan.id === id);

    if (!targetPlan) return;

    if (!canEditPlan(targetPlan)) {
      alert("No puedes modificar este tráfico porque no está asumido por tu sector.");
      return;
    }

    if (field === "transponder" && value === "7500") {
      alert("El código 7500 no está disponible.");
      return;
    }

    setPlans((current) =>
      current.map((plan) =>
        plan.id === id ? { ...plan, [field]: value } : plan
      )
    );

    setSavingId(id);
    clearTimeout(timers.current[`${id}-${field}`]);

    timers.current[`${id}-${field}`] = setTimeout(async () => {
      const { error } = await supabase
        .from("flight_plans")
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("assumed_by", position);

      if (error) {
        console.error(error);
        alert("No se pudo guardar. Puede que el tráfico ya no esté bajo tu sector.");
      }

      setSavingId(null);
    }, 500);
  }

  async function assumeFlight(id: string) {
    if (!position) {
      alert("Selecciona una posición ATC antes de asumir tráfico.");
      return;
    }

    const targetPlan = plans.find((plan) => plan.id === id);

    if (!targetPlan) return;

    if (targetPlan.assumed_by && targetPlan.assumed_by !== position) {
      alert(`Este tráfico ya está asumido por ${targetPlan.assumed_by}.`);
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from("flight_plans")
      .update({
        assumed_by: position,
        status: "PENDING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("assumed_by", null);

    if (error) {
      console.error(error);
      alert("No se pudo asumir el tráfico. Puede que otro sector lo haya asumido.");
    }

    setSavingId(null);
  }

  async function unassumeFlight(id: string) {
    const targetPlan = plans.find((plan) => plan.id === id);

    if (!targetPlan) return;

    if (targetPlan.assumed_by !== position) {
      alert("No puedes desasumir un tráfico que no está asumido por tu sector.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from("flight_plans")
      .update({
        assumed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("assumed_by", position);

    if (error) {
      console.error(error);
      alert("No se pudo desasumir el tráfico.");
    }

    setSavingId(null);
  }

  async function finishFlight(id: string) {
    const targetPlan = plans.find((plan) => plan.id === id);

    if (!targetPlan) return;

    if (targetPlan.assumed_by !== position) {
      alert("No puedes finalizar un tráfico que no está asumido por tu sector.");
      return;
    }

    const confirmed = confirm(`¿Finalizar vuelo ${targetPlan.callsign}?`);

    if (!confirmed) return;

    setSavingId(id);

    const { error } = await supabase
      .from("flight_plans")
      .update({
        status: "FINISHED",
        sector_status: "PARKED",
        assumed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("assumed_by", position);

    if (error) {
      console.error(error);
      alert("No se pudo finalizar el vuelo.");
      setSavingId(null);
      return;
    }

    setPlans((current) => current.filter((plan) => plan.id !== id));
    setOpenId(null);
    setSavingId(null);
  }

  const activeCount = plans.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = plans.filter((p) => p.status === "PENDING").length;
  const assumedCount = plans.filter((p) => p.assumed_by === position).length;
  const totalVisible = plans.length;

  const header = (
    <div className="panel rounded-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={async () => {
            if (position) {
              await endShift();
              return;
            }

            window.location.href = "/dashboard";
          }}
          className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
        >
          ← Regresar
        </button>

        <div className="mono text-sm tracking-[0.25em] text-slate-400">
          PF24
        </div>
      </div>

      <h1 className="mt-4 text-4xl font-extrabold">Sector List</h1>

      {!position && (
        <p className="mt-4 max-w-3xl text-slate-300">
          Selecciona tu posición de control, visualiza planes activos y gestiona
          tráfico con guardado automático en tiempo real.
        </p>
      )}
    </div>
  );

  if (!position) {
    return (
      <>
        {header}

        <div className="mx-auto mt-16 max-w-3xl rounded-3xl border border-sky-500/20 bg-slate-950 p-8">
          <h2 className="text-3xl font-extrabold">Selección de Sector</h2>

          <p className="mt-3 text-slate-400">
            Busca y selecciona la posición ATC que vas a controlar.
          </p>

          <input
            type="text"
            value={searchSector}
            onChange={(e) => setSearchSector(e.target.value)}
            placeholder="Ej: MDPC, EGKK, APP, CTR..."
            className="mt-6 w-full rounded-xl border border-white/10 bg-slate-900 p-4 text-white outline-none focus:border-sky-400"
          />

          {sectorError && (
            <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
              {sectorError}
            </p>
          )}

          <div className="mt-6 max-h-[400px] overflow-y-auto rounded-2xl border border-white/10">
            {filteredPositions.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No se encontró ninguna posición ATC.
              </div>
            ) : (
              filteredPositions.map((sector) => {
                const occupied = activeSessions.find(
                  (session) => session.position === sector && session.is_active
                );

                return (
                  <button
                    key={sector}
                    onClick={() => {
                      if (occupied) {
                        setSectorError(`Sector ocupado por ${occupied.controller_name}`);
                        playTone("error");
                        return;
                      }

                      selectPosition(sector);
                    }}
                    className={`flex w-full items-center justify-between border-b border-white/5 px-5 py-4 text-left transition ${
                      occupied
                        ? "cursor-not-allowed bg-red-500/5 opacity-60"
                        : "hover:bg-sky-500/10"
                    }`}
                  >
                    <span className="font-mono font-bold text-sky-300">
                      {sector}
                    </span>

                    <span className="text-xs text-slate-500">
                      {occupied ? `Ocupado por ${occupied.controller_name}` : "Seleccionar"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="mt-8">
        <div className="mb-6 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-6 md:grid-cols-4">
          <Info label="Controlador" value={controllerName} />
          <Info label="Sector activo" value={position} />
          <Info label="Tiempo en turno" value={getShiftTime()} />
          <Info label="Hora UTC" value={`${now.toISOString().slice(11, 19)}Z`} />
          <Info label="Tráfico asumido" value={String(assumedCount)} />
          <Info label="Pendientes" value={String(pendingCount)} />
          <Info label="Activos" value={String(activeCount)} />
          <Info label="Total visible" value={String(totalVisible)} />

          <div className="md:col-span-4">
            <button
              onClick={endShift}
              className="w-full rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-300 hover:bg-red-500 hover:text-white"
            >
              Terminar turno
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="p-4">CALLSIGN</th>
                  <th className="p-4">A/C</th>
                  <th className="p-4">DEP</th>
                  <th className="p-4">ARR</th>
                  <th className="p-4">RULES</th>
                  <th className="p-4">FL</th>
                  <th className="p-4">XPDR</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4">ESTADO</th>
                  <th className="p-4">SECTOR</th>
                </tr>
              </thead>

              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No hay planes de vuelo visibles.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => {
                    const controlledByMe = plan.assumed_by === position;
                    const controlledByOther =
                      !!plan.assumed_by && plan.assumed_by !== position;
                    const editable = canEditPlan(plan);

                    return (
                      <Fragment key={plan.id}>
                        <tr className="border-t border-white/10">
                          <td className="p-4">
                            <button
                              onClick={() =>
                                setOpenId(openId === plan.id ? null : plan.id)
                              }
                              className="font-bold text-sky-400 hover:underline"
                            >
                              {plan.callsign}
                            </button>
                          </td>

                          <td className="p-4">{plan.aircraft_type}</td>
                          <td className="p-4">{plan.departure_icao}</td>
                          <td className="p-4">{plan.arrival_icao}</td>
                          <td className="p-4">{plan.flight_rules}</td>
                          <td className="p-4">{plan.flight_level}</td>
                          <td className="p-4 font-mono">
                            <span
                              className={`rounded-lg px-2 py-1 ${
                                emergencyClass(plan.transponder)
                              }`}
                            >
                              {plan.transponder}
                            </span>
                          </td>
                          <td className="p-4">
                            {badge(plan.status, statusClass(plan.status))}
                          </td>
                          <td className="p-4">
                            {badge(plan.sector_status, sectorClass(plan.sector_status))}
                          </td>
                          <td className="p-4">{plan.assumed_by ?? "-"}</td>
                        </tr>

                        {openId === plan.id && (
                          <tr className="border-t border-white/10 bg-[#050816]">
                            <td colSpan={10} className="p-6">
                              <div className="grid gap-6 lg:grid-cols-3">
                                <div className="lg:col-span-2">
                                  <h2 className="text-2xl font-extrabold text-sky-400">
                                    {plan.callsign}
                                  </h2>

                                  <p className="mt-2 text-slate-400">
                                    {plan.departure_icao} → {plan.arrival_icao} ·{" "}
                                    {plan.aircraft_type} · {plan.flight_rules}
                                  </p>

                                  <div className="mt-4 flex flex-wrap gap-3">
                                    {badge(plan.status, statusClass(plan.status))}
                                    {badge(plan.sector_status, sectorClass(plan.sector_status))}
                                    {badge(
                                      plan.assumed_by
                                        ? `Controlado por ${plan.assumed_by}`
                                        : "Sin asumir",
                                      controlledByMe
                                        ? "bg-green-400/10 text-green-300 border-green-400/30"
                                        : controlledByOther
                                          ? "bg-red-400/10 text-red-300 border-red-400/30"
                                          : "bg-white/10 text-white border-white/20"
                                    )}
                                    {badge(
                                      `XPDR ${plan.transponder}`,
                                      isEmergencyTransponder(plan.transponder)
                                        ? "bg-red-500/20 text-red-300 border-red-400 animate-pulse"
                                        : "bg-sky-400/10 text-sky-300 border-sky-400/30"
                                    )}
                                  </div>

                                  {controlledByOther && (
                                    <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
                                      Este tráfico está asumido por {plan.assumed_by}.
                                      No puedes modificarlo ni desasumirlo.
                                    </p>
                                  )}

                                  {!plan.assumed_by && (
                                    <p className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-300">
                                      Este tráfico aún no está asumido.
                                    </p>
                                  )}

                                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                                    <Field label="Transponder">
                                      <input
                                        value={plan.transponder}
                                        maxLength={4}
                                        disabled={!editable}
                                        onChange={(e) => {
                                          const value = e.target.value
                                            .replace(/[^0-7]/g, "")
                                            .slice(0, 4);

                                          setPlans((current) =>
                                            current.map((p) =>
                                              p.id === plan.id
                                                ? { ...p, transponder: value }
                                                : p
                                            )
                                          );

                                          if (value === "7500") {
                                            alert("El código 7500 no está disponible.");
                                            return;
                                          }

                                          if (value.length === 4) {
                                            autoSave(plan.id, "transponder", value);
                                          }
                                        }}
                                        className={`w-full rounded-xl bg-slate-800 p-3 font-mono disabled:cursor-not-allowed disabled:opacity-50 ${
                                          emergencyClass(plan.transponder)
                                        }`}
                                      />
                                    </Field>

                                    <Field label="Flight Level">
                                      <input
                                        value={plan.flight_level}
                                        disabled={!editable}
                                        onChange={(e) =>
                                          autoSave(
                                            plan.id,
                                            "flight_level",
                                            e.target.value.toUpperCase()
                                          )
                                        }
                                        className="w-full rounded-xl bg-slate-800 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </Field>

                                    <Field label="Status">
                                      <select
                                        value={plan.status}
                                        disabled={!editable}
                                        onChange={(e) => {
                                          const newStatus = e.target.value;

                                          if (newStatus === "FINISHED") {
                                            const confirmed = confirm(`¿Finalizar vuelo ${plan.callsign}?`);

                                            if (!confirmed) {
                                              return;
                                            }

                                            autoSave(plan.id, "sector_status", "PARKED");
                                            autoSave(plan.id, "assumed_by", "");
                                          }

                                          autoSave(plan.id, "status", newStatus);
                                        }}
                                        className="w-full rounded-xl bg-slate-800 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {STATUS.map((status) => (
                                          <option key={status} value={status}>
                                            {status}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>

                                    <Field label="Sector Status">
                                      <select
                                        value={plan.sector_status}
                                        disabled={!editable}
                                        onChange={(e) =>
                                          autoSave(
                                            plan.id,
                                            "sector_status",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-xl bg-slate-800 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {SECTOR_STATUS.map((status) => (
                                          <option key={status} value={status}>
                                            {status}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>

                                    <Field label="Ruta">
                                      <input
                                        value={plan.route}
                                        disabled={!editable}
                                        onChange={(e) =>
                                          autoSave(
                                            plan.id,
                                            "route",
                                            e.target.value.toUpperCase()
                                          )
                                        }
                                        className="w-full rounded-xl bg-slate-800 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </Field>

                                    <Field label="Sector asignado">
                                      <input
                                        value={plan.assumed_by ?? ""}
                                        disabled
                                        className="w-full cursor-not-allowed rounded-xl bg-slate-800 p-3 opacity-60"
                                      />
                                    </Field>
                                  </div>

                                  <Field label="Notas adicionales">
                                    <textarea
                                      value={plan.notes ?? ""}
                                      disabled={!editable}
                                      onChange={(e) =>
                                        autoSave(plan.id, "notes", e.target.value)
                                      }
                                      className="mt-2 w-full rounded-xl bg-slate-800 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                  </Field>
                                </div>

                                <aside className="rounded-3xl border border-white/10 bg-slate-900 p-6">
                                  <h3 className="text-xl font-bold">Acciones ATC</h3>

                                  <div className="mt-5 grid gap-3">
                                    <button
                                      onClick={() => assumeFlight(plan.id)}
                                      disabled={controlledByOther || controlledByMe}
                                      className="rounded-xl bg-sky-500 px-4 py-3 font-semibold hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {controlledByMe
                                        ? "Asumido por tu sector"
                                        : controlledByOther
                                          ? `Ocupado por ${plan.assumed_by}`
                                          : `Asumir con ${position}`}
                                    </button>

                                    <button
                                      onClick={() => unassumeFlight(plan.id)}
                                      disabled={!controlledByMe}
                                      className="rounded-xl border border-yellow-400 px-4 py-3 font-semibold text-yellow-300 hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-yellow-300"
                                    >
                                      Desasumir
                                    </button>

                                    <button
                                      onClick={() =>
                                        autoSave(plan.id, "transponder", generateRandomTransponder())
                                      }
                                      disabled={!editable}
                                      className="rounded-xl border border-sky-400 px-4 py-3 font-semibold text-sky-300 hover:bg-sky-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-sky-300"
                                    >
                                      Generar XPDR
                                    </button>

                                    <button
                                      onClick={() => {
                                        const emergencyCode = prompt(
                                          "Selecciona el tipo de emergencia:\n\n7600 - Falla de comunicaciones\n7700 - Emergencia general\n\nEscribe 7600 o 7700:"
                                        );

                                        if (
                                          emergencyCode !== "7600" &&
                                          emergencyCode !== "7700"
                                        ) {
                                          alert("Código de emergencia inválido.");
                                          return;
                                        }

                                        autoSave(plan.id, "transponder", emergencyCode);
                                      }}
                                      disabled={!editable}
                                      className="rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-300 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-red-300"
                                    >
                                      Declarar emergencia
                                    </button>

                                    <button
                                      onClick={() => contactPilot(plan)}
                                      disabled={!controlledByMe}
                                      className="rounded-xl border border-green-400 px-4 py-3 font-semibold text-green-300 hover:bg-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-green-300"
                                    >
                                      Contact Me
                                    </button>

                                  </div>


                                  <p className="mt-6 text-sm text-slate-400">
                                    {savingId === plan.id
                                      ? "Guardando cambios..."
                                      : editable
                                        ? "Guardado automático activo"
                                        : "Solo lectura"}
                                  </p>
                                </aside>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
          </div>

          <aside className="grid gap-6 self-start">
            <AtisCreator controllerPosition={position} />
            <LatestAtisPanel showAlerts={false} />
          </aside>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050816] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}