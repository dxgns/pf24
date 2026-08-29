"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  SCOPE_SERVER_EVENT,
  SWEATBOX_ATIS_EVENT,
  readScopeServerMode,
  readSweatboxRoom,
  type SweatboxSessionDetail,
} from "@/lib/scope/sweatbox";

type AtisConfig = {
  airport: string;
  active: boolean;
  letter: string;
  dep: string;
  arr: string;
  approach: string;
  remarks: string;
  metar: string;
  transitionLevel: string;
  fullText: string;
  createdBy: string;
  createdAt: number;
};

type PresenceMeta = {
  controllerName?: string;
  callsign?: string;
  instructor?: boolean;
  joinedAt?: number;
};

const RUNWAYS: Record<string, string[]> = {
  EFKT: ["16", "34"],
  EGHI: ["20", "02"],
  EGKK: ["26L", "08R"],
  GCLP: ["03L", "03R", "21L", "21R"],
  LCLK: ["22", "04"],
  LCPH: ["11", "29"],
  LEMH: ["19", "01"],
  MDPC: ["26", "27", "08", "09"],
  MDST: ["11", "29"],
};

const COMBINED_RUNWAYS: Record<string, string[]> = {
  GCLP: ["03L/03R", "21L/21R"],
  MDPC: ["08/09", "26/27"],
};

const TA_BY_AIRPORT: Record<string, 3000 | 4000> = {
  EFKT: 3000,
  EGHI: 3000,
  EGKK: 3000,
  GCLP: 3000,
  LCLK: 4000,
  LCPH: 4000,
  LEMH: 3000,
  MDPC: 3000,
  MDST: 3000,
};

const TL_TABLE = [
  { min: 942.2, max: 959.4, ta3000: 60, ta4000: 70 },
  { min: 959.5, max: 977.1, ta3000: 55, ta4000: 65 },
  { min: 977.2, max: 995.0, ta3000: 50, ta4000: 60 },
  { min: 995.1, max: 1013.2, ta3000: 45, ta4000: 55 },
  { min: 1013.3, max: 1031.6, ta3000: 40, ta4000: 50 },
  { min: 1031.7, max: 1050.3, ta3000: 35, ta4000: 45 },
] as const;

function qnh(raw: string) {
  const q = raw.match(/\bQ(\d{4})\b/i)?.[1];
  if (q) return Number(q);
  const a = raw.match(/\bA(\d{4})\b/i)?.[1];
  return a ? (Number(a) / 100) * 33.8638866667 : null;
}

function transitionLevel(airport: string, raw: string) {
  const value = qnh(raw);
  const ta = TA_BY_AIRPORT[airport];
  if (value === null || !ta) return "---";
  const band = TL_TABLE.find((item) => value >= item.min && value <= item.max);
  return band ? String(ta === 4000 ? band.ta4000 : band.ta3000).padStart(3, "0") : "---";
}

function metarCore(raw: string) {
  return raw.replace(/^METAR\s+/i, "").replace(/^SPECI\s+/i, "").trim();
}

function nextLetter(letter: string) {
  const current = /^[A-Z]$/.test(letter) ? letter : "A";
  return current === "Z" ? "A" : String.fromCharCode(current.charCodeAt(0) + 1);
}

function previousLetter(letter: string) {
  const current = /^[A-Z]$/.test(letter) ? letter : "A";
  return current === "A" ? "Z" : String.fromCharCode(current.charCodeAt(0) - 1);
}

function buildText(config: Pick<AtisConfig, "airport" | "letter" | "dep" | "arr" | "approach" | "remarks" | "metar" | "transitionLevel">) {
  const ta = TA_BY_AIRPORT[config.airport] ?? 3000;
  return `${config.airport} ATIS INFO ${config.letter}... ${metarCore(config.metar)}... AERONAVES ESPEREN APPR ${config.approach || "NO APPR"}... SALIDAS PISTA ${config.dep || "---"}... LLEGADAS PISTA ${config.arr || "---"}... TRANS ALT ${ta}FT TRANS LVL FL${config.transitionLevel}... XPDR MODO ALT EN TODAS LAS CALLES DE RODAJE Y PISTAS EN USO... NOTIFIQUE INFO ${config.letter} EN CONTACTO INICIAL${config.remarks ? ` ${config.remarks}` : ""}`;
}

