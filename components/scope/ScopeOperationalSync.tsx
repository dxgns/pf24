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
type AutoMoveState = { sector: boolean; taxi: boolean };
type Phase = "dep" | "arr";
type Popup =
  | { type: "status"; planId: string }
  | { type: "runway"; planId: string }
  | { type: "procs"; planId: string }
  | { type: "assr"; planId: string }
  | { type: "gate"; planId: string }
  | null;

type LocalPlanControls = {
  c?: boolean;
  depRunway?: string;
  arrRunway?: string;
  depProc?: string;
  arrStar?: string;
  arrAppr?: string;
  gate?: string;
};

type ControlMap = Record<string, LocalPlanControls>;
type ProcedureSet = { sid?: string[]; star?: string[]; appr?: string[] };
type AircraftCode = "A" | "B" | "C" | "D" | "E";
type GateDefinition = { name: string; maxCode: AircraftCode | "ALL" };

const MENU_VISIBILITY_KEY = "pf24_scope_menu_visibility_v1";
const SECTOR_CONTROLS_KEY = "pf24_scope_sector_controls_v1";
const AUTO_MOVE_KEY = "pf24_scope_auto_list_move_v1";
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

const STATUS_DISPLAY: Record<string, string> = {
  STUP: "STUP",
  PUSH: "PUSH",
  TAXI_DEP: "TAXI",
  DEP: "DEP",
  APP: "APP",
  ARR: "ARR",
  TAXI_IN: "TXIN",
  TAXI_ARR: "TXIN",
  PARKED: "PARK",
};

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

const PROCEDURES: Record<string, Record<string, ProcedureSet>> = {
  MDST: {
    "11": {
      sid: ["PIXE2C PIXES", "VOGE2C VOGEP", "ETBO2C ETBOD"],
      star: ["PIXE4B", "ETBO4B", "PIXE3R", "VOGE3R", "ETBO3R"],
      appr: ["ILS"],
    },
    "29": {
      sid: ["PIXE2W PIXES", "VOGE2W VOGEP", "ETBO2W ETBOD"],
      star: ["PIXE3R", "VOGE3R", "ETBO3R"],
      appr: ["RNAV"],
    },
  },
  MDPC: {
    "08": {
      sid: ["PIXE2T PIXES", "PC20T PC202", "ETBO2T ETBOD", "LETA2T LETAD"],
      star: ["PIXE1W", "PC20W", "ETBO1W", "LETA1W"],
      appr: ["RNAV"],
    },
    "09": {
      sid: ["PIXE2T PIXES", "PC20T PC202", "ETBO2T ETBOD", "LETA2T LETAD"],
      star: ["PIXE1W", "PC20W", "ETBO1W", "LETA1W"],
      appr: ["RNAV"],
    },
  },
  LCPH: {
    "29": { appr: ["ILS"] },
    "11": { appr: ["RNP"] },
  },
};

