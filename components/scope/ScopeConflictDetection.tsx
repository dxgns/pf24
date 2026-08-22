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
const GROUND_CUTOFF_FT = 100;
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";
const TRAFFIC_SELECTOR = "[data-pf24-traffic-label='true']";

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
type ConflictPair = {
  a: TrafficSample;
  b: TrafficSample;
  distanceNm: number;
  verticalFt: number;
  verticalMinFt: number;
};
type ConflictRow = {
  id: string;
  callsign: string;
  altitudeFt: number;
  distanceNm: number;
};
type ConflictGroup = {
  key: string;
  rows: ConflictRow[];
};

function norm(value: string) {
  return normalizeAirlineCallsign(value.trim().toUpperCase());
}

function planKeys(plan: ScopeFlightPlan) {
  const keys = new Set<string>();
  const planCallsign = norm(plan.callsign);
  const gameCallsign = norm(getGameCallsignFromNotes(plan.notes));
  if (planCallsign) keys.add(planCallsign);
  if (gameCallsign) keys.add(gameCallsign);
  return Array.from(keys);
}

function planRule(plan: ScopeFlightPlan | undefined): "IFR" | "VFR" {
  const value = plan?.flight_rules?.trim().toUpperCase() ?? "";
  return value.includes("VFR") ? "VFR" : "IFR";
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
  const spans = Array.from(label.querySelectorAll<HTMLSpanElement>("span"));
  for (const span of spans) {
    const text = span.textContent?.trim().toUpperCase() ?? "";
    const match = text.match(/^(\d{3})[↑↓]?$/);
    if (!match) continue;
    return Number(match[1]) * 100;
  }
  return Number.NaN;
}

function readTrafficSamples(radar: HTMLElement, plansByKey: Map<string, ScopeFlightPlan>, zoom: number) {
  const radarRect = radar.getBoundingClientRect();
  const samples: TrafficSample[] = [];
  const seen = new Set<string>();

  for (const label of Array.from(radar.querySelectorAll<HTMLElement>(TRAFFIC_SELECTOR))) {
    const id = label.dataset.pf24TrafficId?.trim() ?? "";
    if (!id || seen.has(id)) continue;
    const callsignButton = findCallsignButton(label);
    const callsign = callsignButton?.textContent?.trim().toUpperCase() ?? "";
    const key = norm(callsign);
    const altitudeFt = readFlightLevel(label);
    const wrapper = label.parentElement;
    const target = wrapper?.querySelector<HTMLButtonElement>("button[data-pf24-traffic-select='true']") ?? null;
    if (!callsignButton || !callsign || !key || !target || !Number.isFinite(altitudeFt)) continue;
    if (altitudeFt <= GROUND_CUTOFF_FT) continue;

    const rect = target.getBoundingClientRect();
    const point = {
      x: rect.left + rect.width / 2 - radarRect.left,
      y: rect.top + rect.height / 2 - radarRect.top,
    };
    const plan = plansByKey.get(key);

    samples.push({
      id,
      callsign,
      altitudeFt,
      point,
      rule: planRule(plan),
      label,
      callsignButton,
    });
    seen.add(id);
  }

  // Keep the zoom argument in the sampling signature so all geometry is read
  // from the same radar state in a scan; distance conversion happens per pair.
  void zoom;
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
      const dx = a.point.x - b.point.x;
      const dy = a.point.y - b.point.y;
      const distanceNm = scopeDistanceNmFromScreenDelta(dx, dy, width, height, zoom);
      if (!(distanceNm < HORIZONTAL_MIN_NM)) continue;

      const verticalFt = Math.abs(a.altitudeFt - b.altitudeFt);
      const verticalMinFt = a.rule === "VFR" || b.rule === "VFR"
        ? VFR_VERTICAL_MIN_FT
        : IFR_VERTICAL_MIN_FT;
      if (!(verticalFt < verticalMinFt)) continue;

      pairs.push({ a, b, distanceNm, verticalFt, verticalMinFt });
    }
  }

  return pairs;
}

