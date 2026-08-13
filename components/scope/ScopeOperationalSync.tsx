"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type LivePlan = ScopeFlightPlan & {
  created_at?: string | null;
  updated_at?: string | null;
};

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  is_active: boolean;
};

type ListKey = "sector" | "taxi" | "freq";
type Visibility = Record<ListKey, boolean>;
type Phase = "dep" | "arr";
type Popup =
  | { type: "status"; planId: string }
  | { type: "runway"; planId: string }
  | { type: "procs"; planId: string }
  | { type: "assr"; planId: string }
  | null;

type LocalPlanControls = {
  c?: boolean;
  depRunway?: string;
  arrRunway?: string;
  depProc?: string;
  arrProc?: string;
};

type ControlMap = Record<string, LocalPlanControls>;

const MENU_VISIBILITY_KEY = "pf24_scope_menu_visibility_v1";
const SECTOR_CONTROLS_KEY = "pf24_scope_sector_controls_v1";
const CALLSIGNS = Object.keys(ATC_FREQUENCIES).sort();
const WINDOW_TITLES: Record<ListKey, string> = {
  sector: "SECTOR LIST",
  taxi: "COMBINED TAXI LIST",
  freq: "FREQ",
};

const STATUS_SEQUENCE = [
  "STUP",
  "PUSH",
  "TAXI_DEP",
  "DEP",
  "APP",
  "ARR",
  "TAXI_IN",
  "PARKED",
] as const;

const RUNWAYS: Record<string, string[]> = {
  EFKT: ["16", "34"],
  EGHI: ["20", "02"],
  EGKK: ["26L", "08R"],
  GCLP: ["03L", "03R", "21L", "21R"],
  LCLK: ["22", "04"],
  LCPH: ["11", "29"],
  LCRA: ["10", "28"],
  LEMH: ["19", "01"],
  MDAB: ["11", "29"],
  MDCR: ["12", "30"],
  MDPC: ["26", "27", "08", "09"],
  MDST: ["11", "29"],
  MTCA: ["26", "08"],
};

const SECTOR_GRID = "grid-cols-[50px_38px_25px_39px_39px_31px_29px_1fr_40px_31px_18px]";

function findScopeWindow(title: string): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"));
  const normalized = title.toUpperCase();
  return windows.find((element) => element.firstElementChild?.textContent?.toUpperCase().includes(normalized)) ?? null;
}

function findWindowBody(title: string): HTMLElement | null {
  const win = findScopeWindow(title);
  const body = win?.children[1];
  return body instanceof HTMLElement ? body : null;
}

function readVisibility(): Visibility {
  try {
    const parsed = JSON.parse(localStorage.getItem(MENU_VISIBILITY_KEY) ?? "{}") as Partial<Visibility>;
    return {
      sector: parsed.sector !== false,
      taxi: parsed.taxi !== false,
      freq: parsed.freq !== false,
    };
  } catch {
    return { sector: true, taxi: true, freq: true };
  }
}

function writeVisibility(value: Visibility) {
  localStorage.setItem(MENU_VISIBILITY_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pf24-menu-visibility-sync"));
}

function readControls(): ControlMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(SECTOR_CONTROLS_KEY) ?? "{}") as ControlMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeControls(value: ControlMap) {
  localStorage.setItem(SECTOR_CONTROLS_KEY, JSON.stringify(value));
}

function setControlledInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus();
}

function phaseFor(plan: LivePlan): Phase {
  const status = (plan.sector_status || "").toUpperCase();
  const index = STATUS_SEQUENCE.indexOf(status as (typeof STATUS_SEQUENCE)[number]);
  const appIndex = STATUS_SEQUENCE.indexOf("APP");
  return index >= appIndex ? "arr" : "dep";
}

function displayStatus(plan: LivePlan) {
  const status = (plan.sector_status || "").toUpperCase();
  if (status !== "STUP") return status;

  const created = plan.created_at ? new Date(plan.created_at).getTime() : Number.NaN;
  const updated = plan.updated_at ? new Date(plan.updated_at).getTime() : Number.NaN;
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return "";
  return updated - created > 2500 ? "STUP" : "";
}