const GATES: Record<string, GateDefinition[]> = {
  MDPC: [
    { name: "GA", maxCode: "ALL" }, { name: "VIP", maxCode: "ALL" },
    { name: "B33", maxCode: "C" }, { name: "B32", maxCode: "C" }, { name: "B31", maxCode: "C" },
    { name: "B30", maxCode: "C" }, { name: "B30L", maxCode: "C" }, { name: "B29", maxCode: "C" },
    { name: "B28", maxCode: "C" }, { name: "B27", maxCode: "C" }, { name: "B25", maxCode: "E" },
    { name: "B23", maxCode: "E" }, { name: "B21", maxCode: "C" }, { name: "B26", maxCode: "C" },
    { name: "B24", maxCode: "C" }, { name: "B22", maxCode: "C" }, { name: "B20", maxCode: "C" },
    { name: "11A", maxCode: "C" }, { name: "11", maxCode: "C" }, { name: "10", maxCode: "C" },
    { name: "9A", maxCode: "C" }, { name: "9", maxCode: "C" }, { name: "8", maxCode: "C" },
    { name: "7", maxCode: "C" }, { name: "6", maxCode: "C" }, { name: "5", maxCode: "C" },
    { name: "4", maxCode: "C" }, { name: "3", maxCode: "C" }, { name: "2", maxCode: "C" },
    { name: "1A", maxCode: "C" }, { name: "1", maxCode: "C" }, { name: "N5", maxCode: "C" },
    { name: "N4", maxCode: "C" }, { name: "N3", maxCode: "C" }, { name: "N2", maxCode: "C" },
    { name: "N1", maxCode: "C" },
  ],
  MDST: [
    { name: "A1", maxCode: "A" }, { name: "A2", maxCode: "A" }, { name: "A3", maxCode: "A" },
    { name: "B1", maxCode: "D" }, { name: "B2", maxCode: "D" }, { name: "B3", maxCode: "C" },
    { name: "B4", maxCode: "D" }, { name: "B5", maxCode: "D" }, { name: "B6", maxCode: "D" },
    { name: "C1", maxCode: "D" }, { name: "C2", maxCode: "D" }, { name: "C3", maxCode: "E" },
    { name: "C4", maxCode: "E" },
  ],
  LCPH: [
    { name: "1", maxCode: "C" }, { name: "2", maxCode: "C" }, { name: "3", maxCode: "C" },
    { name: "4", maxCode: "C" }, { name: "4A", maxCode: "B" }, { name: "4B", maxCode: "B" },
    { name: "5", maxCode: "C" }, { name: "5A", maxCode: "B" }, { name: "5B", maxCode: "B" },
    { name: "6", maxCode: "C" }, { name: "6A", maxCode: "B" }, { name: "6B", maxCode: "B" },
    { name: "7", maxCode: "C" }, { name: "8", maxCode: "C" }, { name: "9", maxCode: "D" },
    { name: "9A", maxCode: "C" }, { name: "10", maxCode: "D" }, { name: "10A", maxCode: "C" },
    { name: "11", maxCode: "D" }, { name: "11A", maxCode: "C" }, { name: "13", maxCode: "C" },
    { name: "14", maxCode: "B" }, { name: "14A", maxCode: "A" }, { name: "15", maxCode: "B" },
    { name: "15A", maxCode: "A" }, { name: "15B", maxCode: "A" },
  ],
};

const AIRCRAFT_CODE: Record<string, AircraftCode> = {
  C150: "A", BE58: "B", PA46: "B", TBM9: "B", SW3: "B", C550: "B", HAWK: "B", EUFI: "B",
  DH8D: "C", A220: "C", A319: "C", A320: "C", A321: "C", B717: "C", B727: "C", B737: "C", F100: "C",
  B757: "D", B767: "D", MD11: "D",
  A330: "E", A340: "E", A350: "E", B744: "E", B747: "E", B777: "E", B787: "E",
};

const SECTOR_GRID = "grid-cols-[50px_38px_25px_39px_39px_31px_29px_1fr_40px_31px_18px]";
const TAXI_GRID = "grid-cols-[50px_43px_35px_42px_1fr]";

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

function readAutoMove(): AutoMoveState {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTO_MOVE_KEY) ?? "{}") as Partial<AutoMoveState>;
    return { sector: parsed.sector !== false, taxi: parsed.taxi !== false };
  } catch {
    return { sector: true, taxi: true };
  }
}

