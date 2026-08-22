"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGameCallsignFromNotes } from "@/lib/flightPlanGameCallsign";
import { normalizeAirlineCallsign } from "@/lib/scope/airlines";
import { scopeDistanceNmFromScreenDelta } from "@/lib/scope/distanceScale";
import type { ScopeFlightPlan } from "@/lib/scope/types";
import { supabase } from "@/lib/supabase";

const ORANGE = "#fd5f10";
const HORIZONTAL_MIN_NM = 3;
const IFR_VERTICAL_MIN_FT = 1000;
const VFR_VERTICAL_MIN_FT = 500;
const ABSOLUTE_GROUND_CUTOFF_FT = 100;
const LOW_SPEED_GROUND_KT = 35;
const LOW_SPEED_GROUND_MAX_ALT_FT = 3000;
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const TRAFFIC_SELECTOR = "[data-pf24-traffic-label='true']";
const GROUND_SECTOR_STATUSES = new Set(["STUP", "PUSH", "TAXI_DEP", "TAXI_IN", "PARKED", "ARR"]);

type Props = { initialPlans: ScopeFlightPlan[] };
type Point = { x: number; y: number };
type TrafficSample = {
  id: string;
  callsign: string;
  altitudeFt: number;
  point: Point;
  rule: "IFR" | "VFR";
  label: HTMLElement;
  callsignButton: HTMLButtonElement;
};
type ConflictPair = { a: TrafficSample; b: TrafficSample; distanceNm: number };
type ConflictRow = { id: string; callsign: string; altitudeFt: number; distanceNm: number };
type ConflictGroup = { key: string; rows: ConflictRow[] };

function norm(value: string) {
  return normalizeAirlineCallsign(value.trim().toUpperCase());
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const planned = norm(plan.callsign);
  const game = norm(getGameCallsignFromNotes(plan.notes));
  if (planned) keys.add(planned);
  if (game) keys.add(game);
  return Array.from(keys);
}

function planRule(plan: ScopeFlightPlan | undefined): "IFR" | "VFR" {
  return plan?.flight_rules?.trim().toUpperCase().includes("VFR") ? "VFR" : "IFR";
}

function planIsGround(plan: ScopeFlightPlan | undefined) {
  if (!plan) return false;
  return GROUND_SECTOR_STATUSES.has((plan.sector_status ?? "").trim().toUpperCase());
}

function readZoom() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as { zoom?: number };
    return typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom) ? Math.max(0.01, parsed.zoom) : 1;
  } catch {
    return 1;
  }
}

function findCallsignButton(label: HTMLElement) {
  return Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    if (button.closest("[data-pf24-callsign-menu='true'],[data-pf24-traffic-popup='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(button.textContent?.trim().toUpperCase() ?? "");
  }) ?? null;
}

function readFlightLevel(label: HTMLElement) {
  for (const span of Array.from(label.querySelectorAll<HTMLSpanElement>("span"))) {
    const match = (span.textContent?.trim().toUpperCase() ?? "").match(/^(\d{3})[↑↓]?$/);
    if (match) return Number(match[1]) * 100;
  }
  return Number.NaN;
}

function hasVerticalTrend(label: HTMLElement) {
  return Array.from(label.querySelectorAll<HTMLSpanElement>("span")).some((span) => /[↑↓]/.test(span.textContent ?? ""));
}

function readGroundSpeed(label: HTMLElement) {
  for (const span of Array.from(label.querySelectorAll<HTMLSpanElement>("span"))) {
    const text = span.textContent?.trim().toUpperCase() ?? "";
    const detailed = text.match(/^N(\d{1,3})$/);
    if (detailed) return Number(detailed[1]);
  }

  for (const parent of Array.from(label.querySelectorAll<HTMLSpanElement>("span"))) {
    const children = Array.from(parent.children).filter((child): child is HTMLSpanElement => child instanceof HTMLSpanElement);
    if (children.length !== 2) continue;
    const first = children[0].textContent?.trim().toUpperCase() ?? "";
    const second = children[1].textContent?.trim().toUpperCase() ?? "";
    if (/^\d{3}[↑↓]?$/.test(first) && /^\d{3}$/.test(second)) return Number(second);
  }

  return Number.NaN;
}

function trafficIsGround(label: HTMLElement, altitudeFt: number, plan: ScopeFlightPlan | undefined) {
  if (planIsGround(plan)) return true;
  if (altitudeFt <= ABSOLUTE_GROUND_CUTOFF_FT) return true;

  // Fallback for unplanned traffic at elevated airports: parked/taxi traffic has
  // very low groundspeed and no vertical trend. This intentionally uses a low
  // threshold so slow airborne VFR traffic is not broadly suppressed.
  const groundSpeed = readGroundSpeed(label);
  return Number.isFinite(groundSpeed)
    && groundSpeed <= LOW_SPEED_GROUND_KT
    && altitudeFt <= LOW_SPEED_GROUND_MAX_ALT_FT
    && !hasVerticalTrend(label);
}

