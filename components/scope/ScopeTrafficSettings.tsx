"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";

export type TrafficSettings = {
  trailCount: 2 | 3 | 4 | 5;
  trailFade: boolean;
  vectorMiles: 1 | 2 | 3;
};

export const TRAFFIC_SETTINGS_KEY = "pf24_scope_traffic_settings_v1";
export const TRAFFIC_SETTINGS_EVENT = "pf24-traffic-settings-change";

export const DEFAULT_TRAFFIC_SETTINGS: TrafficSettings = {
  trailCount: 5,
  trailFade: true,
  vectorMiles: 1,
};

export function readTrafficSettings(): TrafficSettings {
  if (typeof window === "undefined") return DEFAULT_TRAFFIC_SETTINGS;
  try {
    const value = JSON.parse(localStorage.getItem(TRAFFIC_SETTINGS_KEY) ?? "{}") as Partial<TrafficSettings>;
    const trailCount = [2, 3, 4, 5].includes(Number(value.trailCount))
      ? Number(value.trailCount) as TrafficSettings["trailCount"]
      : 5;
    const vectorMiles = [1, 2, 3].includes(Number(value.vectorMiles))
      ? Number(value.vectorMiles) as TrafficSettings["vectorMiles"]
      : 1;
    return {
      trailCount,
      trailFade: value.trailFade !== false,
      vectorMiles,
    };
  } catch {
    return DEFAULT_TRAFFIC_SETTINGS;
  }
}

function findGeneralHost(): HTMLElement | null {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent?.trim() === "General",
  );
  const dialog = button?.closest<HTMLElement>("div.absolute");
  if (!dialog || dialog.children.length < 2) return null;
  return dialog.children[1] as HTMLElement;
}

export default function ScopeTrafficSettings() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [generalActive, setGeneralActive] = useState(false);
  const [settings, setSettings] = useState<TrafficSettings>(() => readTrafficSettings());

  const syncHost = useCallback(() => setHost(findGeneralHost()), []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      const label = button?.textContent?.trim() ?? "";

      if (label === "Scope configuration") {
        window.setTimeout(() => {
          syncHost();
          setGeneralActive(true);
        }, 0);
        window.setTimeout(syncHost, 80);
        return;
      }

      if (label === "General") {
        window.setTimeout(syncHost, 0);
        setGeneralActive(true);
        return;
      }

      if (label === "Personalization" || label === "Guardar" || label === "Cancelar") {
        setGeneralActive(false);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [syncHost]);

  const update = (patch: Partial<TrafficSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(TRAFFIC_SETTINGS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<TrafficSettings>(TRAFFIC_SETTINGS_EVENT, { detail: next }));
      return next;
    });
  };

  if (!host || !generalActive) return null;

  return createPortal(
    <div
      data-pf24-general-traffic-settings="true"
      className="absolute left-[18px] right-[18px] top-[138px] border-t border-[#aaa] pt-[12px] font-mono text-[12px] text-[#111]"
    >
      <div className="mb-[9px] text-[11px] font-bold">Traffic display</div>
      <div className="grid grid-cols-[190px_170px] items-center gap-x-[14px] gap-y-[7px]">
        <span>Trail points</span>
        <select
          value={settings.trailCount}
          onChange={(event) => update({ trailCount: Number(event.target.value) as TrafficSettings["trailCount"] })}
          className="h-[23px] border border-[#aaa] bg-[#efefef] px-[7px] outline-none"
        >
          {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>

        <span>Trail visibility</span>
        <select
          value={settings.trailFade ? "fade" : "equal"}
          onChange={(event) => update({ trailFade: event.target.value === "fade" })}
          className="h-[23px] border border-[#aaa] bg-[#efefef] px-[7px] outline-none"
        >
          <option value="fade">Older points fade</option>
          <option value="equal">All points equal</option>
        </select>

        <span>Heading vector length</span>
        <select
          value={settings.vectorMiles}
          onChange={(event) => update({ vectorMiles: Number(event.target.value) as TrafficSettings["vectorMiles"] })}
          className="h-[23px] border border-[#aaa] bg-[#efefef] px-[7px] outline-none"
        >
          <option value={1}>1 NM</option>
          <option value={2}>2 NM</option>
          <option value={3}>3 NM</option>
        </select>
      </div>
    </div>,
    host,
  );
}