function writeAutoMove(value: AutoMoveState) {
  localStorage.setItem(AUTO_MOVE_KEY, JSON.stringify(value));
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

function normalizeStatus(value?: string | null) {
  const status = (value || "").toUpperCase();
  return status === "TAXI_ARR" ? "TAXI_IN" : status;
}

function phaseFor(plan: LivePlan): Phase {
  const status = normalizeStatus(plan.sector_status);
  const index = STATUS_SEQUENCE.indexOf(status as (typeof STATUS_SEQUENCE)[number]);
  const appIndex = STATUS_SEQUENCE.indexOf("APP");
  return index >= appIndex ? "arr" : "dep";
}

function rawStatus(plan: LivePlan) {
  const status = normalizeStatus(plan.sector_status);
  if (status !== "STUP") return status;

  // Compatibility with flights created before NSTUP was stored explicitly.
  const created = plan.created_at ? new Date(plan.created_at).getTime() : Number.NaN;
  const updated = plan.updated_at ? new Date(plan.updated_at).getTime() : Number.NaN;
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return "";
  return updated - created > 2500 ? "STUP" : "";
}

function displayStatus(plan: LivePlan) {
  const status = rawStatus(plan);
  if (!status) return "";
  return STATUS_DISPLAY[status] ?? status;
}

function statusOptions(plan: LivePlan): string[] {
  const current = rawStatus(plan);
  if (!current) return ["NSTUP", "STUP", "PUSH"];
  const index = STATUS_SEQUENCE.indexOf(current as (typeof STATUS_SEQUENCE)[number]);
  if (index < 0) return ["NSTUP", "STUP", "PUSH"];
  return ["NSTUP", ...STATUS_SEQUENCE.slice(index + 1, index + 3)];
}

function isTaxiArrivalPlan(plan: LivePlan) {
  const status = normalizeStatus(plan.sector_status);
  return status === "TAXI_IN" || status === "PARKED";
}

function procedureSet(airport: string, runway: string) {
  return runway ? PROCEDURES[airport]?.[runway] : undefined;
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

function aircraftCode(type?: string | null): AircraftCode {
  const value = (type || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (AIRCRAFT_CODE[value]) return AIRCRAFT_CODE[value];
  if (/^(A33|A34|A35|B74|B77|B78)/.test(value)) return "E";
  if (/^(B75|B76|MD11)/.test(value)) return "D";
  if (/^(A22|A31|A32|B71|B72|B73|E1|E17|E19|F100|DH8)/.test(value)) return "C";
  if (/^(C1|C5|BE|PA|TBM|SW)/.test(value)) return "B";
  return "C";
}

function gateFitsAircraft(gate: GateDefinition, type?: string | null) {
  if (gate.maxCode === "ALL") return true;
  const order: Record<AircraftCode, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  return order[aircraftCode(type)] <= order[gate.maxCode];
}

function gateBase(airport: string, gate: string) {
  const names = (GATES[airport] ?? []).map((item) => item.name);
  const candidates = names
    .filter((name) => name !== gate && gate.startsWith(name) && gate.slice(name.length).length === 1 && /^[A-Z]$/.test(gate.slice(name.length)))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? gate;
}

function gatesConflict(airport: string, first: string, second: string) {
  if (!first || !second) return false;
  if (first === second) return true;
  const firstBase = gateBase(airport, first);
  const secondBase = gateBase(airport, second);
  if (firstBase !== secondBase) return false;
  return first === firstBase || second === secondBase;
}

function gateWarning(plan: LivePlan, gateName: string, taxiPlans: LivePlan[], controls: ControlMap) {
  if (!gateName) return "";
  const gate = (GATES[plan.arrival_icao] ?? []).find((item) => item.name === gateName);
  if (!gate || !gateFitsAircraft(gate, plan.aircraft_type)) return "PROB";

  const conflicting = taxiPlans.some((other) => {
    if (other.id === plan.id || other.arrival_icao !== plan.arrival_icao) return false;
    const otherGate = controls[other.id]?.gate ?? "";
    return gatesConflict(plan.arrival_icao, gateName, otherGate);
  });
  return conflicting ? "PROB" : "NORM";
}

function isRunwaySelectorButton(button: HTMLButtonElement) {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>("div.absolute"));
  return dialogs.some((dialog) => dialog.contains(button) && dialog.textContent?.includes("Runway selector dialog"));
}

function listKeyFromCloseButton(button: HTMLButtonElement): ListKey | null {
  const win = button.closest("div.absolute.z-30") as HTMLElement | null;
  if (!win || win.parentElement?.tagName !== "SECTION") return null;
  const header = win.firstElementChild as HTMLElement | null;
  if (!header || !header.contains(button)) return null;
  const buttons = Array.from(header.querySelectorAll<HTMLButtonElement>("button"));
  if (buttons.length === 0 || buttons[buttons.length - 1] !== button) return null;
  const title = header.textContent?.toUpperCase() ?? "";
  if (title.includes("SECTOR LIST")) return "sector";
  if (title.includes("COMBINED TAXI LIST")) return "taxi";
  if (title.includes("FREQ")) return "freq";
  return null;
}

function autoButtonKey(button: HTMLButtonElement): "sector" | "taxi" | null {
  const win = button.closest("div.absolute.z-30") as HTMLElement | null;
  if (!win || win.parentElement?.tagName !== "SECTION") return null;
  const header = win.firstElementChild as HTMLElement | null;
  if (!header || !header.contains(button)) return null;
  const buttons = Array.from(header.querySelectorAll<HTMLButtonElement>("button"));
  if (buttons[0] !== button) return null;
  const title = header.textContent?.toUpperCase() ?? "";
  if (title.includes("SECTOR LIST")) return "sector";
  if (title.includes("COMBINED TAXI LIST")) return "taxi";
  return null;
}

function setAutoButtonVisual(key: "sector" | "taxi", active: boolean) {
  const win = findScopeWindow(WINDOW_TITLES[key]);
  const header = win?.firstElementChild as HTMLElement | null;
  const button = header?.querySelector<HTMLButtonElement>("button");
  if (!button) return;
  button.style.backgroundColor = active ? "#0a5b50" : "";
  button.title = active ? "Automatic movement: ON" : "Automatic movement: OFF";
}

function moveWindowVertically(win: HTMLElement, targetTop: number) {
  const section = win.parentElement;
  const header = win.firstElementChild as HTMLElement | null;
  if (!section || section.tagName !== "SECTION" || !header) return;
  const sectionRect = section.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const currentTop = winRect.top - sectionRect.top;
  const delta = targetTop - currentTop;
  if (Math.abs(delta) < 1) return;

  const headerRect = header.getBoundingClientRect();
  const startX = headerRect.left + Math.min(36, Math.max(8, headerRect.width / 3));
  const startY = headerRect.top + Math.min(8, Math.max(4, headerRect.height / 2));
  header.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: startX, clientY: startY, button: 0, buttons: 1 }));
  window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: startX, clientY: startY + delta, buttons: 1 }));
  window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: startX, clientY: startY + delta, button: 0 }));
}