function readSamples(radar: HTMLElement, plansByKey: Map<string, ScopeFlightPlan>) {
  const radarRect = radar.getBoundingClientRect();
  const seen = new Set<string>();
  const samples: TrafficSample[] = [];

  for (const label of Array.from(radar.querySelectorAll<HTMLElement>(TRAFFIC_SELECTOR))) {
    const id = label.dataset.pf24TrafficId?.trim() ?? "";
    if (!id || seen.has(id)) continue;

    const callsignButton = findCallsignButton(label);
    const callsign = callsignButton?.textContent?.trim().toUpperCase() ?? "";
    const key = norm(callsign);
    const altitudeFt = readFlightLevel(label);
    const target = label.parentElement?.querySelector<HTMLButtonElement>("button[data-pf24-traffic-select='true']") ?? null;
    if (!callsignButton || !callsign || !key || !target || !Number.isFinite(altitudeFt)) continue;

    const plan = plansByKey.get(key);
    if (trafficIsGround(label, altitudeFt, plan)) continue;

    const rect = target.getBoundingClientRect();
    samples.push({
      id,
      callsign,
      altitudeFt,
      point: {
        x: rect.left + rect.width / 2 - radarRect.left,
        y: rect.top + rect.height / 2 - radarRect.top,
      },
      rule: planRule(plan),
      label,
      callsignButton,
    });
    seen.add(id);
  }

  return samples;
}

function buildPairs(samples: TrafficSample[], radar: HTMLElement, zoom: number) {
  const pairs: ConflictPair[] = [];
  const width = Math.max(1, radar.clientWidth);
  const height = Math.max(1, radar.clientHeight);

  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const a = samples[i];
      const b = samples[j];
      const distanceNm = scopeDistanceNmFromScreenDelta(a.point.x - b.point.x, a.point.y - b.point.y, width, height, zoom);
      if (distanceNm >= HORIZONTAL_MIN_NM) continue;

      const minimumVertical = a.rule === "VFR" || b.rule === "VFR" ? VFR_VERTICAL_MIN_FT : IFR_VERTICAL_MIN_FT;
      if (Math.abs(a.altitudeFt - b.altitudeFt) >= minimumVertical) continue;
      pairs.push({ a, b, distanceNm });
    }
  }

  return pairs;
}

