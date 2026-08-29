"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  SCOPE_SERVER_EVENT,
  SCOPE_SERVER_MODE_KEY,
  SWEATBOX_ROOM_KEY,
  normalizeSweatboxRoom,
  readScopeServerMode,
  readSweatboxRoom,
  type ScopeServerMode,
} from "@/lib/scope/sweatbox";

export default function ScopeSweatboxConnect({ controllerName, canInstruct }: { controllerName: string; canInstruct: boolean }) {
  const [mode, setMode] = useState<ScopeServerMode>(() => readScopeServerMode());
  const [room, setRoom] = useState(() => readSweatboxRoom());
  const [serverHost, setServerHost] = useState<HTMLElement | null>(null);
  const [serverFieldset, setServerFieldset] = useState<HTMLFieldSetElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canInstruct && mode === "SWEATBOX_INSTRUCTOR") setMode("SWEATBOX");
  }, [canInstruct, mode]);

  useEffect(() => {
    let frame = 0;
    const locate = () => {
      frame = 0;
      const dialog = document.querySelector<HTMLElement>(".connectBox");
      if (!dialog) {
        setServerHost(null);
        setServerFieldset(null);
        return;
      }
      const fieldsets = Array.from(dialog.querySelectorAll<HTMLFieldSetElement>("fieldset"));
      const server = fieldsets.find((fieldset) => fieldset.querySelector("legend")?.textContent?.trim().toUpperCase() === "SERVER") ?? null;
      if (!server) return;
      const rows = Array.from(server.querySelectorAll<HTMLElement>(":scope > div"));
      const serverRow = rows.find((row) => row.firstElementChild?.textContent?.trim().toUpperCase() === "SERVER") ?? null;
      const value = serverRow?.lastElementChild as HTMLElement | null;
      if (value) {
        value.dataset.pf24SweatboxServerHost = "true";
        setServerHost(value);
      }
      setServerFieldset(server);
    };
    const queue = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(locate);
    };
    locate();
    const observer = new MutationObserver(queue);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".connectBox button") : null;
      if (!button) return;
      const text = button.textContent?.trim().toUpperCase() ?? "";
      if (text === "CONNECT") {
        const effectiveMode: ScopeServerMode = mode === "SWEATBOX_INSTRUCTOR" && !canInstruct ? "SWEATBOX" : mode;
        const cleanRoom = normalizeSweatboxRoom(room);
        if (effectiveMode !== "AUTOMATIC" && !cleanRoom) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setError("SweatBox room is required.");
          return;
        }
        const dialog = button.closest<HTMLElement>(".connectBox");
        const callsign = Array.from(dialog?.querySelectorAll<HTMLInputElement>("input") ?? [])
          .find((input) => input.getAttribute("list") === "scope-callsigns")?.value?.trim().toUpperCase() ?? "";
        localStorage.setItem(SCOPE_SERVER_MODE_KEY, effectiveMode);
        if (cleanRoom) localStorage.setItem(SWEATBOX_ROOM_KEY, cleanRoom);
        else localStorage.removeItem(SWEATBOX_ROOM_KEY);
        setMode(effectiveMode);
        setRoom(cleanRoom);
        setError("");
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent(SCOPE_SERVER_EVENT, {
            detail: {
              connected: true,
              mode: effectiveMode,
              room: cleanRoom,
              instructor: effectiveMode === "SWEATBOX_INSTRUCTOR" && canInstruct,
              controllerName,
              callsign,
            },
          }));
        }, 0);
      } else if (text === "DISCONNECT") {
        window.dispatchEvent(new CustomEvent(SCOPE_SERVER_EVENT, {
          detail: { connected: false, mode, room: normalizeSweatboxRoom(room), instructor: false, controllerName },
        }));
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [mode, room, canInstruct, controllerName]);

  const select = serverHost ? createPortal(
    <select
      value={mode}
      onChange={(event) => {
        const next = event.target.value as ScopeServerMode;
        setMode(next === "SWEATBOX_INSTRUCTOR" && !canInstruct ? "SWEATBOX" : next);
        setError("");
      }}
      className="absolute inset-0 h-full w-full border-0 bg-[#efefef] px-[4px] text-[10px] text-[#151515] outline-none"
      aria-label="Server"
    >
      <option value="AUTOMATIC">AUTOMATIC</option>
      <option value="SWEATBOX">SWEATBOX</option>
      {canInstruct && <option value="SWEATBOX_INSTRUCTOR">SWEATBOX INSTRUCTOR</option>}
    </select>,
    serverHost,
  ) : null;

  const roomRow = serverFieldset && mode !== "AUTOMATIC" ? createPortal(
    <div data-pf24-sweatbox-room-row="true" className="mb-1 grid grid-cols-[72px_1fr] items-center gap-1">
      <span>Room</span>
      <input
        value={room}
        maxLength={24}
        onChange={(event) => { setRoom(normalizeSweatboxRoom(event.target.value)); setError(""); }}
        placeholder="TRAINING-01"
        className="connectField w-full uppercase outline-none"
      />
      {error && <span className="col-span-2 text-right text-[9px] text-[#b00020]">{error}</span>}
    </div>,
    serverFieldset,
  ) : null;

  return <>{select}{roomRow}<style jsx global>{`[data-pf24-sweatbox-server-host='true']{position:relative!important;color:transparent!important;overflow:visible!important}`}</style></>;
}