function blankAtis(airport = "MDPC"): AtisConfig {
  return {
    airport,
    active: false,
    letter: "A",
    dep: "",
    arr: "",
    approach: "",
    remarks: "",
    metar: "",
    transitionLevel: "---",
    fullText: "",
    createdBy: "",
    createdAt: 0,
  };
}

function sessionFromStorage(): SweatboxSessionDetail {
  const mode = readScopeServerMode();
  return {
    connected: false,
    mode,
    room: readSweatboxRoom(),
    instructor: mode === "SWEATBOX_INSTRUCTOR",
  };
}

function uniquePresence(state: Record<string, unknown[]>) {
  const rows: PresenceMeta[] = [];
  const seen = new Set<string>();
  for (const values of Object.values(state)) {
    for (const value of values) {
      const meta = value as PresenceMeta;
      const name = String(meta.controllerName ?? "").trim();
      const callsign = String(meta.callsign ?? "").trim().toUpperCase();
      if (!name && !callsign) continue;
      const key = `${name}|${callsign}|${Boolean(meta.instructor)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(meta);
    }
  }
  return rows.sort((a, b) => String(a.callsign ?? a.controllerName ?? "").localeCompare(String(b.callsign ?? b.controllerName ?? "")));
}

export default function ScopeSweatboxConsoleBridge({ controllerName, canInstruct }: { controllerName: string; canInstruct: boolean }) {
  const [session, setSession] = useState<SweatboxSessionDetail>(() => sessionFromStorage());
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [sectorHost, setSectorHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [airport, setAirport] = useState("MDPC");
  const [drafts, setDrafts] = useState<Record<string, AtisConfig>>({});
  const [published, setPublished] = useState<Record<string, AtisConfig>>({});
  const [members, setMembers] = useState<PresenceMeta[]>([]);
  const [busy, setBusy] = useState(false);

  const sweatbox = session.connected && session.mode !== "AUTOMATIC" && Boolean(session.room);
  const instructor = sweatbox && session.mode === "SWEATBOX_INSTRUCTOR" && canInstruct;
  const current = drafts[airport] ?? published[airport] ?? blankAtis(airport);
  const airports = useMemo(() => Object.keys(RUNWAYS).sort(), []);
  const runwayOptions = useMemo(() => [...(RUNWAYS[airport] ?? []), ...(COMBINED_RUNWAYS[airport] ?? [])], [airport]);

  useEffect(() => {
    const locate = () => {
      setHost(document.querySelector<HTMLElement>("main.fixed > section"));
      setSectorHost(document.querySelector<HTMLElement>("[data-pf24-native-list-body='sector']"));
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setSession({ ...detail, instructor: detail.instructor && canInstruct });
      if (!detail.connected || detail.mode === "AUTOMATIC") {
        setOpen(false);
        setMembers([]);
        setPublished({});
      }
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, [canInstruct]);

  useEffect(() => {
    if (sweatbox) document.documentElement.dataset.pf24SweatboxActive = "true";
    else delete document.documentElement.dataset.pf24SweatboxActive;
    return () => { delete document.documentElement.dataset.pf24SweatboxActive; };
  }, [sweatbox]);

  useEffect(() => {
    if (!sweatbox) return;
    // Join the exact same topic as the simulation runtime. The console is a
    // read-only listener here; the runtime remains the single broadcaster for
    // traffic/ATIS snapshots and the single presence tracker for this browser.
    const channel = supabase.channel(`pf24-sweatbox-${session.room}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "snapshot" }, ({ payload }) => {
        const snapshot = payload as { atis?: Record<string, unknown> };
        const next: Record<string, AtisConfig> = {};
        for (const [icao, value] of Object.entries(snapshot?.atis ?? {})) {
          if (value && typeof value === "object") next[icao] = value as AtisConfig;
        }
        if (Object.keys(next).length) setPublished((currentPublished) => ({ ...currentPublished, ...next }));
      })
      .on("broadcast", { event: "atis" }, ({ payload }) => {
        const detail = payload as { airport?: string; data?: unknown };
        if (!detail?.airport || !detail.data || typeof detail.data !== "object") return;
        setPublished((existing) => ({ ...existing, [detail.airport!]: detail.data as AtisConfig }));
      })
      .on("presence", { event: "sync" }, () => {
        setMembers(uniquePresence(channel.presenceState() as unknown as Record<string, unknown[]>));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [sweatbox, session.room]);

  useEffect(() => {
    const interceptAtis = (event: MouseEvent) => {
      if (!sweatbox) return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button[data-pf24-top-atis='true']");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen((value) => !value);
    };
    window.addEventListener("click", interceptAtis, true);
    return () => window.removeEventListener("click", interceptAtis, true);
  }, [sweatbox]);

  useEffect(() => {
    if (!open || !sweatbox) return;
    const existing = drafts[airport] ?? published[airport];
    if (existing?.metar) return;
    let cancelled = false;
    void fetch(`/api/scope/metar?station=${encodeURIComponent(airport)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { raw?: string | null };
        if (!response.ok || !data.raw || cancelled) return;
        setDrafts((currentDrafts) => {
          const base = currentDrafts[airport] ?? published[airport] ?? blankAtis(airport);
          const tl = transitionLevel(airport, data.raw!);
          const next = { ...base, airport, metar: data.raw!, transitionLevel: tl };
          return { ...currentDrafts, [airport]: { ...next, fullText: buildText(next) } };
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [open, sweatbox, airport, drafts, published]);

  const patch = useCallback((value: Partial<AtisConfig>) => {
    setDrafts((currentDrafts) => {
      const base = currentDrafts[airport] ?? published[airport] ?? blankAtis(airport);
      const next = { ...base, ...value, airport };
      return { ...currentDrafts, [airport]: { ...next, fullText: buildText(next) } };
    });
  }, [airport, published]);

  const send = async () => {
    if (!instructor || busy || !current.active || !current.dep || !current.arr) return;
    setBusy(true);
    try {
      let metar = current.metar;
      if (!metar) {
        const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(airport)}`, { cache: "no-store" });
        const data = await response.json() as { raw?: string | null };
        metar = data.raw ?? "METAR NO DISPONIBLE";
      }
      const tl = transitionLevel(airport, metar);
      const data: AtisConfig = {
        ...current,
        airport,
        metar,
        transitionLevel: tl,
        createdBy: controllerName,
        createdAt: Date.now(),
        fullText: buildText({ ...current, airport, metar, transitionLevel: tl }),
      };
      setDrafts((existing) => ({ ...existing, [airport]: data }));
      setPublished((existing) => ({ ...existing, [airport]: data }));
      window.dispatchEvent(new CustomEvent(SWEATBOX_ATIS_EVENT, { detail: { airport, data } }));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const sectorLayer = sweatbox && sectorHost ? createPortal(
    <div data-pf24-sweatbox-sector-layer="true" className="min-h-[72px] bg-[#555c61] font-mono text-[10px] leading-[16px] text-[#e8e8e8]">
      <div className="grid grid-cols-[110px_1fr_75px] border-b border-[#d9d9d9] text-[9px] text-[#d8d8d8]"><span className="px-1">POSITION</span><span>CONTROLLER</span><span>MODE</span></div>
      {members.length === 0 ? <div className="px-1 py-2 text-[#bcbcbc]">SWEATBOX ROOM {session.room}</div> : members.map((member, index) => <div key={`${member.controllerName}-${member.callsign}-${index}`} className="grid grid-cols-[110px_1fr_75px] border-b border-[#6a7073]">
        <span className="truncate px-1 text-[#00efff]">{member.callsign || "SWEATBOX"}</span>
        <span className="truncate">{member.controllerName || "ATC"}</span>
        <span className={member.instructor ? "text-[#ffff00]" : "text-[#9cff9c]"}>{member.instructor ? "INSTRUCTOR" : "STUDENT"}</span>
      </div>)}
    </div>,
    sectorHost,
  ) : null;

  const atisDialog = sweatbox && host && open ? createPortal(
    <div className="absolute left-1/2 top-1/2 z-[260] w-[620px] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-[#777] bg-[#cecece] font-mono text-[12px] text-[#111] shadow-[0_0_0_1px_#111]" data-pf24-atis-dialog="true" data-pf24-sweatbox-atis="true">
      <div className="flex h-[25px] items-center justify-between px-[5px] pt-[3px] text-[14px]"><span>ATIS dialog · SWEATBOX {session.room}</span><span className={instructor ? "text-[#8a6200]" : "text-[#555]"}>{instructor ? "INSTRUCTOR" : "READ ONLY"}</span></div>
      <div className="grid grid-cols-[305px_1fr] gap-[10px] px-[10px] pb-[12px]">
        <div>
          <div className="mb-[16px] flex items-center justify-between pt-[22px]">
            <label className="flex items-center gap-[8px] text-[16px]"><span>ATIS Active</span><button type="button" disabled={!instructor} onClick={() => patch({ active: !current.active })} className="relative h-[28px] w-[28px] overflow-hidden bg-[#efefef] disabled:opacity-50">{current.active && <><span className="absolute left-[3px] top-[13px] h-[2px] w-[22px] rotate-45 bg-[#111]"/><span className="absolute left-[3px] top-[13px] h-[2px] w-[22px] -rotate-45 bg-[#111]"/></>}</button></label>
            <div className="flex items-center gap-[7px] text-[16px]"><span>ATIS Letter</span><button type="button" disabled={!instructor} onClick={() => patch({ letter: previousLetter(current.letter) })} onContextMenu={(event) => { event.preventDefault(); if (instructor) patch({ letter: nextLetter(current.letter) }); }} className="flex h-[28px] w-[28px] items-center justify-center bg-[#efefef] text-[24px] disabled:opacity-60">{current.letter}</button></div>
          </div>
          <div className="space-y-[9px]">
            <AtisField label="Airport"><select value={airport} onChange={(event) => setAirport(event.target.value)} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none">{airports.map((icao) => <option key={icao}>{icao}</option>)}</select></AtisField>
            <AtisField label="Runway DEP"><select disabled={!instructor} value={current.dep} onChange={(event) => patch({ dep: event.target.value })} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none disabled:opacity-60"><option value=""/>{runwayOptions.map((runway) => <option key={runway}>{runway}</option>)}</select></AtisField>
            <AtisField label="Runway ARR"><select disabled={!instructor} value={current.arr} onChange={(event) => patch({ arr: event.target.value })} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none disabled:opacity-60"><option value=""/>{runwayOptions.map((runway) => <option key={runway}>{runway}</option>)}</select></AtisField>
            <AtisField label="Appr Procedures"><input disabled={!instructor} value={current.approach} maxLength={15} onChange={(event) => patch({ approach: event.target.value.toUpperCase().slice(0, 15) })} className="h-[23px] w-full bg-[#ececec] px-[4px] uppercase outline-none disabled:opacity-60"/></AtisField>
          </div>
          <div className="mt-[22px] grid grid-cols-2 gap-[24px] text-center"><div><div className="mb-[9px] text-[16px]">Trans Alt</div><div className="mx-auto flex h-[25px] w-[98px] items-center justify-center bg-[#ececec] text-[16px]">{TA_BY_AIRPORT[airport]}ft</div></div><div><div className="mb-[9px] text-[16px]">Trans Lvl</div><div className="mx-auto flex h-[25px] w-[98px] items-center justify-center bg-[#ececec] text-[16px]">FL{current.transitionLevel}</div></div></div>
          <div className="mt-[45px] flex justify-around"><button type="button" onClick={() => setOpen(false)} className="bg-[#ececec] px-[14px] py-[7px] text-[16px]">Cancel</button>{instructor && <button type="button" disabled={busy || !current.active || !current.dep || !current.arr} onClick={() => void send()} className="bg-[#ececec] px-[18px] py-[7px] text-[16px] disabled:opacity-40">{busy ? "..." : "Send"}</button>}</div>
        </div>
        <div className="min-w-0 overflow-hidden"><div className="h-[215px] w-full overflow-y-auto overflow-x-hidden bg-[#f0f0f0] p-[8px] text-[11px] leading-[1.35] [overflow-wrap:anywhere]">{current.fullText || (current.metar ? buildText(current) : `${airport} ATIS... METAR LOADING`)}</div><div className="mt-[6px] text-[16px]">Remarks</div><textarea disabled={!instructor} value={current.remarks} maxLength={40} onChange={(event) => patch({ remarks: event.target.value.toUpperCase().slice(0, 40) })} className="mt-[3px] h-[100px] w-full resize-none overflow-x-hidden bg-[#ececec] p-[5px] uppercase outline-none disabled:opacity-60 [overflow-wrap:anywhere]"/></div>
      </div>
    </div>,
    host,
  ) : null;

  return <>{sectorLayer}{atisDialog}<style jsx global>{`html[data-pf24-sweatbox-active='true'] [data-pf24-native-list-body='sector'] > :not([data-pf24-sweatbox-sector-layer='true']){display:none!important}`}</style></>;
}

function AtisField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-[145px_1fr] items-center gap-[7px] text-[16px]"><span className="text-right">{label}</span>{children}</label>;
}