function statusOptions(plan: LivePlan) {
  const shown = displayStatus(plan);
  if (!shown) return ["STUP", "PUSH"];
  const index = STATUS_SEQUENCE.indexOf(shown as (typeof STATUS_SEQUENCE)[number]);
  if (index < 0) return ["STUP", "PUSH"];
  return STATUS_SEQUENCE.slice(index + 1, index + 3);
}

function routeProcedureOptions(plan: LivePlan, phase: Phase) {
  const tokens = (plan.route || "")
    .toUpperCase()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const ordered = phase === "dep" ? tokens : [...tokens].reverse();
  return Array.from(new Set(ordered)).slice(0, 6);
}

function validManualSsr(value: string) {
  return /^[0-7]{4}$/.test(value) && value !== "7500";
}

function generateSsr(plans: LivePlan[], currentPlanId: string) {
  const used = new Set(
    plans
      .filter((plan) => plan.id !== currentPlanId)
      .map((plan) => plan.transponder)
      .filter(Boolean),
  );
  const reserved = new Set(["7500", "7600", "7700"]);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = Array.from({ length: 4 }, () => String(Math.floor(Math.random() * 8))).join("");
    if (!used.has(code) && !reserved.has(code)) return code;
  }
  return "2000";
}

function isRunwaySelectorButton(button: HTMLButtonElement) {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>("div.absolute"));
  return dialogs.some((dialog) => dialog.contains(button) && dialog.textContent?.includes("Runway selector dialog"));
}

