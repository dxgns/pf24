"use client";

import { useEffect, useMemo, useState } from "react";
import { APPROACHES, type ApproachMode } from "@/lib/pfpilot/approaches";
import {
  getPFPilotProcedureSelection,
  setPFPilotProcedureSelectionInNotes,
  type PFPilotProcedureSelection,
} from "@/lib/pfpilot/procedureSelection";
import { PROCEDURES } from "@/lib/pfpilot/procedures";
import { WAYPOINTS } from "@/lib/scope/mapData";
import { supabase } from "@/lib/supabase";

type PilotPlan = {
  id: string;
  callsign?: string;
  departure_icao?: string;
  arrival_icao?: string;
  route?: string;
  notes?: string | null;
  status?: string;
  [key: string]: unknown;
};

type ApproachChoice = {
  token: string;
  label: string;
};

const NAV_WAYPOINT_NAMES = new Set(WAYPOINTS.map((point) => point.name.toUpperCase()));

function airport(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeRoute(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function routeTokens(value: unknown) {
  return normalizeRoute(value)
    .split(" ")
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
}

function procedureLabel(code: string, runway: string) {
  return `${code} · RWY ${runway}`;
}

function approachModeLabel(mode: ApproachMode) {
  if (mode === "RNAV") return "RNAV (GNSS)";
  if (mode === "LOC") return "LOC (GS OUT)";
  return "ILS";
}

export default function PFPilotAutopilotProcedures({
  plan,
  pilotId,
}: {
  plan: PilotPlan | null;
  pilotId: string | null | undefined;
}) {
  const initialSelection = useMemo(
    () => getPFPilotProcedureSelection(plan?.notes),
    [plan?.id, plan?.notes],
  );
  const initialRoute = useMemo(
    () => normalizeRoute(plan?.route),
    [plan?.id, plan?.route],
  );
  const [draft, setDraft] = useState<PFPilotProcedureSelection>(initialSelection);
  const [routeDraft, setRouteDraft] = useState(initialRoute);
  const [saving, setSaving] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [routeMessage, setRouteMessage] = useState("");

  useEffect(() => {
    setDraft(initialSelection);
    setMessage("");
  }, [initialSelection.sid, initialSelection.star, initialSelection.approach, plan?.id]);

  useEffect(() => {
    setRouteDraft(initialRoute);
  }, [initialRoute, plan?.id]);

  useEffect(() => {
    setRouteMessage("");
  }, [plan?.id]);

  const departure = airport(plan?.departure_icao);
  const arrival = airport(plan?.arrival_icao);

  const sidChoices = useMemo(
    () => PROCEDURES.filter((item) => item.kind === "SID" && item.airport === departure),
    [departure],
  );
  const starChoices = useMemo(
    () => PROCEDURES.filter((item) => item.kind === "STAR" && item.airport === arrival),
    [arrival],
  );
  const approachChoices = useMemo<ApproachChoice[]>(
    () => APPROACHES
      .filter((item) => item.airport === arrival)
      .flatMap((item) => item.approach.modes.map((mode) => ({
        token: item.approach.modeTokens[mode]?.[0] ?? item.code,
        label: `${approachModeLabel(mode)} · RWY ${item.runway}`,
      }))),
    [arrival],
  );

  const dirty =
    draft.sid !== initialSelection.sid ||
    draft.star !== initialSelection.star ||
    draft.approach !== initialSelection.approach;
  const normalizedRouteDraft = normalizeRoute(routeDraft);
  const routeDirty = normalizedRouteDraft !== initialRoute;
  const navigationPoints = useMemo(
    () => routeTokens(routeDraft).filter((token) => NAV_WAYPOINT_NAMES.has(token)),
    [routeDraft],
  );

  async function saveRoute() {
    if (!plan?.id || !pilotId || routeSaving) return;
    const cleanRoute = normalizeRoute(routeDraft);
    if (!cleanRoute) {
      setRouteMessage("La ruta no puede quedar vacía.");
      return;
    }

    setRouteSaving(true);
    setRouteMessage("");

    const { error } = await supabase
      .from("flight_plans")
      .update({ route: cleanRoute, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("created_by", pilotId)
      .neq("status", "FINISHED");

    if (error) {
      console.error("PFPilot route save failed:", error);
      setRouteMessage("No se pudo guardar la ruta.");
    } else {
      setRouteDraft(cleanRoute);
      setRouteMessage("Ruta actualizada. Guidance recargado con la nueva secuencia.");
    }
    setRouteSaving(false);
  }

  async function saveSelection(nextSelection = draft) {
    if (!plan?.id || !pilotId || saving) return;
    setSaving(true);
    setMessage("");

    const { data, error: readError } = await supabase
      .from("flight_plans")
      .select("notes")
      .eq("id", plan.id)
      .eq("created_by", pilotId)
      .neq("status", "FINISHED")
      .maybeSingle();

    if (readError || !data) {
      console.error("PFPilot procedure selection read failed:", readError);
      setMessage("No se pudo leer el FPL activo.");
      setSaving(false);
      return;
    }

    const notes = setPFPilotProcedureSelectionInNotes(data.notes, nextSelection);
    const { error } = await supabase
      .from("flight_plans")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("created_by", pilotId)
      .neq("status", "FINISHED");

    if (error) {
      console.error("PFPilot procedure selection save failed:", error);
      setMessage("No se pudieron guardar los procedimientos.");
    } else {
      setDraft(nextSelection);
      setMessage("Procedimientos actualizados.");
    }
    setSaving(false);
  }

  function clearAll() {
    const empty = { sid: "", star: "", approach: "" };
    setDraft(empty);
    void saveSelection(empty);
  }

  if (!plan) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="mono text-xs text-slate-500">FLIGHT NAVIGATION</p>
          <p className="mt-1 text-sm text-slate-400">Ruta enroute y procedimientos del vuelo.</p>
        </div>
        <div className="text-right">
          <p className="mono text-xs font-bold text-sky-300">{String(plan.callsign ?? "----").toUpperCase()}</p>
          <p className="mono mt-1 text-[10px] text-slate-600">{departure || "----"} → {arrival || "----"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-[#020617] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mono text-[10px] font-bold text-slate-300">ROUTE NAVIGATION</p>
            <p className="mt-1 text-[11px] text-slate-500">Edita la secuencia enroute que usa el Guidance.</p>
          </div>
          <span className="mono text-[9px] text-sky-300/80">{navigationPoints.length} NAV PTS</span>
        </div>

        <textarea
          value={routeDraft}
          onChange={(event) => setRouteDraft(event.target.value.toUpperCase())}
          rows={3}
          spellCheck={false}
          className="mono mt-3 w-full resize-y rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-[11px] font-bold leading-5 text-slate-200 outline-none focus:border-sky-400/60"
          placeholder="DCT / WAYPOINTS / AIRWAYS"
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {navigationPoints.length > 0 ? navigationPoints.map((point, index) => (
            <span
              key={`${point}-${index}`}
              className="rounded-md border border-sky-400/20 bg-sky-400/5 px-2 py-1 mono text-[9px] font-bold text-sky-300"
            >
              {point}
            </span>
          )) : (
            <span className="text-[10px] text-amber-300/80">No hay waypoints del mapa reconocidos en esta ruta.</span>
          )}
        </div>

        <p className="mt-2 text-[9px] leading-4 text-slate-600">
          PFPilot sigue los waypoints reconocidos en el orden escrito. SID, STAR y aproximación se cargan por separado abajo.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRouteDraft(initialRoute);
              setRouteMessage("");
            }}
            disabled={routeSaving || !routeDirty}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 mono text-[10px] font-bold text-slate-400 disabled:opacity-35"
          >
            RESET
          </button>
          <button
            type="button"
            onClick={() => void saveRoute()}
            disabled={routeSaving || !routeDirty || !pilotId}
            className="flex-1 rounded-xl border border-sky-400/50 bg-sky-400/10 px-3 py-2 mono text-[10px] font-extrabold text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {routeSaving ? "SAVING..." : "SAVE ROUTE"}
          </button>
        </div>

        {routeMessage && <p className="mt-3 text-xs text-sky-300">{routeMessage}</p>}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div>
          <p className="mono text-[10px] font-bold text-slate-300">PROCEDURES</p>
          <p className="mt-1 text-[11px] text-slate-500">Carga y edita SID, STAR y aproximación.</p>
        </div>

        <div className="mt-3 space-y-3">
          <ProcedureSelect
            label="SID"
            airportLabel={departure}
            value={draft.sid}
            placeholder={sidChoices.length ? "Sin SID" : "No disponible"}
            options={sidChoices.map((item) => ({ value: item.code, label: procedureLabel(item.code, item.runway) }))}
            onChange={(sid) => setDraft((current) => ({ ...current, sid }))}
          />
          <ProcedureSelect
            label="STAR"
            airportLabel={arrival}
            value={draft.star}
            placeholder={starChoices.length ? "Sin STAR" : "No disponible"}
            options={starChoices.map((item) => ({ value: item.code, label: procedureLabel(item.code, item.runway) }))}
            onChange={(star) => setDraft((current) => ({ ...current, star }))}
          />
          <ProcedureSelect
            label="APPROACH"
            airportLabel={arrival}
            value={draft.approach}
            placeholder={approachChoices.length ? "Sin aproximación" : "No disponible"}
            options={approachChoices.map((item) => ({ value: item.token, label: item.label }))}
            onChange={(approach) => setDraft((current) => ({ ...current, approach }))}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SelectedProcedure label="SID" value={draft.sid} />
          <SelectedProcedure label="STAR" value={draft.star} />
          <SelectedProcedure label="APPR" value={draft.approach} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={clearAll}
            disabled={saving || !pilotId}
            className="rounded-xl border border-white/10 bg-[#020617] px-3 py-2 mono text-[10px] font-bold text-slate-400 disabled:opacity-35"
          >
            CLEAR
          </button>
          <button
            type="button"
            onClick={() => void saveSelection()}
            disabled={saving || !dirty || !pilotId}
            className="flex-1 rounded-xl border border-sky-400/50 bg-sky-400/10 px-3 py-2 mono text-[10px] font-extrabold text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {saving ? "SAVING..." : "SAVE PROCEDURES"}
          </button>
        </div>

        {message && <p className="mt-3 text-xs text-sky-300">{message}</p>}
      </div>

      {!pilotId && <p className="mt-3 text-xs text-amber-300">No se pudo validar el propietario del FPL.</p>}
    </section>
  );
}

function ProcedureSelect({
  label,
  airportLabel,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  airportLabel: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-xl border border-white/10 bg-[#020617] p-3">
      <span className="flex items-center justify-between gap-3">
        <span className="mono text-[10px] font-bold text-slate-300">{label}</span>
        <span className="mono text-[9px] text-slate-600">{airportLabel || "----"}</span>
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mono mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-[11px] font-bold text-slate-200 outline-none focus:border-sky-400/60"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SelectedProcedure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#020617] p-2 text-center">
      <p className="mono text-[8px] text-slate-600">{label}</p>
      <p className="mono mt-1 truncate text-[10px] font-bold text-sky-300">{value || "NONE"}</p>
    </div>
  );
}