function arrangeAutoWindows(autoMove: AutoMoveState) {
  const sector = findScopeWindow("SECTOR LIST");
  const taxi = findScopeWindow("COMBINED TAXI LIST");
  if (!sector || !taxi || sector.style.display === "none" || taxi.style.display === "none") return;
  const radar = sector.parentElement;
  if (!radar || radar.tagName !== "SECTION") return;

  const radarRect = radar.getBoundingClientRect();
  const sectorRect = sector.getBoundingClientRect();
  const taxiRect = taxi.getBoundingClientRect();
  const overlapX = sectorRect.left < taxiRect.right && sectorRect.right > taxiRect.left;
  if (!overlapX) return;

  const gap = 2;
  const sectorTop = sectorRect.top - radarRect.top;
  const taxiTop = taxiRect.top - radarRect.top;
  const sectorHeight = sectorRect.height;
  const taxiHeight = taxiRect.height;
  const maxBottom = radarRect.height - 2;

  if (autoMove.taxi) {
    const desiredTaxi = sectorTop + sectorHeight + gap;
    if (desiredTaxi + taxiHeight <= maxBottom) {
      moveWindowVertically(taxi, desiredTaxi);
      return;
    }

    if (autoMove.sector) {
      const desiredSector = Math.max(2, maxBottom - sectorHeight - taxiHeight - gap);
      moveWindowVertically(sector, desiredSector);
      window.setTimeout(() => moveWindowVertically(taxi, desiredSector + sectorHeight + gap), 0);
      return;
    }

    const above = sectorTop - taxiHeight - gap;
    if (above >= 2) moveWindowVertically(taxi, above);
    return;
  }

  if (autoMove.sector) {
    const desiredAbove = taxiTop - sectorHeight - gap;
    if (desiredAbove >= 2) moveWindowVertically(sector, desiredAbove);
    else if (taxiTop + taxiHeight + sectorHeight + gap <= maxBottom) moveWindowVertically(sector, taxiTop + taxiHeight + gap);
  }
}