function groupPairs(pairs: ConflictPair[]): ConflictGroup[] {
  if (!pairs.length) return [];
  const adjacency = new Map<string, Set<string>>();
  const sampleById = new Map<string, TrafficSample>();
  const distances = new Map<string, number[]>();

  const connect = (a: string, b: string) => {
    const set = adjacency.get(a) ?? new Set<string>();
    set.add(b);
    adjacency.set(a, set);
  };

  for (const pair of pairs) {
    sampleById.set(pair.a.id, pair.a);
    sampleById.set(pair.b.id, pair.b);
    connect(pair.a.id, pair.b.id);
    connect(pair.b.id, pair.a.id);
    distances.set(pair.a.id, [...(distances.get(pair.a.id) ?? []), pair.distanceNm]);
    distances.set(pair.b.id, [...(distances.get(pair.b.id) ?? []), pair.distanceNm]);
  }

  const visited = new Set<string>();
  const groups: ConflictGroup[] = [];
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const queue = [start];
    const ids: string[] = [];
    visited.add(start);
    while (queue.length) {
      const id = queue.shift() as string;
      ids.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    const rows = ids.flatMap((id) => {
      const sample = sampleById.get(id);
      if (!sample) return [];
      const values = distances.get(id) ?? [];
      return [{
        id,
        callsign: sample.callsign,
        altitudeFt: sample.altitudeFt,
        distanceNm: values.length ? Math.min(...values) : 0,
      } satisfies ConflictRow];
    }).sort((a, b) => a.callsign.localeCompare(b.callsign));

    groups.push({ key: ids.slice().sort().join("|"), rows });
  }
  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

function pairSignature(pair: ConflictPair) {
  return [pair.a.id, pair.b.id].sort().join("|");
}

function scheduleTone(context: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.07, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export default function ScopeConflictDetectionV2({ initialPlans }: Props) {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [plans, setPlans] = useState(initialPlans);
  const [groups, setGroups] = useState<ConflictGroup[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const activePairsRef = useRef(new Set<string>());
  const markedButtonsRef = useRef(new Set<HTMLButtonElement>());
  const zoomRef = useRef(1);

  const plansByKey = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) for (const key of planKeys(plan)) if (key && !map.has(key)) map.set(key, plan);
    return map;
  }, [plans]);

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
    const context = audioRef.current ?? new window.AudioContext();
    audioRef.current = context;
    if (context.state === "suspended") {
      try { await context.resume(); } catch { return null; }
    }
    return context;
  }, []);

  const playAlert = useCallback(async () => {
    const context = await ensureAudio();
    if (!context || context.state !== "running") return;
    const start = context.currentTime + 0.01;
    scheduleTone(context, 980, start, 0.085);
    scheduleTone(context, 720, start + 0.11, 0.105);
  }, [ensureAudio]);

  const clearMarks = useCallback(() => {
    for (const button of markedButtonsRef.current) {
      button.removeAttribute("data-pf24-conflict-callsign");
      button.closest<HTMLElement>(TRAFFIC_SELECTOR)?.removeAttribute("data-pf24-conflict");
    }
    markedButtonsRef.current.clear();
  }, []);

  const scan = useCallback(() => {
    if (!radar) return;
    const samples = readSamples(radar, plansByKey);
    const pairs = buildPairs(samples, radar, zoomRef.current || readZoom());
    const conflicted = new Set<string>();
    for (const pair of pairs) {
      conflicted.add(pair.a.id);
      conflicted.add(pair.b.id);
    }

    clearMarks();
    for (const sample of samples) {
      if (!conflicted.has(sample.id)) continue;
      sample.label.dataset.pf24Conflict = "true";
      sample.callsignButton.dataset.pf24ConflictCallsign = "true";
      markedButtonsRef.current.add(sample.callsignButton);
    }

    const signatures = new Set(pairs.map(pairSignature));
    if (Array.from(signatures).some((key) => !activePairsRef.current.has(key))) void playAlert();
    activePairsRef.current = signatures;

    const next = groupPairs(pairs);
    setGroups((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [clearMarks, plansByKey, playAlert, radar]);

  useEffect(() => {
    zoomRef.current = readZoom();
    const onViewport = (event: Event) => {
      const value = Number((event as CustomEvent<{ zoom?: number }>).detail?.zoom);
      if (Number.isFinite(value) && value > 0) zoomRef.current = value;
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
  }, []);

  useEffect(() => {
    const locate = () => setRadar(document.querySelector<HTMLElement>("main.fixed > section"));
    locate();
    const timer = window.setInterval(locate, 300);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
      if (data) setPlans(data as ScopeFlightPlan[]);
    };
    const channel = supabase.channel("scope-conflict-flight-plans-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const unlock = () => { void ensureAudio(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      const context = audioRef.current;
      audioRef.current = null;
      if (context && context.state !== "closed") void context.close();
    };
  }, [ensureAudio]);

  useEffect(() => {
    if (!radar) return;
    const timer = window.setInterval(scan, 250);
    const observer = new MutationObserver(scan);
    observer.observe(radar, { childList: true, subtree: true });
    scan();
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      clearMarks();
      activePairsRef.current.clear();
    };
  }, [clearMarks, radar, scan]);

  if (!radar || groups.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none absolute left-[8px] top-[390px] z-[95] w-[218px] border-2 border-[#ededed] bg-[#555c61] font-mono text-[#ededed] shadow-[0_2px_6px_rgba(0,0,0,.4)]">
      <div className="relative border-b-2 border-[#ededed] text-center text-[16px] leading-[28px] tracking-[1px]">
        CONFLICT
        <span className="absolute right-[4px] top-[4px] h-[20px] w-[12px] bg-[#30363a]" />
      </div>
      <div className="grid grid-cols-[1fr_48px_50px] border-b border-[#ededed] text-[14px] leading-[25px]">
        <span className="pl-[15px]">CALLSIGN</span><span className="text-center">FL</span><span className="text-center">NM</span>
      </div>
      {groups.map((group, groupIndex) => <div key={group.key} className={groupIndex > 0 ? "border-t-2 border-[#ededed]" : ""}>
        {group.rows.map((row) => <div key={row.id} className="grid grid-cols-[1fr_48px_50px] border-b border-[#ededed]/70 text-[15px] leading-[25px] text-[#fd5f10] last:border-b-0">
          <span className="pl-[24px]">{row.callsign}</span>
          <span className="text-center">{String(Math.max(0, Math.round(row.altitudeFt / 100))).padStart(3, "0")}</span>
          <span className="text-center">{row.distanceNm.toFixed(1)}</span>
        </div>)}
      </div>)}
    </div>,
    radar,
  );
}