export default function ScopeOperationalSync() {
  const [plans, setPlans] = useState<LivePlan[]>([]);
  const [sessions, setSessions] = useState<ATCSession[]>([]);
  const [sectorBody, setSectorBody] = useState<HTMLElement | null>(null);
  const [freqBody, setFreqBody] = useState<HTMLElement | null>(null);
  const [callsignHost, setCallsignHost] = useState<HTMLElement | null>(null);
  const [callsignInput, setCallsignInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [callsignFocused, setCallsignFocused] = useState(false);
  const [controls, setControls] = useState<ControlMap>({});
  const [popup, setPopup] = useState<Popup>(null);
  const [ssrDraft, setSsrDraft] = useState("");
  const runwayDragRef = useRef(false);

  const syncHosts = useCallback(() => {
    const nextSector = findWindowBody("SECTOR LIST");
    const nextFreq = findWindowBody("FREQ");
    setSectorBody(nextSector);
    setFreqBody(nextFreq);

    const dialog = document.querySelector<HTMLElement>(".connectBox");
    if (dialog) {
      const rows = Array.from(dialog.querySelectorAll<HTMLElement>("div.mb-1"));
      const row = rows.find((item) => item.firstElementChild?.textContent?.trim() === "Callsign");
      const input = row?.querySelector<HTMLInputElement>("input");
      const host = input?.parentElement ?? null;
      if (input) {
        input.removeAttribute("list");
        input.setAttribute("autocomplete", "off");
        input.style.paddingRight = "20px";
      }
      if (host) host.style.position = "relative";
      setCallsignInput(input ?? null);
      setCallsignHost(host);
      setQuery(input?.value ?? "");
    } else {
      setCallsignInput(null);
      setCallsignHost(null);
      setCallsignFocused(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    const { data } = await supabase
      .from("flight_plans")
      .select("*")
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false });
    setPlans((data ?? []) as LivePlan[]);
  }, []);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("atc_sessions")
      .select("*")
      .eq("is_active", true)
      .order("started_at", { ascending: true });
    setSessions((data ?? []) as ATCSession[]);
  }, []);

  useEffect(() => {
    setControls(readControls());
    void loadPlans();
    void loadSessions();

    const plansChannel = supabase.channel("scope-sector-list-live").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "flight_plans" },
      () => void loadPlans(),
    ).subscribe();
    const sessionsChannel = supabase.channel("scope-freq-list-live").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "atc_sessions" },
      () => void loadSessions(),
    ).subscribe();

    return () => {
      supabase.removeChannel(plansChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [loadPlans, loadSessions]);

  useEffect(() => {
    syncHosts();
    const first = window.setTimeout(syncHosts, 80);
    const second = window.setTimeout(syncHosts, 300);
    const onClick = () => window.setTimeout(syncHosts, 0);
    document.addEventListener("click", onClick, true);
    window.addEventListener("resize", syncHosts);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("resize", syncHosts);
    };
  }, [syncHosts]);

  useEffect(() => {
    if (!sectorBody) return;
    const previous = sectorBody.style.display;
    sectorBody.style.display = "none";
    return () => { sectorBody.style.display = previous; };
  }, [sectorBody]);

  useEffect(() => {
    if (!freqBody) return;
    const previous = freqBody.style.display;
    freqBody.style.display = "none";
    return () => { freqBody.style.display = previous; };
  }, [freqBody]);

  useEffect(() => {
    if (!callsignInput) return;
    const onInput = () => setQuery(callsignInput.value.toUpperCase());
    const onFocus = () => setCallsignFocused(true);
    const onBlur = () => window.setTimeout(() => setCallsignFocused(false), 120);
    callsignInput.addEventListener("input", onInput);
    callsignInput.addEventListener("focus", onFocus);
    callsignInput.addEventListener("blur", onBlur);
    return () => {
      callsignInput.removeEventListener("input", onInput);
      callsignInput.removeEventListener("focus", onFocus);
      callsignInput.removeEventListener("blur", onBlur);
    };
  }, [callsignInput]);

  useEffect(() => {
    const onClose = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const label = button?.getAttribute("aria-label") ?? "";
      let key: ListKey | null = null;
      if (label.toUpperCase().includes("SECTOR LIST")) key = "sector";
      else if (label.toUpperCase().includes("COMBINED TAXI LIST")) key = "taxi";
      else if (label.toUpperCase().includes("FREQ")) key = "freq";
      if (!key) return;
      writeVisibility({ ...readVisibility(), [key]: false });
    };
    document.addEventListener("click", onClose, true);
    return () => document.removeEventListener("click", onClose, true);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button || !isRunwaySelectorButton(button) || !button.querySelector("span")) return;
      runwayDragRef.current = true;
      button.dataset.pf24DragVisited = "true";
    };
    const onMouseOver = (event: MouseEvent) => {
      if (!runwayDragRef.current || (event.buttons & 1) !== 1) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button || !isRunwaySelectorButton(button) || !button.querySelector("span")) return;
      if (button.dataset.pf24DragVisited === "true") return;
      button.dataset.pf24DragVisited = "true";
      button.click();
    };
    const onMouseUp = () => {
      runwayDragRef.current = false;
      document.querySelectorAll<HTMLElement>("[data-pf24-drag-visited]").forEach((item) => delete item.dataset.pf24DragVisited);
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseover", onMouseOver, true);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const disableTransitionButton = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
      if (!text.includes("TRANS") || !text.includes("LVL")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener("click", disableTransitionButton, true);
    return () => document.removeEventListener("click", disableTransitionButton, true);
  }, []);

  const filteredCallsigns = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return CALLSIGNS.filter((callsign) => callsign.includes(q)).slice(0, 12);
  }, [query]);

  const patchControl = (planId: string, patch: Partial<LocalPlanControls>) => {
    setControls((current) => {
      const next = { ...current, [planId]: { ...(current[planId] ?? {}), ...patch } };
      writeControls(next);
      return next;
    });
  };

  const updatePlan = async (planId: string, patch: Partial<LivePlan>) => {
    const nextPatch = { ...patch, updated_at: new Date().toISOString() };
    setPlans((current) => current.map((plan) => plan.id === planId ? { ...plan, ...nextPatch } : plan));
    const { error } = await supabase.from("flight_plans").update(nextPatch).eq("id", planId);
    if (error) {
      console.error("PF24 Scope sector update failed:", error);
      await loadPlans();
    }
  };

  const openAssr = (plan: LivePlan) => {
    setPopup({ type: "assr", planId: plan.id });
    setSsrDraft(/^[0-7]{1,4}$/.test(plan.transponder || "") ? plan.transponder : "");
  };

  const sectorPortal = sectorBody?.parentElement ? createPortal(
    <div className="px-1 py-1 text-[9px] leading-[13px]" data-pf24-live-sector-list="true">
      <div className={`grid ${SECTOR_GRID}`}>
        <span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span><span className="text-center">C</span>
      </div>
      {plans.map((plan) => {
        const phase = phaseFor(plan);
        const local = controls[plan.id] ?? {};
        const runway = phase === "dep" ? local.depRunway ?? "" : local.arrRunway ?? "";
        const proc = phase === "dep" ? local.depProc ?? "" : local.arrProc ?? "";
        const airport = phase === "dep" ? plan.departure_icao : plan.arrival_icao;
        const runways = RUNWAYS[airport] ?? [];
        const procedures = routeProcedureOptions(plan, phase);
        const currentStatus = displayStatus(plan);
        const stsOptions = statusOptions(plan);
        const popupOpen = popup?.planId === plan.id;

        return <div key={plan.id} className="relative">
          <div className={`grid ${SECTOR_GRID} text-[#00e000]`}>
            <span className="truncate">{plan.callsign}</span>
            <span>{plan.aircraft_type}</span>
            <span>{plan.flight_rules === "IFR" ? "I" : plan.flight_rules === "VFR" ? "V" : plan.flight_rules?.slice(0, 1)}</span>
            <span>{plan.departure_icao}</span>
            <span>{plan.arrival_icao}</span>
            <span>{plan.flight_level}</span>
            <button type="button" data-pf24-sector-action="true" onClick={(event) => { event.stopPropagation(); setPopup((current) => current?.type === "runway" && current.planId === plan.id ? null : { type: "runway", planId: plan.id }); }} className="truncate text-left text-[#00e000]">{runway}</button>
            <button type="button" data-pf24-sector-action="true" onClick={(event) => { event.stopPropagation(); setPopup((current) => current?.type === "procs" && current.planId === plan.id ? null : { type: "procs", planId: plan.id }); }} className="truncate text-left text-[#00e000]">{proc}</button>
            <button type="button" data-pf24-sector-action="true" onClick={(event) => { event.stopPropagation(); openAssr(plan); }} className="text-left text-[#00e000]">{plan.transponder || "----"}</button>
            <button type="button" data-pf24-sector-action="true" onClick={(event) => { event.stopPropagation(); setPopup((current) => current?.type === "status" && current.planId === plan.id ? null : { type: "status", planId: plan.id }); }} className="truncate text-left text-[#00e000]">{currentStatus}</button>
            <button type="button" onClick={() => patchControl(plan.id, { c: !local.c })} className={`mx-auto mt-[1px] h-[11px] w-[11px] border border-[#e9e9e9] ${local.c ? "bg-[#00d600]" : "bg-transparent"}`} aria-label={`Alternar C ${plan.callsign}`} />
          </div>

          {popupOpen && popup?.type === "status" && (
            <div data-pf24-sector-popup="true" className="absolute right-[18px] top-[13px] z-[80] w-[78px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
              <div className="border-b border-[#0b2f2a] px-[4px] py-[2px] text-center text-[9px]">STS</div>
              {stsOptions.length === 0 ? <div className="px-[5px] py-[4px] text-center text-[8px] text-[#9aa]">PARKED</div> : stsOptions.map((status) => (
                <button key={status} type="button" onClick={() => { void updatePlan(plan.id, { sector_status: status }); setPopup(null); }} className="block w-full border-b border-[#0b2f2a] px-[5px] py-[3px] text-left text-[10px] last:border-b-0 hover:bg-[#0a5b50]">{status}</button>
              ))}
            </div>
          )}

          {popupOpen && popup?.type === "runway" && (
            <div data-pf24-sector-popup="true" className="absolute left-[228px] top-[13px] z-[80] min-w-[55px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
              <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-center text-[9px]">ARWY</div>
              {runways.length === 0 ? <div className="px-[6px] py-[4px] text-[8px]">---</div> : runways.map((value) => (
                <button key={value} type="button" onClick={() => { patchControl(plan.id, phase === "dep" ? { depRunway: value } : { arrRunway: value }); setPopup(null); }} className={`block w-full border-b border-[#0b2f2a] px-[8px] py-[3px] text-center text-[12px] last:border-b-0 hover:bg-[#0a5b50] ${runway === value ? "bg-[#0a5b50]" : ""}`}>{value}</button>
              ))}
            </div>
          )}

          {popupOpen && popup?.type === "procs" && (
            <div data-pf24-sector-popup="true" className="absolute left-[257px] top-[13px] z-[80] min-w-[92px] max-w-[150px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
              <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-center text-[9px]">PROCS</div>
              {procedures.length === 0 ? <div className="px-[6px] py-[4px] text-[8px]">---</div> : procedures.map((value) => (
                <button key={value} type="button" onClick={() => { patchControl(plan.id, phase === "dep" ? { depProc: value } : { arrProc: value }); setPopup(null); }} className={`block w-full truncate border-b border-[#0b2f2a] px-[6px] py-[3px] text-left text-[10px] last:border-b-0 hover:bg-[#0a5b50] ${proc === value ? "bg-[#0a5b50]" : ""}`}>{value}</button>
              ))}
            </div>
          )}

          {popupOpen && popup?.type === "assr" && (
            <div data-pf24-sector-popup="true" className="absolute right-[49px] top-[13px] z-[85] w-[178px] border border-[#e9e9e9] bg-[#555c61] text-[#e9e9e9] shadow-[0_2px_8px_rgba(0,0,0,.65)]">
              <div className="relative border-b border-[#e9e9e9] px-[6px] py-[4px] text-center text-[11px] text-[#00e000]">{plan.callsign}<span className="absolute right-[3px] top-[3px] h-[10px] w-[10px] bg-[#343a3d]" /></div>
              <div className="border-b border-[#e9e9e9] py-[8px] text-center text-[15px]">SSR</div>
              <button type="button" onClick={() => setSsrDraft(generateSsr(plans, plan.id))} className="block w-full border-b border-[#e9e9e9] py-[6px] text-center text-[13px] hover:bg-[#60686d]">Get SSR</button>
              <div className="border-b border-[#e9e9e9] px-[12px] py-[6px] text-[15px] tracking-[3px]">{ssrDraft || "----"}</div>
              <div className="grid grid-cols-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Dlt", "0", "Ok"].map((key) => {
                  const disabledDigit = key === "8" || key === "9";
                  const ok = key === "Ok";
                  return <button
                    key={key}
                    type="button"
                    disabled={disabledDigit || (ok && !validManualSsr(ssrDraft))}
                    onClick={() => {
                      if (key === "Dlt") { setSsrDraft(""); return; }
                      if (key === "Ok") { void updatePlan(plan.id, { transponder: ssrDraft }); setPopup(null); return; }
                      if (/^[0-7]$/.test(key)) setSsrDraft((current) => (current + key).slice(0, 4));
                    }}
                    className="h-[34px] border-b border-r border-[#e9e9e9] text-[13px] hover:bg-[#60686d] disabled:text-[#777] disabled:hover:bg-transparent"
                  >{key}</button>;
                })}
              </div>
            </div>
          )}
        </div>;
      })}
    </div>,
    sectorBody.parentElement,
  ) : null;

  const freqPortal = freqBody?.parentElement ? createPortal(
    <div className="px-1 py-1 text-[9px] leading-[13px] text-[#ffff00]" data-pf24-live-freq-list="true">
      {sessions.map((session) => (
        <div key={session.id} className="flex whitespace-nowrap">
          <span className="min-w-[78px] truncate">{session.position}</span>
          <span>{ATC_FREQUENCIES[session.position] ?? "---.---"}</span>
        </div>
      ))}
    </div>,
    freqBody.parentElement,
  ) : null;

  const callsignPortal = callsignHost && callsignInput ? createPortal(
    <>
      <span className="pointer-events-none absolute right-[5px] top-[5px] text-[8px] text-[#333]">▼</span>
      {callsignFocused && query.trim() && filteredCallsigns.length > 0 && (
        <div className="absolute left-0 right-0 top-[20px] z-[200] max-h-[154px] overflow-y-auto border border-[#999] bg-[#efefef] text-[#111] shadow-sm">
          {filteredCallsigns.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setControlledInput(callsignInput, option)}
              className="block h-[20px] w-full border-b border-[#d3d3d3] px-[5px] text-left text-[10px] hover:bg-[#d7e7f7]"
            >{option}</button>
          ))}
        </div>
      )}
    </>,
    callsignHost,
  ) : null;

  return <>{sectorPortal}{freqPortal}{callsignPortal}</>;
}
