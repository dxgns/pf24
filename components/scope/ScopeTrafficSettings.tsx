"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

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
    const trailCount = [2, 3, 4, 5].includes(Number(value.trailCount)) ? Number(value.trailCount) as TrafficSettings["trailCount"] : 5;
    const vectorMiles = [1, 2, 3].includes(Number(value.vectorMiles)) ? Number(value.vectorMiles) as TrafficSettings["vectorMiles"] : 1;
    return {
      trailCount,
      trailFade: value.trailFade !== false,
      vectorMiles,
    };
  } catch {
    return DEFAULT_TRAFFIC_SETTINGS;
  }
}

function findScopeConfiguration() {
  return Array.from(document.querySelectorAll<HTMLElement>("body div")).find((element) => {
    const text = element.textContent ?? "";
    return text.includes("Default scope zoom") && text.includes("General") && text.includes("Personalization");
  }) ?? null;
}

export default function ScopeTrafficSettings() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [settings, setSettings] = useState<TrafficSettings>(() => readTrafficSettings());

  useEffect(() => {
    const syncHost = () => {
      const next = findScopeConfiguration();
      setHost(next);
      if (!next) setActive(false);
    };

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      const label = button?.textContent?.trim() ?? "";
      if (label === "Scope configuration") {
        window.setTimeout(syncHost, 0);
        window.setTimeout(syncHost, 80);
        return;
      }
      if (host && button && host.contains(button) && label !== "Traffic") setActive(false);
      window.setTimeout(syncHost, 0);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [host]);

  const update = (patch: Partial<TrafficSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(TRAFFIC_SETTINGS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<TrafficSettings>(TRAFFIC_SETTINGS_EVENT, { detail: next }));
      return next;
    });
  };

  if (!host) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setActive(true);
        }}
        className={`absolute left-[196px] top-0 z-[4] flex h-[23px] items-center border-r border-white px-[12px] text-[14px] ${active ? "bg-[#d7d7d7]" : "bg-[#cecece]"}`}
      >Traffic</button>

      {active && <div className="absolute inset-x-0 bottom-[40px] top-[23px] z-[3] bg-[#cecece] px-[18px] pt-[24px] font-mono text-[13px] text-[#111]">
        <div className="mb-[18px] grid grid-cols-[230px_170px] items-center gap-[12px]">
          <span>Trail points</span>
          <select
            value={settings.trailCount}
            onChange={(event) => update({ trailCount: Number(event.target.value) as TrafficSettings["trailCount"] })}
            className="h-[24px] border border-[#aaa] bg-[#efefef] px-[8px] outline-none"
          >
            {[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>

          <span>Trail visibility</span>
          <select
            value={settings.trailFade ? "fade" : "equal"}
            onChange={(event) => update({ trailFade: event.target.value === "fade" })}
            className="h-[24px] border border-[#aaa] bg-[#efefef] px-[8px] outline-none"
          >
            <option value="fade">Older points fade</option>
            <option value="equal">All points equal</option>
          </select>

          <span>Heading vector length</span>
          <select
            value={settings.vectorMiles}
            onChange={(event) => update({ vectorMiles: Number(event.target.value) as TrafficSettings["vectorMiles"] })}
            className="h-[24px] border border-[#aaa] bg-[#efefef] px-[8px] outline-none"
          >
            <option value={1}>1 NM</option>
            <option value={2}>2 NM</option>
            <option value={3}>3 NM</option>
          </select>
        </div>
        <p className="max-w-[520px] text-[11px] leading-[16px] text-[#555]">
          Trail points are fixed historical positions. They appear as the aircraft moves and disappear as newer positions replace them.
        </p>
      </div>}
    </>,
    host,
  );
}
