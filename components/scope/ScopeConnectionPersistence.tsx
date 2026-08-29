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

function rowByLabel(dialog: HTMLElement, label: string) {
  const target = label.trim().toUpperCase();
  return Array.from(dialog.querySelectorAll<HTMLElement>("div.grid")).find((row) => {
    const first = row.firstElementChild?.textContent?.trim().toUpperCase() ?? "";
    return first === target;
  }) ?? null;
}

function inputByLabel(dialog: HTMLElement, label: string) {
  return rowByLabel(dialog, label)?.querySelector<HTMLInputElement>("input") ?? null;
}

function selectByLabel(dialog: HTMLElement, label: string) {
  return rowByLabel(dialog, label)?.querySelector<HTMLSelectElement>("select") ?? null;
}

function connectionFields(dialog: HTMLElement) {
  return {
    callsign: inputByLabel(dialog, "Callsign"),
    facility: selectByLabel(dialog, "Facility"),
    rating: inputByLabel(dialog, "Rating"),
    password: inputByLabel(dialog, "Password"),
    discordName: inputByLabel(dialog, "DISCORD name"),
    robloxName: inputByLabel(dialog, "ROBLOX name"),
    info4: inputByLabel(dialog, "INFO line 4"),
  };
}

function readDialogConnection(): StoredConnection | null {
  const dialog = connectDialog();
  if (!dialog) return null;
  const fields = connectionFields(dialog);
  if (!fields.callsign || !fields.facility) return null;
  return {
    callsign: fields.callsign.value.trim().toUpperCase(),
    facility: fields.facility.value,
    rating: fields.rating?.value ?? "",
    password: fields.password?.value ?? "",
    discordName: fields.discordName?.value ?? "",
    robloxName: fields.robloxName?.value ?? "",
    info4: fields.info4?.value ?? "",
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
        const fields = connectionFields(dialog);
        if (!fields.callsign || !fields.facility) { restoringRef.current = false; return; }

        setInputValue(fields.callsign, stored.callsign);
        setSelectValue(fields.facility, stored.facility);
        if (fields.rating) setInputValue(fields.rating, stored.rating);
        if (fields.password) setInputValue(fields.password, stored.password);
        if (fields.discordName) setInputValue(fields.discordName, stored.discordName);
        if (fields.robloxName) setInputValue(fields.robloxName, stored.robloxName);
        if (fields.info4) setInputValue(fields.info4, stored.info4);

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
