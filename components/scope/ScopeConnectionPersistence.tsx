"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "pf24_scope_connection_session_v1";

type StoredConnection = {
  callsign: string;
  facility: string;
  rating: string;
  password: string;
  discordName: string;
  robloxName: string;
  info4: string;
};

function topConnectButton() {
  const top = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(top?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []).find((button) => {
    const value = button.textContent?.trim().toUpperCase();
    return value === "CONNECT" || value === "DISCONNECT";
  }) ?? null;
}

function connectDialog() {
  return document.querySelector<HTMLElement>(".connectBox");
}

function scopeConnected() {
  return topConnectButton()?.textContent?.trim().toUpperCase() === "DISCONNECT";
}

function syncDialogLock() {
  const dialog = connectDialog();
  if (!dialog) return;
  const locked = scopeConnected();
  dialog.dataset.pf24ConnectionLocked = locked ? "true" : "false";
  dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((field) => {
    field.disabled = locked;
    field.setAttribute("aria-disabled", locked ? "true" : "false");
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function readDialogConnection(): StoredConnection | null {
  const dialog = connectDialog();
  if (!dialog) return null;
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>("input"));
  const facility = dialog.querySelector<HTMLSelectElement>("select");
  if (!inputs[0] || !facility) return null;
  return {
    callsign: inputs[0].value.trim().toUpperCase(),
    facility: facility.value,
    rating: inputs[1]?.value ?? "",
    password: inputs[2]?.value ?? "",
    discordName: inputs[3]?.value ?? "",
    robloxName: inputs[4]?.value ?? "",
    info4: inputs[5]?.value ?? "",
  };
}

function readStored(): StoredConnection | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign && parsed?.facility ? parsed : null;
  } catch {
    return null;
  }
}

function saveStored(value: StoredConnection) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function clearStored() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function emitConnection(connected: boolean, callsign = "") {
  window.dispatchEvent(new CustomEvent("pf24-scope-connection-change", { detail: { connected, callsign } }));
  if (!connected) window.dispatchEvent(new CustomEvent("pf24-scope-explicit-disconnect"));
}

export default function ScopeConnectionPersistence() {
  const restoringRef = useRef(false);

  useEffect(() => {
    const restore = () => {
      if (restoringRef.current) return;
      const stored = readStored();
      const topButton = topConnectButton();
      if (!stored || !topButton || topButton.textContent?.trim().toUpperCase() !== "CONNECT") return;

      restoringRef.current = true;
      topButton.click();

      window.setTimeout(() => {
        const dialog = connectDialog();
        if (!dialog) { restoringRef.current = false; return; }
        const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>("input"));
        const facility = dialog.querySelector<HTMLSelectElement>("select");
        if (!inputs[0] || !facility) { restoringRef.current = false; return; }

        setInputValue(inputs[0], stored.callsign);
        setSelectValue(facility, stored.facility);
        if (inputs[1]) setInputValue(inputs[1], stored.rating);
        if (inputs[2]) setInputValue(inputs[2], stored.password);
        if (inputs[3]) setInputValue(inputs[3], stored.discordName);
        if (inputs[4]) setInputValue(inputs[4], stored.robloxName);
        if (inputs[5]) setInputValue(inputs[5], stored.info4);

        window.setTimeout(() => {
          const connect = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Connect");
          if (connect && !connect.disabled) {
            connect.click();
            window.setTimeout(() => {
              emitConnection(true, stored.callsign);
              syncDialogLock();
            }, 0);
          }
          restoringRef.current = false;
        }, 80);
      }, 40);
    };

    const first = window.setTimeout(restore, 120);
    const second = window.setTimeout(restore, 320);
    const lockTimer = window.setInterval(syncDialogLock, 180);

    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const dialog = button.closest<HTMLElement>(".connectBox");
      if (!dialog) {
        window.setTimeout(syncDialogLock, 0);
        return;
      }
      const label = button.textContent?.trim();

      if (label === "Connect" && !button.disabled) {
        const data = readDialogConnection();
        if (!data) return;
        saveStored(data);
        window.setTimeout(() => {
          const connected = scopeConnected();
          if (connected) emitConnection(true, data.callsign);
          syncDialogLock();
        }, 0);
      }

      if (label === "Disconnect" && !button.disabled) {
        clearStored();
        window.setTimeout(() => {
          emitConnection(false);
          syncDialogLock();
        }, 0);
      }
    };

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("pf24-scope-connection-change", syncDialogLock);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearInterval(lockTimer);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pf24-scope-connection-change", syncDialogLock);
    };
  }, []);

  return null;
}
