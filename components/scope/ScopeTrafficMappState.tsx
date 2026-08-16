"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "pf24_scope_traffic_mapp_v1";
const LABEL_SELECTOR = "[data-pf24-traffic-label='true']";
const MENU_SELECTOR = "[data-pf24-callsign-menu='true']";

type MappState = Record<string, boolean>;

function readState(): MappState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as MappState : {};
  } catch {
    return {};
  }
}

function writeState(state: MappState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function trafficId(label: HTMLElement | null) {
  return label?.dataset.pf24TrafficId?.trim() ?? "";
}

function isDetailedLabel(label: HTMLElement) {
  return Array.from(label.children).some((child) =>
    child instanceof HTMLElement && /^A\d{4}$/.test(child.textContent?.trim().toUpperCase() ?? ""),
  );
}

function transponderRow(label: HTMLElement) {
  return Array.from(label.children).find((child): child is HTMLElement =>
    child instanceof HTMLElement && /^A\d{4}(?:\s*MAPP)?$/.test(child.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? ""),
  ) ?? null;
}

function syncLabel(label: HTMLElement, active: boolean) {
  const existing = label.querySelector<HTMLElement>("[data-pf24-mapp-indicator='true']");
  if (!active || !isDetailedLabel(label)) {
    existing?.remove();
    return;
  }

  const row = transponderRow(label);
  if (!row) return;
  if (existing) {
    existing.style.setProperty("color", "#ff6a00", "important");
    return;
  }

  const indicator = document.createElement("i");
  indicator.dataset.pf24MappIndicator = "true";
  indicator.textContent = "MAPP";
  indicator.style.fontStyle = "normal";
  indicator.style.display = "inline-block";
  indicator.style.marginLeft = "9px";
  indicator.style.color = "#ff6a00";
  indicator.style.lineHeight = "8px";
  indicator.style.fontSize = "9px";
  indicator.style.letterSpacing = "-0.2px";
  indicator.style.pointerEvents = "none";
  indicator.style.setProperty("color", "#ff6a00", "important");
  row.appendChild(indicator);
}

function syncMenu(menu: HTMLElement, active: boolean) {
  const button = Array.from(menu.querySelectorAll<HTMLButtonElement>(":scope > button")).find((candidate) => {
    const text = candidate.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
    return text === "MAPP" || text === "XMAPP";
  });
  if (button) button.textContent = active ? "XMAPP" : "MAPP";
}

export default function ScopeTrafficMappState() {
  const stateRef = useRef<MappState>({});

  useEffect(() => {
    stateRef.current = readState();

    const sync = () => {
      document.querySelectorAll<HTMLElement>(LABEL_SELECTOR).forEach((label) => {
        const id = trafficId(label);
        if (!id) return;
        const active = Boolean(stateRef.current[id]);
        syncLabel(label, active);
        const menu = label.querySelector<HTMLElement>(MENU_SELECTOR);
        if (menu) syncMenu(menu, active);
      });
    };

    const onClickCapture = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>(MENU_SELECTOR);
      const label = menu?.closest<HTMLElement>(LABEL_SELECTOR);
      if (!button || !menu || !label) return;

      const action = button.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
      if (action !== "MAPP" && action !== "XMAPP") return;

      const id = trafficId(label);
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const next = { ...stateRef.current };
      if (action === "MAPP") next[id] = true;
      else delete next[id];
      stateRef.current = next;
      writeState(next);
      sync();
    };

    sync();
    const first = window.setTimeout(sync, 60);
    const second = window.setTimeout(sync, 240);
    const timer = window.setInterval(sync, 180);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearInterval(timer);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return null;
}
