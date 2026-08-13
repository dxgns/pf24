"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  is_active: boolean;
};

type ListKey = "sector" | "taxi" | "freq";
type Visibility = Record<ListKey, boolean>;

const MENU_VISIBILITY_KEY = "pf24_scope_menu_visibility_v1";
const CALLSIGNS = Object.keys(ATC_FREQUENCIES).sort();
const WINDOW_TITLES: Record<ListKey, string> = {
  sector: "SECTOR LIST",
  taxi: "COMBINED TAXI LIST",
  freq: "FREQ",
};

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

function setControlledInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus();
}

export default function ScopeOperationalSync() {
  const [plans, setPlans] = useState<ScopeFlightPlan[]>([]);
  const [sessions, setSessions] = useState<ATCSession[]>([]);
  const [sectorBody, setSectorBody] = useState<HTMLElement | null>(null);
  const [freqBody, setFreqBody] = useState<HTMLElement | null>(null);
  const [callsignHost, setCallsignHost] = useState<HTMLElement | null>(null);
  const [callsignInput, setCallsignInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [callsignFocused, setCallsignFocused] = useState(false);
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

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase
        .from("flight_plans")
        .select("*")
        .neq("status", "FINISHED")
        .order("created_at", { ascending: false });
      setPlans((data ?? []) as ScopeFlightPlan[]);
    };
    const loadSessions = async () => {
      const { data } = await supabase
        .from("atc_sessions")
        .select("*")
        .eq("is_active", true)
        .order("started_at", { ascending: true });
      setSessions((data ?? []) as ATCSession[]);
    };

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
  }, []);

  useEffect(() => {
    syncHosts();
    const observer = new MutationObserver(() => window.setTimeout(syncHosts, 0));
    const scope = document.querySelector<HTMLElement>("main.fixed");
    if (scope) observer.observe(scope, { subtree: true, childList: true });
    document.addEventListener("click", syncHosts, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", syncHosts, true);
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
      const next = { ...readVisibility(), [key]: false };
      writeVisibility(next);
    };
    document.addEventListener("click", onClose, true);
    return () => document.removeEventListener("click", onClose, true);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button?.closest("[data-pf24-runway-selector='true']")) return;
      if (!button.querySelector("span")) return;
      runwayDragRef.current = true;
    };
    const onMouseOver = (event: MouseEvent) => {
      if (!runwayDragRef.current || (event.buttons & 1) !== 1) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button?.closest("[data-pf24-runway-selector='true']")) return;
      if (!button.querySelector("span")) return;
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

  const sectorPortal = sectorBody?.parentElement ? createPortal(
    <div className="px-1 py-1 text-[9px] leading-[13px]" data-pf24-live-sector-list="true">
      <div className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px]">
        <span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span>
      </div>
      {plans.map((plan) => (
        <div key={plan.id} className="grid grid-cols-[50px_39px_27px_42px_42px_34px_30px_1fr_42px_34px] text-[#00e000]">
          <span className="truncate">{plan.callsign}</span>
          <span>{plan.aircraft_type}</span>
          <span>{plan.flight_rules}</span>
          <span>{plan.departure_icao}</span>
          <span>{plan.arrival_icao}</span>
          <span>{plan.flight_level}</span>
          <span>---</span>
          <span className="truncate">---</span>
          <span>{plan.transponder}</span>
          <span>{plan.sector_status || "---"}</span>
        </div>
      ))}
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