function groupPairs(pairs: ConflictPair[]): ConflictGroup[] {
  if (!pairs.length) return [];

  const adjacency = new Map<string, Set<string>>();
  const sampleById = new Map<string, TrafficSample>();
  const pairDistances = new Map<string, number[]>();

  const connect = (from: string, to: string) => {
    const current = adjacency.get(from) ?? new Set<string>();
    current.add(to);
    adjacency.set(from, current);
  };

  for (const pair of pairs) {
    sampleById.set(pair.a.id, pair.a);
    sampleById.set(pair.b.id, pair.b);
    connect(pair.a.id, pair.b.id);
    connect(pair.b.id, pair.a.id);
    pairDistances.set(pair.a.id, [...(pairDistances.get(pair.a.id) ?? []), pair.distanceNm]);
    pairDistances.set(pair.b.id, [...(pairDistances.get(pair.b.id) ?? []), pair.distanceNm]);
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

    const rows = ids
      .map((id): ConflictRow | null => {
        const sample = sampleById.get(id);
        if (!sample) return null;
        const distances = pairDistances.get(id) ?? [];
        return {
          id,
          callsign: sample.callsign,
          altitudeFt: sample.altitudeFt,
          distanceNm: distances.length ? Math.min(...distances) : 0,
        };
      })
      .filter((row): row is ConflictRow => Boolean(row))
      .sort((a, b) => a.callsign.localeCompare(b.callsign));

    groups.push({
      key: ids.slice().sort().join("|"),
      rows,
    });
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

export default function ScopeConflictDetection({ initialPlans }: Props) {
  const [radar, setRadar] = useState<HTMLElement | null>(null);
  const [plans, setPlans] = useState(initialPlans);
  const [groups, setGroups] = useState<ConflictGroup[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const activePairsRef = useRef(new Set<string>());
  const conflictButtonsRef = useRef(new Set<HTMLButtonElement>());
  const scanQueuedRef = useRef(false);
  const zoomRef = useRef(1);

  const plansByKey = useMemo(() => {
    const map = new Map<string, ScopeFlightPlan>();
    for (const plan of plans) {
      for (const key of planKeys(plan)) {
        if (key && !map.has(key)) map.set(key, plan);
      }
    }
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

  const playConflictAlert = useCallback(async () => {
    const context = await ensureAudio();
    if (!context || context.state !== "running") return;
    const now = context.currentTime + 0.01;
    scheduleTone(context, 980, now, 0.085);
    scheduleTone(context, 720, now + 0.11, 0.105);
  }, [ensureAudio]);

  const clearConflictMarks = useCallback(() => {
    for (const button of conflictButtonsRef.current) {
      button.removeAttribute("data-pf24-conflict-callsign");
      button.closest<HTMLElement>(TRAFFIC_SELECTOR)?.removeAttribute("data-pf24-conflict");
    }
    conflictButtonsRef.current.clear();
  }, []);

  const scan = useCallback(() => {
    if (!radar) return;
    const zoom = zoomRef.current || readZoom();
    const samples = readTrafficSamples(radar, plansByKey, zoom);
    const pairs = buildPairs(samples, radar, zoom);
    const conflictedIds = new Set<string>();
    pairs.forEach((pair) => {
      conflictedIds.add(pair.a.id);
      conflictedIds.add(pair.b.id);
    });

    clearConflictMarks();
    for (const sample of samples) {
      if (!conflictedIds.has(sample.id)) continue;
      sample.label.dataset.pf24Conflict = "true";
      sample.callsignButton.dataset.pf24ConflictCallsign = "true";
      conflictButtonsRef.current.add(sample.callsignButton);
    }

    const nextPairSignatures = new Set(pairs.map(pairSignature));
    const hasNewConflict = Array.from(nextPairSignatures).some((key) => !activePairsRef.current.has(key));
    activePairsRef.current = nextPairSignatures;
    if (hasNewConflict) void playConflictAlert();

    const nextGroups = groupPairs(pairs);
    setGroups((current) => {
      const currentSignature = JSON.stringify(current);
      const nextSignature = JSON.stringify(nextGroups);
      return currentSignature === nextSignature ? current : nextGroups;
    });
  }, [clearConflictMarks, plansByKey, playConflictAlert, radar]);

  useEffect(() => {
    zoomRef.current = readZoom();
    const onViewport = (event: Event) => {
      const zoom = Number((event as CustomEvent<{ zoom?: number }>).detail?.zoom);
      if (Number.isFinite(zoom) && zoom > 0) zoomRef.current = zoom;
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const locate = () => {
      const next = document.querySelector<HTMLElement>("main.fixed > section");
      if (next) setRadar(next);
      attempts += 1;
      if (next || attempts > 25) window.clearInterval(timer);
    };
    const timer = window.setInterval(locate, 160);
    locate();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("flight_plans").select("*").neq("status", "FINISHED");
      if (error) {
        console.error("PF24 conflict flight plan refresh failed:", error);
        return;
      }
      setPlans((data ?? []) as ScopeFlightPlan[]);
    };
    const channel = supabase
      .channel("scope-conflict-flight-plans-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_plans" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24ConflictDetection = "true";
    style.textContent = `
      [data-pf24-conflict-callsign='true'] {
        color: ${ORANGE} !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
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
    const queueScan = () => {
      if (scanQueuedRef.current) return;
      scanQueuedRef.current = true;
      window.requestAnimationFrame(() => {
        scanQueuedRef.current = false;
        scan();
      });
    };

    const observer = new MutationObserver(queueScan);
    observer.observe(radar, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    const timer = window.setInterval(scan, 250);
    scan();

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      activePairsRef.current.clear();
      clearConflictMarks();
      setGroups([]);
    };
  }, [clearConflictMarks, radar, scan]);

  if (!radar || groups.length === 0) return null;

  return createPortal(
    <div
      data-pf24-conflict-window="true"
      className="pointer-events-none absolute right-[12px] top-[160px] z-[85] w-[330px] border-2 border-[#ededed] bg-[#4a5156] font-mono text-[#ededed] shadow-[0_2px_7px_rgba(0,0,0,.45)]"
    >
      <div className="relative flex h-[29px] items-center justify-center border-b-2 border-[#ededed] text-[18px] tracking-[2px]">
        CONFLICT
        <span className="absolute right-[5px] top-[5px] h-[18px] w-[13px] bg-[#2b3237]" />
      </div>
      <div className="grid grid-cols-[1fr_78px_70px] border-b border-[#ededed] text-[14px] leading-[28px]">
        <span className="pl-[22px]">CALLSIGN</span>
        <span className="text-center">FL</span>
        <span className="text-center">NM</span>
      </div>

      {groups.map((group, groupIndex) => <div
        key={group.key}
        className={groupIndex > 0 ? "border-t-2 border-[#ededed]" : ""}
      >
        {group.rows.map((row) => <div
          key={row.id}
          className="grid grid-cols-[1fr_78px_70px] border-b border-[#ededed]/80 text-[16px] leading-[28px]"
        >
          <span className="truncate pl-[22px]" style={{ color: ORANGE }}>{row.callsign}</span>
          <span className="text-center" style={{ color: ORANGE }}>{String(Math.max(0, Math.round(row.altitudeFt / 100))).padStart(3, "0")}</span>
          <span className="text-center" style={{ color: ORANGE }}>{row.distanceNm.toFixed(1)}</span>
        </div>)}
      </div>)}
    </div>,
    radar,
  );
}
