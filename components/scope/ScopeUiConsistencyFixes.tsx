"use client";

import { useEffect, useRef } from "react";

const ATIS_CONFIG_KEY = "pf24_scope_atis_configs_v1";
const WEATHER_POSITION_KEY = "pf24_scope_weather_window_v2";
const WEATHER_VISIBILITY_KEY = "pf24_scope_weather_visibility_v1";
const WEATHER_DEFAULT = { x: 1265, y: 48 };

function findAtisDialog() {
  return document.querySelector<HTMLElement>("[data-pf24-atis-dialog='true']");
}

function findConfigDialog() {
  const general = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "General");
  const personalization = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Personalization");
  if (!general || !personalization) return null;
  const dialog = general.closest<HTMLElement>("div.absolute");
  return dialog && dialog.contains(personalization) ? dialog : null;
}

function normalizeAtisPreview(dialog: HTMLElement) {
  const candidates = Array.from(dialog.querySelectorAll<HTMLElement>("div"));
  const preview = candidates.find((node) => /\bATIS\s+INFO\s+[A-Z]\b/i.test(node.textContent ?? "") && node.className.includes("overflow-y-auto"));
  if (!preview) return;
  const current = preview.textContent ?? "";
  const cleaned = current.replace(/\b(Q\d{4})(?:\s+\1)+\b/gi, "$1");
  if (cleaned !== current) preview.textContent = cleaned;
}

function markFlightPlanDialogs() {
  const roots = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute"));
  for (const root of roots) {
    const first = root.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
    if (first !== "FLIGHT PLAN") continue;
    root.dataset.pf24FlightPlanDialog = "true";
  }
}

function fixConfigLabels() {
  const dialog = findConfigDialog();
  if (!dialog) return;
  for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))) {
    const label = button.textContent?.trim();
    if (label === "Cancelar") button.textContent = "Cancel";
    if (label === "Guardar") button.textContent = "Save";
  }
}

function syncSavedWeatherVisibility() {
  let saved: { atis?: boolean; metar?: boolean } = {};
  try { saved = JSON.parse(localStorage.getItem(WEATHER_VISIBILITY_KEY) ?? "{}"); } catch {}
  const weather = document.querySelector<HTMLElement>("[data-pf24-weather-window='true']");
  if (!weather) return;
  const headerText = weather.firstElementChild?.textContent?.toUpperCase() ?? "";
  const hasAtis = headerText.includes("ATIS");
  const wantsAtis = saved.atis === true;
  if (hasAtis !== wantsAtis) {
    window.dispatchEvent(new CustomEvent("pf24-weather-toggle", { detail: "atis" }));
  }
}

export default function ScopeUiConsistencyFixes() {
  const atisSnapshotRef = useRef<string | null>(null);
  const atisWasOpenRef = useRef(false);
  const atisCommittedRef = useRef(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24ConsistencyFixes = "true";
    style.textContent = `
      [data-pf24-weather-window='true'] { background:#555c61 !important; }
      [data-pf24-weather-window='true'] > div:not(:first-child) { background:#555c61 !important; }
      [data-pf24-weather-window='true'] > div:not(:first-child) button { background:transparent !important; }

      [data-pf24-live-hold-list='true'] { width:100% !important; max-width:100% !important; }
      [data-pf24-live-hold-list='true'] > div:first-child,
      [data-pf24-live-hold-list='true'] > div:nth-child(2) > div {
        grid-template-columns:minmax(0,1fr) 36px 36px !important;
      }
      [data-pf24-live-hold-list='true'] > div:first-child > :first-child,
      [data-pf24-live-hold-list='true'] > div:nth-child(2) > div > :first-child {
        display:none !important;
      }
      [data-pf24-live-hold-list='true'] > div:first-child > :nth-child(2),
      [data-pf24-live-hold-list='true'] > div:nth-child(2) > div > :nth-child(2) {
        min-width:0 !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important;
      }

      [data-pf24-flight-plan-dialog='true'] {
        width:640px !important;
        max-width:calc(100% - 32px) !important;
        padding:10px !important;
        font-size:12px !important;
      }
      [data-pf24-flight-plan-dialog='true'] > div:first-child { font-size:14px !important; margin-bottom:6px !important; }
      [data-pf24-flight-plan-dialog='true'] [class*='grid-cols-[170px'] { grid-template-columns:122px minmax(0,1fr) !important; }
      [data-pf24-flight-plan-dialog='true'] [class*='h-[150px]'] { height:92px !important; }
      [data-pf24-flight-plan-dialog='true'] [class*='text-[18px]'] { font-size:12px !important; }
    `;
    document.head.appendChild(style);

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button");
      if (!button) return;

      const dialog = button.closest<HTMLElement>("[data-pf24-atis-dialog='true']");
      if (dialog) {
        const action = button.textContent?.trim().toUpperCase() ?? "";
        if (action === "SEND") {
          atisCommittedRef.current = true;
          window.setTimeout(() => {
            atisSnapshotRef.current = localStorage.getItem(ATIS_CONFIG_KEY);
          }, 0);
        }
        if (action === "CANCEL") {
          if (atisSnapshotRef.current === null) localStorage.removeItem(ATIS_CONFIG_KEY);
          else localStorage.setItem(ATIS_CONFIG_KEY, atisSnapshotRef.current);
          atisCommittedRef.current = false;
        }
      }

      const weather = button.closest<HTMLElement>("[data-pf24-weather-window='true']");
      if (weather) {
        const header = weather.firstElementChild;
        const headerButtons = header ? Array.from(header.querySelectorAll<HTMLButtonElement>("button")) : [];
        if (headerButtons[0] === button) {
          event.preventDefault();
          event.stopPropagation();
          localStorage.setItem(WEATHER_POSITION_KEY, JSON.stringify(WEATHER_DEFAULT));
          weather.style.left = `${WEATHER_DEFAULT.x}px`;
          weather.style.top = `${WEATHER_DEFAULT.y}px`;
        }
      }
    };

    document.addEventListener("click", onClickCapture, true);

    let visibilityRestored = false;
    const sync = () => {
      const atis = findAtisDialog();
      if (atis) {
        if (!atisWasOpenRef.current) {
          atisSnapshotRef.current = localStorage.getItem(ATIS_CONFIG_KEY);
          atisCommittedRef.current = false;
        }
        atisWasOpenRef.current = true;
        normalizeAtisPreview(atis);
      } else if (atisWasOpenRef.current) {
        if (!atisCommittedRef.current) {
          if (atisSnapshotRef.current === null) localStorage.removeItem(ATIS_CONFIG_KEY);
          else localStorage.setItem(ATIS_CONFIG_KEY, atisSnapshotRef.current);
        }
        atisWasOpenRef.current = false;
        atisCommittedRef.current = false;
      }

      markFlightPlanDialogs();
      fixConfigLabels();
      if (!visibilityRestored) {
        syncSavedWeatherVisibility();
        visibilityRestored = true;
      }
    };

    sync();
    const timer = window.setInterval(sync, 120);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClickCapture, true);
      style.remove();
    };
  }, []);

  return null;
}
