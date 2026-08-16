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
    child instanceof HTMLElement && /^A\d{4}/.test(child.textContent?.trim().toUpperCase() ?? ""),
  );
}

function syncLabel(label: HTMLElement, active: boolean) {
  if (!active) {
    delete label.dataset.pf24MappActive;
    delete label.dataset.pf24MappMode;
    return;
  }

  label.dataset.pf24MappActive = "true";
  label.dataset.pf24MappMode = isDetailedLabel(label) ? "detailed" : "simple";
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

    const style = document.createElement("style");
    style.dataset.pf24MappState = "true";
    style.textContent = `
      ${LABEL_SELECTOR}[data-pf24-mapp-active='true'][data-pf24-mapp-mode='detailed'] > div:first-of-type {
        position: relative !important;
        overflow: visible !important;
      }
      ${LABEL_SELECTOR}[data-pf24-mapp-active='true'][data-pf24-mapp-mode='detailed'] > div:first-of-type::after {
        content: "MAPP";
        display: inline-block;
        margin-left: 9px;
        color: #ff6a00 !important;
        font-size: 9px;
        line-height: 8px;
        letter-spacing: -0.2px;
        font-weight: normal;
        pointer-events: none;
        white-space: nowrap;
      }

      ${LABEL_SELECTOR}[data-pf24-mapp-active='true'][data-pf24-mapp-mode='simple'] > div.relative {
        overflow: visible !important;
      }
      ${LABEL_SELECTOR}[data-pf24-mapp-active='true'][data-pf24-mapp-mode='simple'] > div.relative::after {
        content: "MAPP";
        position: absolute;
        left: 54px;
        top: 0;
        color: #ff6a00 !important;
        font-size: 9px;
        line-height: 9px;
        letter-spacing: -0.2px;
        font-weight: normal;
        pointer-events: none;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);

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

    const scheduleSync = () => {
      sync();
      window.setTimeout(sync, 0);
      window.setTimeout(sync, 40);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const menu = button?.closest<HTMLElement>(MENU_SELECTOR);
      const label = menu?.closest<HTMLElement>(LABEL_SELECTOR);

      if (button && menu && label) {
        const action = button.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
        if (action === "MAPP" || action === "XMAPP") {
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
          scheduleSync();
          return;
        }
      }

      // Selection changes swap the simple/detailed React tag. Re-apply the
      // persistent state immediately to the newly mounted tag without injecting
      ///removing text nodes, which avoids the previous MAPP flicker.
      window.setTimeout(sync, 0);
      window.setTimeout(sync, 40);
    };

    sync();
    const first = window.setTimeout(sync, 60);
    const second = window.setTimeout(sync, 240);
    const safety = window.setInterval(sync, 900);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearInterval(safety);
      document.removeEventListener("click", onClickCapture, true);
      style.remove();
    };
  }, []);

  return null;
}
