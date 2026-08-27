"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { APPROACHES, type ApproachMode } from "@/lib/pfpilot/approaches";
import {
  getPFPilotProcedureSelection,
  setPFPilotProcedureSelectionInNotes,
  type PFPilotProcedureSelection,
} from "@/lib/pfpilot/procedureSelection";
import { PROCEDURES } from "@/lib/pfpilot/procedures";
import { supabase } from "@/lib/supabase";

type PilotPlan = {
  id: string;
  callsign?: string;
  departure_icao?: string;
  arrival_icao?: string;
  notes?: string | null;
  status?: string;
  [key: string]: unknown;
};

type ApproachChoice = {
  token: string;
  label: string;
};

function airport(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function procedureLabel(code: string, runway: string, chart: string) {
  return `${code} · RWY ${runway} · ${chart}`;
}

function approachModeLabel(mode: ApproachMode) {
  if (mode === "RNAV") return "RNAV (GNSS)";
  if (mode === "LOC") return "LOC (GS OUT)";
  return "ILS";
}

export default function PFPilotProcedureLoader({
  plan,
  pilotId,
}: {
  plan: PilotPlan | null;
  pilotId: string;
}) {
  const initialSelection = useMemo(
    () => getPFPilotProcedureSelection(plan?.notes),
    [plan?.id, plan?.notes],
  );
  const [draft, setDraft] = useState<PFPilotProcedureSelection>(initialSelection);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setDraft(initialSelection);
    setMessage("");
  }, [initialSelection.sid, initialSelection.star, initialSelection.approach, plan?.id]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
      .flatMap((item) => item.approach.modes.map((mode) => {
        const token = item.approach.modeTokens[mode]?.[0] ?? item.code;
        return {
          token,
          label: `${approachModeLabel(mode)} RWY ${item.runway} · ${item.chart}`,
        };
      })),
    [arrival],
  );

  const dirty =
    draft.sid !== initialSelection.sid ||
    draft.star !== initialSelection.star ||
    draft.approach !== initialSelection.approach;
  const loadedCount = [initialSelection.sid, initialSelection.star, initialSelection.approach].filter(Boolean).length;

  async function saveSelection(nextSelection = draft) {
    if (!plan?.id || saving) return;
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
      setMessage("No se pudo leer el plan de vuelo activo.");
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

  if (!plan || !mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] rounded-2xl border border-sky-400/60 bg-[#061325]/95 px-5 py-3 text-left shadow-[0_12px_45px_rgba(0,0,0,0.55),0_0_24px_rgba(56,189,248,0.12)] backdrop-blur transition hover:border-sky-300"
        aria-label="Abrir carga de procedimientos"
      >
        <span className="mono block text-[10px] tracking-[0.18em] text-sky-300/70">PFPILOT</span>
        <span className="mono mt-1 block text-xs font-extrabold text-sky-100">PROCEDURES</span>
        <span className="mt-1 block text-[10px] text-slate-500">{loadedCount}/3 cargados · editar</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/75 p-4 pt-8 backdrop-blur-sm sm:p-8">
          <button
            type="button"
            aria-label="Cerrar procedimientos"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />

          <section className="panel relative z-[81] w-full max-w-5xl rounded-3xl p-5 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="mono text-xs tracking-[0.22em] text-sky-300/70">PFPILOT</p>
                <h2 className="mt-1 text-2xl font-extrabold text-white">PROCEDURES</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Carga o edita SID, STAR y aproximación sin modificar la ruta enroute del FPL.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-right">
                  <p className="mono text-[9px] text-slate-600">ACTIVE FLIGHT</p>
                  <p className="mono mt-1 text-sm font-bold text-sky-300">{String(plan.callsign ?? "----").toUpperCase()}</p>
                  <p className="mono mt-1 text-[10px] text-slate-500">{departure || "----"} → {arrival || "----"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 mono text-sm text-slate-400 hover:border-sky-400/40 hover:text-sky-200"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <ProcedureSelect
                label="SID"
                airportLabel={departure}
                value={draft.sid}
                placeholder={sidChoices.length ? "Sin SID seleccionada" : `No hay SID cargadas para ${departure || "salida"}`}
                options={sidChoices.map((item) => ({
                  value: item.code,
                  label: procedureLabel(item.code, item.runway, item.chart),
                }))}
                onChange={(sid) => setDraft((current) => ({ ...current, sid }))}
              />
              <ProcedureSelect
                label="STAR"
                airportLabel={arrival}
                value={draft.star}
                placeholder={starChoices.length ? "Sin STAR seleccionada" : `No hay STAR cargadas para ${arrival || "llegada"}`}
                options={starChoices.map((item) => ({
                  value: item.code,
                  label: procedureLabel(item.code, item.runway, item.chart),
                }))}
                onChange={(star) => setDraft((current) => ({ ...current, star }))}
              />
              <ProcedureSelect
                label="APPROACH"
                airportLabel={arrival}
                value={draft.approach}
                placeholder={approachChoices.length ? "Sin aproximación seleccionada" : `No hay aproximaciones cargadas para ${arrival || "llegada"}`}
                options={approachChoices.map((item) => ({ value: item.token, label: item.label }))}
                onChange={(approach) => setDraft((current) => ({ ...current, approach }))}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <SelectedProcedure label="SID" value={draft.sid} />
                <SelectedProcedure label="STAR" value={draft.star} />
                <SelectedProcedure label="APPR" value={draft.approach} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={saving}
                  className="rounded-xl border border-white/10 bg-[#020617] px-4 py-3 mono text-xs font-bold text-slate-400 hover:text-slate-200 disabled:opacity-40"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => void saveSelection()}
                  disabled={saving || !dirty}
                  className="rounded-xl border border-sky-400/50 bg-sky-400/10 px-5 py-3 mono text-xs font-extrabold text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {saving ? "SAVING..." : "SAVE PROCEDURES"}
                </button>
              </div>
            </div>

            {message && <p className="mt-3 text-xs text-sky-300">{message}</p>}
          </section>
        </div>
      )}
    </>,
    document.body,
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
    <label className="rounded-2xl border border-white/10 bg-slate-950 p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="mono text-xs font-bold text-slate-300">{label}</span>
        <span className="mono text-[10px] text-slate-600">{airportLabel || "----"}</span>
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mono mt-3 w-full rounded-xl border border-white/10 bg-[#020617] px-3 py-3 text-xs font-bold text-slate-200 outline-none focus:border-sky-400/60"
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
    <div>
      <p className="mono text-[9px] text-slate-600">{label}</p>
      <p className="mono mt-1 text-xs font-bold text-sky-300">{value || "NONE"}</p>
    </div>
  );
}
