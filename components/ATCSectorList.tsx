"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const STATUS = ["PENDING", "APPROVED", "ACTIVE", "FINISHED", "REJECTED"];

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [position, setPosition] = useState("");
  const [shiftStart, setShiftStart] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [searchSector, setSearchSector] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ATCSession[]>([]);
const [sectorError, setSectorError] = useState("");

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const filteredPositions = ATC_POSITIONS.filter((sector) =>
    sector.toLowerCase().includes(searchSector.toLowerCase())
  );

  useEffect(() => {
    const savedPosition = localStorage.getItem("pf24_atc_position");
    const savedShift = localStorage.getItem("pf24_atc_shift_start");
    const savedSessionId = localStorage.getItem("pf24_atc_session_id");

    if (savedSessionId) setSessionId(savedSessionId);
    if (savedPosition) setPosition(savedPosition);
    if (savedShift) setShiftStart(new Date(savedShift));
  }, []);

  useEffect(() => {
    function closeShiftOnUnload() {
        const savedSessionId = localStorage.getItem("pf24_atc_session_id");

        if (!savedSessionId) return;

        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/atc_sessions?id=eq.${savedSessionId}`;

        navigator.sendBeacon(
        url,
        new Blob(
            [
            JSON.stringify({
                is_active: false,
                ended_at: new Date().toISOString(),
            }),
            ],
            {
            type: "application/json",
            }
        )
        );

        localStorage.removeItem("pf24_atc_position");
        localStorage.removeItem("pf24_atc_shift_start");
        localStorage.removeItem("pf24_atc_session_id");
    }

    window.addEventListener("beforeunload", closeShiftOnUnload);

    return () => {
        window.removeEventListener("beforeunload", closeShiftOnUnload);
    };
    }, []);
  
  useEffect(() => {
    async function loadSessions() {
        const { data } = await supabase
        .from("atc_sessions")
        .select("*")
        .eq("is_active", true);

        setActiveSessions(data ?? []);
    }

    loadSessions();

    const channel = supabase
        .channel("atc-active-sessions")
        .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atc_sessions" },
        () => loadSessions()
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
    }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
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
            setPlans((current) => [newPlan, ...current]);
          }

          if (payload.eventType === "UPDATE") {
            setPlans((current) =>
              current.map((plan) => (plan.id === newPlan.id ? newPlan : plan))
            );
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

async function selectPosition(value: string) {
  setSectorError("");

  const occupied = activeSessions.find(
    (session) => session.position === value && session.is_active
  );

  if (occupied) {
    setSectorError(`Sector ocupado por ${occupied.controller_name}`);
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
    return;
  }

  setPosition(value);
  setShiftStart(start);
  setSessionId(data.id);

  localStorage.setItem("pf24_atc_position", value);
  localStorage.setItem("pf24_atc_shift_start", start.toISOString());
  localStorage.setItem("pf24_atc_session_id", data.id);
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

  localStorage.removeItem("pf24_atc_position");
  localStorage.removeItem("pf24_atc_shift_start");
  localStorage.removeItem("pf24_atc_session_id");

  setPosition("");
  setShiftStart(null);
  setSessionId(null);
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

  function autoSave(id: string, field: keyof FlightPlan, value: string) {
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
        .eq("id", id);

      if (error) console.error(error);
      setSavingId(null);
    }, 500);
  }

  async function assumeFlight(id: string) {
    if (!position) {
      alert("Selecciona una posición ATC antes de asumir tráfico.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from("flight_plans")
      .update({
        assumed_by: position,
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) console.error(error);
    setSavingId(null);
  }

  async function unassumeFlight(id: string) {
    setSavingId(id);

    const { error } = await supabase
      .from("flight_plans")
      .update({
        assumed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) console.error(error);
    setSavingId(null);
  }

  const activeCount = plans.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = plans.filter((p) => p.status === "PENDING").length;
  const assumedCount = plans.filter((p) => p.assumed_by === position).length;
  const totalVisible = plans.length;

  if (!position) {
    return (
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

        <div className="mt-6 max-h-[400px] overflow-y-auto rounded-2xl border border-white/10">
          {filteredPositions.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              No se encontró ninguna posición ATC.
            </div>
          ) : (
            filteredPositions.map((sector) => (
              <button
                key={sector}
                onClick={() => selectPosition(sector)}
                className="flex w-full items-center justify-between border-b border-white/5 px-5 py-4 text-left transition hover:bg-sky-500/10"
              >
                <span className="font-mono font-bold text-sky-300">
                  {sector}
                </span>

                <span className="text-xs text-slate-500">
                  Seleccionar
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

filteredPositions.map((sector) => {
  const occupied = activeSessions.find(
    (session) => session.position === sector && session.is_active
  );

  return (
    <button
      key={sector}
      onClick={() => {
        if (!occupied) selectPosition(sector);
      }}
      disabled={!!occupied}
      className={`flex w-full items-center justify-between border-b border-white/5 px-5 py-4 text-left transition ${
        occupied
          ? "cursor-not-allowed opacity-50"
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

{sectorError && (
  <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
    {sectorError}
  </p>
)}

  return (
    <div className="mt-8">
      <div className="mb-6 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-6 md:grid-cols-4">
        <Info label="Controlador" value={controllerName} />
        <Info label="Sector activo" value={position} />
        <Info label="Tiempo en turno" value={getShiftTime()} />
        <Info label="Hora UTC" value={now.toISOString().slice(11, 19)} />
        <Info label="Tráfico asumido" value={String(assumedCount)} />
        <Info label="Pendientes" value={String(pendingCount)} />
        <Info label="Activos" value={String(activeCount)} />
        <Info label="Total visible" value={String(totalVisible)} />

        <button
        onClick={endShift}
        className="mt-3 w-full rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-300 hover:bg-red-500 hover:text-white"
        >
        Terminar turno
        </button>

      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
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
                <th className="p-4">SECTOR</th>
                <th className="p-4">ATC</th>
              </tr>
            </thead>

            <tbody>
              {plans.map((plan) => (
                <>
                  <tr key={plan.id} className="border-t border-white/10">
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
                    <td className="p-4 font-mono">{plan.transponder}</td>
                    <td className="p-4">{badge(plan.status, statusClass(plan.status))}</td>
                    <td className="p-4">{badge(plan.sector_status, sectorClass(plan.sector_status))}</td>
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
                                "bg-white/10 text-white border-white/20"
                              )}
                              {badge(
                                `XPDR ${plan.transponder}`,
                                "bg-sky-400/10 text-sky-300 border-sky-400/30"
                              )}
                            </div>

                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                              <Field label="Transponder">
                                <input
                                  value={plan.transponder}
                                  maxLength={4}
                                  onChange={(e) =>
                                    autoSave(plan.id, "transponder", e.target.value)
                                  }
                                  className="w-full rounded-xl bg-slate-800 p-3 font-mono"
                                />
                              </Field>

                              <Field label="Flight Level">
                                <input
                                  value={plan.flight_level}
                                  onChange={(e) =>
                                    autoSave(
                                      plan.id,
                                      "flight_level",
                                      e.target.value.toUpperCase()
                                    )
                                  }
                                  className="w-full rounded-xl bg-slate-800 p-3"
                                />
                              </Field>

                              <Field label="Status">
                                <select
                                  value={plan.status}
                                  onChange={(e) =>
                                    autoSave(plan.id, "status", e.target.value)
                                  }
                                  className="w-full rounded-xl bg-slate-800 p-3"
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
                                  onChange={(e) =>
                                    autoSave(
                                      plan.id,
                                      "sector_status",
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-xl bg-slate-800 p-3"
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
                                  onChange={(e) =>
                                    autoSave(
                                      plan.id,
                                      "route",
                                      e.target.value.toUpperCase()
                                    )
                                  }
                                  className="w-full rounded-xl bg-slate-800 p-3"
                                />
                              </Field>

                              <Field label="Sector asignado">
                                <input
                                  value={plan.assumed_by ?? ""}
                                  onChange={(e) =>
                                    autoSave(plan.id, "assumed_by", e.target.value)
                                  }
                                  className="w-full rounded-xl bg-slate-800 p-3"
                                />
                              </Field>
                            </div>

                            <Field label="Notas adicionales">
                              <textarea
                                value={plan.notes ?? ""}
                                onChange={(e) =>
                                  autoSave(plan.id, "notes", e.target.value)
                                }
                                className="mt-2 w-full rounded-xl bg-slate-800 p-3"
                              />
                            </Field>
                          </div>

                          <aside className="rounded-3xl border border-white/10 bg-slate-900 p-6">
                            <h3 className="text-xl font-bold">Acciones ATC</h3>

                            <div className="mt-5 grid gap-3">
                              <button
                                onClick={() => assumeFlight(plan.id)}
                                className="rounded-xl bg-sky-500 px-4 py-3 font-semibold hover:bg-sky-400"
                              >
                                {plan.assumed_by
                                  ? `Reasumir con ${position}`
                                  : `Asumir con ${position}`}
                              </button>

                              <button
                                onClick={() => unassumeFlight(plan.id)}
                                className="rounded-xl border border-yellow-400 px-4 py-3 font-semibold text-yellow-300 hover:bg-yellow-400 hover:text-black"
                              >
                                Desasumir
                              </button>

                              <button
                                onClick={() =>
                                  autoSave(plan.id, "transponder", "7700")
                                }
                                className="rounded-xl border border-red-400 px-4 py-3 font-semibold text-red-300 hover:bg-red-500 hover:text-white"
                              >
                                Declarar 7700
                              </button>

                              <button
                                onClick={() =>
                                  autoSave(plan.id, "status", "FINISHED")
                                }
                                className="rounded-xl border border-white/10 px-4 py-3 font-semibold text-slate-300 hover:bg-white/10"
                              >
                                Finalizar vuelo
                              </button>
                            </div>

                            <p className="mt-6 text-sm text-slate-400">
                              {savingId === plan.id
                                ? "Guardando cambios..."
                                : "Guardado automático activo"}
                            </p>
                          </aside>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
  children: React.ReactNode;
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