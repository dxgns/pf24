"use client";

import { useEffect } from "react";

const STORAGE_KEY = "pf24_scope_connect_dialog_v2";

type StoredConnectDialog = {
  callsign?: string;
  facility?: string;
  rating?: string;
  password?: string;
  discordName?: string;
  robloxName?: string;
  info4?: string;
};

function readStored(): StoredConnectDialog {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as StoredConnectDialog
      : {};
  } catch {
    return {};
  }
}

function fieldKey(element: HTMLInputElement | HTMLSelectElement) {
  const row = element.closest("div.grid");
  const label = row?.querySelector<HTMLElement>(":scope > span")?.textContent?.trim().toUpperCase() ?? "";
  if (label === "CALLSIGN") return "callsign" as const;
  if (label === "FACILITY") return "facility" as const;
  if (label === "RATING") return "rating" as const;
  if (label === "PASSWORD") return "password" as const;
  if (label === "DISCORD NAME") return "discordName" as const;
  if (label === "ROBLOX NAME") return "robloxName" as const;
  if (label === "INFO LINE 4") return "info4" as const;
  return null;
}

function setReactValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  if (element instanceof HTMLSelectElement) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreDialog() {
  const dialog = document.querySelector<HTMLElement>(".connectBox");
  if (!dialog) return;
  const stored = readStored();
  dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((element) => {
    const key = fieldKey(element);
    if (!key) return;
    const value = stored[key];
    if (typeof value !== "string" || element.value === value) return;
    setReactValue(element, value);
  });
}

export default function ScopeConnectDialogPersistence() {
  useEffect(() => {
    const persistField = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;
      if (!element.closest(".connectBox")) return;
      const key = fieldKey(element);
      if (!key) return;
      const next = { ...readStored(), [key]: element.value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      const text = button?.textContent?.trim().toUpperCase() ?? "";
      if (text !== "CONNECT" && text !== "DISCONNECT") return;
      window.setTimeout(restoreDialog, 0);
      window.setTimeout(restoreDialog, 60);
      window.setTimeout(restoreDialog, 180);
    };

    document.addEventListener("input", persistField, true);
    document.addEventListener("change", persistField, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("input", persistField, true);
      document.removeEventListener("change", persistField, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
