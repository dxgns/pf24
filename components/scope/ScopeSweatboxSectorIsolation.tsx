"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  SCOPE_SERVER_EVENT,
  SWEATBOX_SNAPSHOT_EVENT,
  readScopeServerMode,
  readSweatboxRoom,
  type SweatboxAircraft,
  type SweatboxSessionDetail,
  type SweatboxSnapshot,
} from "@/lib/scope/sweatbox";

const SECTOR_GRID = "grid-cols-[50px_38px_25px_39px_39px_31px_29px_1fr_40px_31px_18px]";

function scopeConnected() {
  const top = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(top?.querySelectorAll<HTMLButtonElement>("button") ?? []).some(
    (button) => button.textContent?.trim().toUpperCase() === "DISCONNECT",
  );
}

function findSectorWindow() {
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.toUpperCase().includes("SECTOR LIST")) ?? null;
}

function findNativeSectorList() {
  const win = findSectorWindow();
  if (!win) return null;
  return Array.from(win.children).find((child): child is HTMLElement =>
    child instanceof HTMLElement && child.dataset.pf24LiveSectorList === "true",
  ) ?? win.querySelector<HTMLElement>("[data-pf24-live-sector-list='true']");
}

function flightRule(value: string) {
  const upper = value.trim().toUpperCase();
  if (upper === "IFR") return "I";
  if (upper === "VFR") return "V";
  return upper.slice(0, 1);
}

function filedLevel(item: SweatboxAircraft) {
  const digits = item.flightPlan.flightLevel.replace(/\D/g, "");
  return digits || String(Math.max(0, Math.round(item.altitude / 100))).padStart(3, "0");
}

function status(item: SweatboxAircraft) {
  if (item.navMode === "LAND") return "APP";
  if (item.navMode === "TAKEOFF") return item.speed < 105 ? "DEP" : "CLB";
  if (item.navMode === "GO_AROUND") return "GA";
  if (item.navMode === "DIRECT") return "DCT";
  if (item.speed <= 2) return "STBY";
  return "MAN";
}

function procedure(item: SweatboxAircraft) {
  if (item.procedureCode) return item.procedureCode;
  if (item.navMode === "DIRECT") return item.navTarget || "DCT";
  return "";
}

function initialSession(): SweatboxSessionDetail {
  const mode = readScopeServerMode();
  return {
    connected: typeof window !== "undefined" ? scopeConnected() : false,
    mode,
    room: readSweatboxRoom(),
    instructor: mode === "SWEATBOX_INSTRUCTOR",
  };
}

export default function ScopeSweatboxSectorIsolation() {
  const [session, setSession] = useState<SweatboxSessionDetail>(() => initialSession());
  const [sectorHost, setSectorHost] = useState<HTMLElement | null>(null);
  const [traffic, setTraffic] = useState<SweatboxAircraft[]>([]);

  const active = session.connected && session.mode !== "AUTOMATIC" && Boolean(session.room);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setSession(detail);
      if (!detail.connected || detail.mode === "AUTOMATIC") setTraffic([]);
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, []);

  useEffect(() => {
    if (!active) {
      setSectorHost(null);
      return;
    }

    let frame = 0;
    const locate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setSectorHost((current) => current?.isConnected ? current : findNativeSectorList());
      });
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf24-menu-visibility-sync", locate);
    window.addEventListener("resize", locate);

    return () => {
      observer.disconnect();
      window.removeEventListener("pf24-menu-visibility-sync", locate);
      window.removeEventListener("resize", locate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !sectorHost) return;
    sectorHost.dataset.pf24SweatboxSectorLayer = "true";
    sectorHost.dataset.pf24SweatboxSectorHost = "true";
    return () => {
      delete sectorHost.dataset.pf24SweatboxSectorLayer;
      delete sectorHost.dataset.pf24SweatboxSectorHost;
    };
  }, [active, sectorHost]);

  useEffect(() => {
    const onSnapshot = (event: Event) => {
      const snapshot = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (!snapshot || snapshot.room !== session.room || !Array.isArray(snapshot.traffic)) return;
      setTraffic(snapshot.traffic);
    };
    window.addEventListener(SWEATBOX_SNAPSHOT_EVENT, onSnapshot);
    return () => window.removeEventListener(SWEATBOX_SNAPSHOT_EVENT, onSnapshot);
  }, [session.room]);

  useEffect(() => {
    if (!active || !session.room) return;
    const channel = supabase.channel(`pf24-sweatbox-sector-isolation-${session.room}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "snapshot" }, ({ payload }) => {
        const snapshot = payload as SweatboxSnapshot;
        if (!snapshot || snapshot.room !== session.room || !Array.isArray(snapshot.traffic)) return;
        setTraffic(snapshot.traffic);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [active, session.room]);

  const layer = active && sectorHost ? createPortal(
    <div data-pf24-sweatbox-sector-content="true" className="px-1 py-1 font-mono text-[9px] leading-[13px]">
      <div className={`grid ${SECTOR_GRID} text-[#d8d8d8]`}>
        <span>CALLSIGN</span><span>ATYP</span><span>FR</span><span>DEP</span><span>ARR</span><span>FL</span><span>RWY</span><span>PROCS</span><span>ASSR</span><span>STS</span><span className="text-center">C</span>
      </div>
      {traffic.map((item) => <div key={item.id} className={`grid ${SECTOR_GRID} text-[#00e000]`} data-pf24-sweatbox-sector-row={item.id}>
        <span className="truncate">{item.callsign}</span>
        <span className="truncate">{item.flightPlan.aircraft || item.aircraftType}</span>
        <span>{flightRule(item.flightPlan.flightRules)}</span>
        <span className="truncate">{item.flightPlan.departure}</span>
        <span className="truncate">{item.flightPlan.arrival}</span>
        <span>{filedLevel(item)}</span>
        <span className="truncate">{item.runway || ""}</span>
        <span className="truncate">{procedure(item)}</span>
        <span>----</span>
        <span className="truncate">{status(item)}</span>
        <span className={`mx-auto mt-[2px] h-[8px] w-[8px] border border-[#00e000] ${item.assumedBy ? "bg-[#00d600]" : ""}`} />
      </div>)}
      {traffic.length === 0 && <div className="pt-1 text-[8px] text-[#8c9694]">SWEATBOX · NO TRAFFIC IN ROOM {session.room}</div>}
    </div>,
    sectorHost,
  ) : null;

  return <>
    {layer}
    <style jsx global>{`
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-sector-host='true']{display:block!important}
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-sector-host='true'] > :not([data-pf24-sweatbox-sector-content='true']){display:none!important}
      html[data-pf24-sweatbox-active='true'] [data-pf24-sweatbox-sector-content='true']{display:block!important}
    `}</style>
  </>;
}
