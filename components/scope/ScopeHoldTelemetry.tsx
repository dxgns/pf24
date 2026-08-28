"use client";

import { useEffect } from "react";
import { normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";

type ControlState = { assignedAltitude?: string };
type ControlMap = Record<string, ControlState>;

const CONTROLS_KEY = "pf24_scope_traffic_controls_v1";
const HOLD_SELECTOR = "[data-pf24-live-hold-list='true']";
const TRAFFIC_SELECTOR = "[data-pf24-traffic-label='true']";
const LIVE_TRAFFIC_SELECTOR = "[data-pf24-live-traffic='true']";

function norm(value: string) {
  return normalizeGameCallsign(value);
}

function readControls(): ControlMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTROLS_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ControlMap : {};
  } catch {
    return {};
  }
}

function labelCallsign(label: HTMLElement) {
  const button = Array.from(label.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    if (candidate.closest("[data-pf24-callsign-menu='true']")) return false;
    return /^[A-Z0-9-]{2,12}$/.test(candidate.textContent?.trim().toUpperCase() ?? "");
  });
  return button?.textContent?.trim().toUpperCase() ?? "";
}

function currentFlightLevel(label: HTMLElement) {
  const simpleRow = label.querySelector<HTMLElement>(":scope > span.grid");
  const simpleText = simpleRow?.firstElementChild?.textContent?.trim() ?? "";
  const detailedRows = Array.from(label.querySelectorAll<HTMLElement>(":scope > div.grid"));
  const detailedText = detailedRows[1]?.firstElementChild?.textContent?.trim() ?? "";
  const text = detailedText || simpleText;
  const match = text.match(/\d{3}/);
  return match?.[0] ?? "---";
}

function mutationTouchesHoldTelemetry(mutations: MutationRecord[]) {
  return mutations.some((mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    if (target?.closest(HOLD_SELECTOR) || target?.closest(LIVE_TRAFFIC_SELECTOR)) return true;

    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      return node.matches(HOLD_SELECTOR) ||
        node.matches(LIVE_TRAFFIC_SELECTOR) ||
        Boolean(node.querySelector(HOLD_SELECTOR)) ||
        Boolean(node.querySelector(LIVE_TRAFFIC_SELECTOR));
    });
  });
}

export default function ScopeHoldTelemetry() {
  useEffect(() => {
    let frame = 0;

    const sync = () => {
      frame = 0;
      const hold = document.querySelector<HTMLElement>(HOLD_SELECTOR);
      if (!hold) return;

      const controls = readControls();
      const telemetry = new Map<string, { fl: string; afl: string }>();
      document.querySelectorAll<HTMLElement>(TRAFFIC_SELECTOR).forEach((label) => {
        const callsign = labelCallsign(label);
        const id = label.dataset.pf24TrafficId ?? "";
        if (!callsign || !id) return;
        const assigned = controls[id]?.assignedAltitude;
        telemetry.set(norm(callsign), {
          fl: currentFlightLevel(label),
          afl: /^\d{3}$/.test(assigned ?? "") ? assigned as string : "000",
        });
      });

      const body = Array.from(hold.children).find((child) => child instanceof HTMLElement && child.classList.contains("min-h-[78px]"));
      if (!(body instanceof HTMLElement)) return;
      Array.from(body.children).forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const cells = Array.from(row.children).filter((cell): cell is HTMLElement => cell instanceof HTMLElement);
        const callsign = cells[1]?.textContent?.trim().toUpperCase() ?? "";
        const values = telemetry.get(norm(callsign));
        if (!values) return;
        if (cells[2] && cells[2].textContent !== values.fl) cells[2].textContent = values.fl;
        if (cells[3] && cells[3].textContent !== values.afl) cells[3].textContent = values.afl;
      });
    };

    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver((mutations) => {
      if (mutationTouchesHoldTelemetry(mutations)) queueSync();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const onHoldSync = () => queueSync();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CONTROLS_KEY) queueSync();
    };
    const onTrafficInteraction = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(LIVE_TRAFFIC_SELECTOR)) return;
      window.setTimeout(queueSync, 0);
    };

    window.addEventListener("pf24-hold-sync", onHoldSync);
    window.addEventListener("storage", onStorage);
    document.addEventListener("click", onTrafficInteraction, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pf24-hold-sync", onHoldSync);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("click", onTrafficInteraction, true);
    };
  }, []);

  return null;
}