export default function ScopeOperationalSync() {
  const [plans, setPlans] = useState<LivePlan[]>([]);
  const [sessions, setSessions] = useState<ATCSession[]>([]);
  const [sectorBody, setSectorBody] = useState<HTMLElement | null>(null);
  const [taxiBody, setTaxiBody] = useState<HTMLElement | null>(null);
  const [freqBody, setFreqBody] = useState<HTMLElement | null>(null);
  const [callsignHost, setCallsignHost] = useState<HTMLElement | null>(null);
  const [callsignInput, setCallsignInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [callsignFocused, setCallsignFocused] = useState(false);
  const [controls, setControls] = useState<ControlMap>({});
  const [popup, setPopup] = useState<Popup>(null);
  const [ssrDraft, setSsrDraft] = useState("");
  const [autoMove, setAutoMove] = useState<AutoMoveState>({ sector: true, taxi: true });
  const runwayDragRef = useRef(false);

  const sectorPlans = useMemo(() => plans.filter((plan) => !isTaxiArrivalPlan(plan)), [plans]);
  const taxiPlans = useMemo(() => plans.filter(isTaxiArrivalPlan), [plans]);

  const syncHosts = useCallback(() => {
    const nextSector = findWindowBody("SECTOR LIST");
    const nextTaxi = findWindowBody("COMBINED TAXI LIST");
    const nextFreq = findWindowBody("FREQ");
    setSectorBody(nextSector);
    setTaxiBody(nextTaxi);
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
    const storedAuto = readAutoMove();
    setAutoMove(storedAuto);
    setAutoButtonVisual("sector", storedAuto.sector);
    setAutoButtonVisual("taxi", storedAuto.taxi);
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
    if (!taxiBody) return;
    const previous = taxiBody.style.display;
    taxiBody.style.display = "none";
    return () => { taxiBody.style.display = previous; };
  }, [taxiBody]);

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
      if (!button) return;
      const key = listKeyFromCloseButton(button);
      if (!key) return;
      writeVisibility({ ...readVisibility(), [key]: false });
    };
    document.addEventListener("click", onClose, true);
    return () => document.removeEventListener("click", onClose, true);
  }, []);

  useEffect(() => {
    const onAutoMoveClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const key = autoButtonKey(button);
      if (!key) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setAutoMove((current) => {
        const next = { ...current, [key]: !current[key] };
        writeAutoMove(next);
        setAutoButtonVisual(key, next[key]);
        if (next[key]) window.setTimeout(() => arrangeAutoWindows(next), 0);
        return next;
      });
    };
    document.addEventListener("click", onAutoMoveClick, true);
    return () => document.removeEventListener("click", onAutoMoveClick, true);
  }, []);

  useEffect(() => {
    setAutoButtonVisual("sector", autoMove.sector);
    setAutoButtonVisual("taxi", autoMove.taxi);
    const timer = window.setTimeout(() => arrangeAutoWindows(autoMove), 40);
    return () => window.clearTimeout(timer);
  }, [autoMove, sectorPlans.length, taxiPlans.length, sectorBody, taxiBody]);

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

  const updatePlan = async (planId: string, patch: Partial<LivePlan>, touchUpdatedAt = true) => {
    const nextPatch = touchUpdatedAt ? { ...patch, updated_at: new Date().toISOString() } : patch;
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

  const renderStatusPopup = (plan: LivePlan, className: string) => {
    if (popup?.type !== "status" || popup.planId !== plan.id) return null;
    return (
      <div data-pf24-sector-popup="true" className={`${className} z-[80] w-[82px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]`}>
        <div className="border-b border-[#0b2f2a] px-[4px] py-[2px] text-center text-[9px]">STS</div>
        {statusOptions(plan).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              void updatePlan(plan.id, { sector_status: status === "NSTUP" ? "" : status });
              setPopup(null);
            }}
            className="block w-full border-b border-[#0b2f2a] px-[5px] py-[3px] text-left text-[10px] last:border-b-0 hover:bg-[#0a5b50]"
          >{status}</button>
        ))}
      </div>
    );
  };

  const sectorPortal = sectorBody?.parentElement ? createPortal(
    <div className="px-1 py-1 text-[9px] leading-[13px]" data-pf24-live-sector-list="true">
      <div className={`grid ${SECTOR_GRID}`}>
        <span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span><span className="text-center">C</span>
      </div>
      {sectorPlans.map((plan) => {
        const phase = phaseFor(plan);
        const local = controls[plan.id] ?? {};
        const runway = phase === "dep" ? local.depRunway ?? "" : local.arrRunway ?? "";
        const proc = phase === "dep"
          ? local.depProc ?? ""
          : [local.arrStar, local.arrAppr].filter(Boolean).join("-");
        const airport = phase === "dep" ? plan.departure_icao : plan.arrival_icao;
        const runways = RUNWAYS[airport] ?? [];
        const procedures = procedureSet(airport, runway);
        const currentStatus = displayStatus(plan);
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

          {renderStatusPopup(plan, "absolute right-[18px] top-[13px]")}

          {popupOpen && popup?.type === "runway" && (
            <div data-pf24-sector-popup="true" className="absolute left-[228px] top-[13px] z-[80] min-w-[55px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
              <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-center text-[9px]">ARWY</div>
              {runways.length === 0 ? <div className="px-[6px] py-[4px] text-[8px]">---</div> : runways.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    patchControl(plan.id, phase === "dep"
                      ? { depRunway: value, depProc: "" }
                      : { arrRunway: value, arrStar: "", arrAppr: "" });
                    setPopup(null);
                  }}
                  className={`block w-full border-b border-[#0b2f2a] px-[8px] py-[3px] text-center text-[12px] last:border-b-0 hover:bg-[#0a5b50] ${runway === value ? "bg-[#0a5b50]" : ""}`}
                >{value}</button>
              ))}
            </div>
          )}

          {popupOpen && popup?.type === "procs" && (
            <div data-pf24-sector-popup="true" className="absolute left-[257px] top-[13px] z-[80] min-w-[118px] max-w-[190px] border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
              <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-center text-[9px]">PROCS</div>
              {!procedures ? (
                <div className="px-[6px] py-[4px] text-[8px] text-[#9aa]">---</div>
              ) : phase === "dep" ? (
                <>
                  <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-[8px] text-[#a9c7c1]">SID</div>
                  {(procedures.sid ?? []).length === 0 ? <div className="px-[6px] py-[4px] text-[8px] text-[#9aa]">---</div> : (procedures.sid ?? []).map((value) => (
                    <button key={value} type="button" onClick={() => { patchControl(plan.id, { depProc: value }); setPopup(null); }} className={`block w-full whitespace-nowrap border-b border-[#0b2f2a] px-[6px] py-[3px] text-left text-[9px] last:border-b-0 hover:bg-[#0a5b50] ${local.depProc === value ? "bg-[#0a5b50]" : ""}`}>{value}</button>
                  ))}
                </>
              ) : (
                <>
                  <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-[8px] text-[#a9c7c1]">STAR</div>
                  {(procedures.star ?? []).length === 0 ? <div className="px-[6px] py-[3px] text-[8px] text-[#9aa]">---</div> : (procedures.star ?? []).map((value) => (
                    <button key={value} type="button" onClick={() => patchControl(plan.id, { arrStar: value })} className={`block w-full whitespace-nowrap border-b border-[#0b2f2a] px-[6px] py-[3px] text-left text-[9px] hover:bg-[#0a5b50] ${local.arrStar === value ? "bg-[#0a5b50]" : ""}`}>{value}</button>
                  ))}
                  <div className="border-b border-[#0b2f2a] px-[5px] py-[2px] text-[8px] text-[#a9c7c1]">APPR</div>
                  {(procedures.appr ?? []).length === 0 ? <div className="px-[6px] py-[3px] text-[8px] text-[#9aa]">---</div> : (procedures.appr ?? []).map((value) => (
                    <button key={value} type="button" onClick={() => patchControl(plan.id, { arrAppr: value })} className={`block w-full whitespace-nowrap border-b border-[#0b2f2a] px-[6px] py-[3px] text-left text-[9px] last:border-b-0 hover:bg-[#0a5b50] ${local.arrAppr === value ? "bg-[#0a5b50]" : ""}`}>{value}</button>
                  ))}
                </>
              )}
            </div>
          )}

          {popupOpen && popup?.type === "assr" && (
            <div data-pf24-sector-popup="true" className="absolute right-[49px] top-[13px] z-[85] w-[178px] border border-[#e9e9e9] bg-[#555c61] text-[#e9e9e9] shadow-[0_2px_8px_rgba(0,0,0,.65)]">
              <div className="relative border-b border-[#e9e9e9] px-[6px] py-[4px] text-center text-[11px] text-[#00e000]">
                {plan.callsign}
                <button type="button" aria-label="Cerrar SSR" onClick={(event) => { event.stopPropagation(); setPopup(null); }} className="absolute right-[3px] top-[3px] h-[10px] w-[10px] bg-[#343a3d] hover:bg-[#252a2c]" />
              </div>
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
                      if (key === "Ok") { void updatePlan(plan.id, { transponder: ssrDraft }, false); setPopup(null); return; }
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

  const taxiPortal = taxiBody?.parentElement ? createPortal(
    <div className="px-1 py-1 text-[9px] leading-[13px]" data-pf24-live-taxi-list="true">
      <div className={`grid ${TAXI_GRID}`}>
        <span>CALLSIGN</span><span>ATYP</span><span>STS</span><span>GATE</span><span>WRN</span>
      </div>
      {taxiPlans.map((plan) => {
        const local = controls[plan.id] ?? {};
        const gates = GATES[plan.arrival_icao] ?? [];
        const warning = gateWarning(plan, local.gate ?? "", taxiPlans, controls);
        const popupOpen = popup?.planId === plan.id;
        return (
          <div key={plan.id} className="relative">
            <div className={`grid ${TAXI_GRID} text-[#00e000]`}>
              <span className="truncate">{plan.callsign}</span>
              <span>{plan.aircraft_type}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); setPopup((current) => current?.type === "status" && current.planId === plan.id ? null : { type: "status", planId: plan.id }); }} className="truncate text-left text-[#00e000]">{displayStatus(plan)}</button>
              <button type="button" onClick={(event) => { event.stopPropagation(); setPopup((current) => current?.type === "gate" && current.planId === plan.id ? null : { type: "gate", planId: plan.id }); }} className="truncate text-left text-[#00e000]">{local.gate ?? ""}</button>
              <span className={warning === "PROB" ? "text-[#ff6a00]" : warning === "NORM" ? "text-[#00e000]" : ""}>{warning}</span>
            </div>

            {renderStatusPopup(plan, "absolute left-[88px] top-[13px]")}

            {popupOpen && popup?.type === "gate" && (
              <div data-pf24-sector-popup="true" className="absolute left-[124px] top-[13px] z-[82] min-w-[62px] max-h-[180px] overflow-y-auto border border-[#0b2f2a] bg-[#064a40] text-[#e9e9e9] shadow-[0_1px_4px_rgba(0,0,0,.55)]">
                <div className="sticky top-0 border-b border-[#0b2f2a] bg-[#064a40] px-[5px] py-[2px] text-center text-[9px]">GATE</div>
                {gates.length === 0 ? <div className="px-[6px] py-[4px] text-[8px] text-[#9aa]">---</div> : gates.map((gate) => {
                  const fits = gateFitsAircraft(gate, plan.aircraft_type);
                  const occupied = taxiPlans.some((other) => other.id !== plan.id && other.arrival_icao === plan.arrival_icao && gatesConflict(plan.arrival_icao, gate.name, controls[other.id]?.gate ?? ""));
                  const problem = !fits || occupied;
                  return (
                    <button
                      key={gate.name}
                      type="button"
                      onClick={() => { patchControl(plan.id, { gate: gate.name }); setPopup(null); }}
                      className={`block w-full border-b border-[#0b2f2a] px-[6px] py-[3px] text-center text-[10px] last:border-b-0 hover:bg-[#0a5b50] ${local.gate === gate.name ? "bg-[#0a5b50]" : ""} ${problem ? "text-[#ff9b52]" : ""}`}
                    >{gate.name}</button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>,
    taxiBody.parentElement,
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

  return <>{sectorPortal}{taxiPortal}{freqPortal}{callsignPortal}</>;
}
