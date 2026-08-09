"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type AirportConfig = {
  active: boolean;
  dep: string;
  arr: string;
  approach: string;
  remarks: string;
};

type ConfigMap = Record<string, AirportConfig>;

type LatestAtis = {
  info_letter: string;
  created_at: string;
};

const STORAGE_KEY = "pf24_scope_atis_configs_v1";
const HOUR_MS = 60 * 60 * 1000;

const RUNWAYS: Record<string, string[]> = {
  EFKT: ["16", "34"],
  EGHI: ["20", "02"],
  EGKK: ["26L", "08R"],
  GCLP: ["03L", "03R", "21L", "21R"],
  LCLK: ["22", "04"],
  LCPH: ["11", "29"],
  LCRA: ["10", "28"],
  LEMH: ["19", "01"],
  MDAB: ["11", "29"],
  MDCR: ["12", "30"],
  MDPC: ["26", "27", "08", "09"],
  MDST: ["11", "29"],
  MTCA: ["26", "08"],
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
  LCRA: 4000,
  LEMH: 3000,
  MDAB: 3000,
  MDCR: 3000,
  MDPC: 3000,
  MDST: 3000,
  MTCA: 3000,
};

const TRANSITION_LEVEL_TABLE = [
  { min: 942.2, max: 959.4, ta3000: 60, ta4000: 70 },
  { min: 959.5, max: 977.1, ta3000: 55, ta4000: 65 },
  { min: 977.2, max: 995.0, ta3000: 50, ta4000: 60 },
  { min: 995.1, max: 1013.2, ta3000: 45, ta4000: 55 },
  { min: 1013.3, max: 1031.6, ta3000: 40, ta4000: 50 },
  { min: 1031.7, max: 1050.3, ta3000: 35, ta4000: 45 },
] as const;

function emptyConfig(): AirportConfig {
  return { active: false, dep: "", arr: "", approach: "", remarks: "" };
}

function readConfigs(): ConfigMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ConfigMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfigs(configs: ConfigMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

function nextInfoLetter(letter?: string | null) {
  if (!letter || !/^[A-Z]$/.test(letter)) return "A";
  return letter === "Z" ? "A" : String.fromCharCode(letter.charCodeAt(0) + 1);
}

function extractQnhHpa(raw: string) {
  const qnh = raw.match(/\bQ(\d{4})\b/i)?.[1];
  if (qnh) return Number(qnh);
  const altimeter = raw.match(/\bA(\d{4})\b/i)?.[1];
  if (!altimeter) return null;
  return (Number(altimeter) / 100) * 33.8638866667;
}

function transitionLevel(airport: string, raw: string) {
  const ta = TA_BY_AIRPORT[airport];
  const qnh = extractQnhHpa(raw);
  if (!ta || qnh === null || !Number.isFinite(qnh)) return "---";
  const band = TRANSITION_LEVEL_TABLE.find(({ min, max }) => qnh >= min && qnh <= max);
  if (!band) return "---";
  return String(ta === 4000 ? band.ta4000 : band.ta3000).padStart(3, "0");
}

function metarTime(raw: string) {
  return raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/)?.[0] ?? "------Z";
}

function metarCore(raw: string) {
  return raw.replace(/^METAR\s+/i, "").replace(/^SPECI\s+/i, "").trim();
}

function buildFullText({
  airport,
  letter,
  metar,
  config,
  transLvl,
}: {
  airport: string;
  letter: string;
  metar: string;
  config: AirportConfig;
  transLvl: string;
}) {
  const approach = config.approach || "NO APPR";
  const dep = config.dep || "---";
  const arr = config.arr || "---";
  const ta = TA_BY_AIRPORT[airport];
  const remarks = config.remarks ? ` ${config.remarks}` : "";
  return `${airport} ATIS INFO ${letter}... ${metarCore(metar)}... AERONAVES ESPEREN APPR ${approach}... SALIDAS PISTA ${dep}... LLEGADAS PISTA ${arr}... TRANS ALT ${ta}FT TRANS LVL FL${transLvl}... XPDR MODO ALT EN TODAS LAS CALLES DE RODAJE Y PISTAS EN USO... NOTIFIQUE INFO ${letter} EN CONTACTO INICIAL${remarks}`;
}

async function latestAtis(airport: string): Promise<LatestAtis | null> {
  const { data } = await supabase
    .from("atis_messages")
    .select("info_letter,created_at")
    .eq("airport_icao", airport)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LatestAtis | null) ?? null;
}

async function fetchMetar(airport: string) {
  const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(airport)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("METAR unavailable");
  const data = await response.json() as { raw?: string | null };
  if (!data.raw) throw new Error("METAR unavailable");
  return data.raw;
}

export default function ScopeAtisDialog({ controllerName }: { controllerName: string }) {
  const airports = useMemo(() => Object.keys(RUNWAYS).sort(), []);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [airport, setAirport] = useState("MDPC");
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [infoLetter, setInfoLetter] = useState("A");
  const [metar, setMetar] = useState("");
  const [transLvl, setTransLvl] = useState("---");
  const [busy, setBusy] = useState(false);

  const config = configs[airport] ?? emptyConfig();
  const runwayOptions = [...(RUNWAYS[airport] ?? []), ...(COMBINED_RUNWAYS[airport] ?? [])];

  const loadAirportState = useCallback(async (icao: string) => {
    try {
      const [latest, raw] = await Promise.all([latestAtis(icao), fetchMetar(icao)]);
      const elapsed = latest ? Date.now() - new Date(latest.created_at).getTime() : Number.POSITIVE_INFINITY;
      setInfoLetter(latest && elapsed < HOUR_MS ? latest.info_letter : nextInfoLetter(latest?.info_letter));
      setMetar(raw);
      setTransLvl(transitionLevel(icao, raw));
    } catch {
      const latest = await latestAtis(icao);
      const elapsed = latest ? Date.now() - new Date(latest.created_at).getTime() : Number.POSITIVE_INFINITY;
      setInfoLetter(latest && elapsed < HOUR_MS ? latest.info_letter : nextInfoLetter(latest?.info_letter));
      setMetar("");
      setTransLvl("---");
    }
  }, []);

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>("main.fixed > section"));
    setConfigs(readConfigs());
    const toggle = () => setOpen((value) => !value);
    window.addEventListener("pf24-atis-dialog-toggle", toggle);
    return () => window.removeEventListener("pf24-atis-dialog-toggle", toggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadAirportState(airport);
  }, [airport, loadAirportState, open]);

  const patchConfig = (patch: Partial<AirportConfig>) => {
    setConfigs((current) => {
      const next = { ...current, [airport]: { ...(current[airport] ?? emptyConfig()), ...patch } };
      writeConfigs(next);
      return next;
    });
  };

  const setActive = async (active: boolean) => {
    patchConfig({ active });
    if (!active) {
      await supabase.from("atis_messages").delete().eq("airport_icao", airport);
    }
  };

  const publish = useCallback(async (icao: string, airportConfig: AirportConfig, force = false) => {
    if (!airportConfig.active) return false;
    if (!airportConfig.dep || !airportConfig.arr) return false;

    const latest = await latestAtis(icao);
    const latestTime = latest ? new Date(latest.created_at).getTime() : 0;
    const elapsed = latest ? Date.now() - latestTime : Number.POSITIVE_INFINITY;
    if (!force && latest && elapsed < HOUR_MS) return false;

    const raw = await fetchMetar(icao);
    const letter = latest ? nextInfoLetter(latest.info_letter) : "A";
    const tl = transitionLevel(icao, raw);
    const fullText = buildFullText({ airport: icao, letter, metar: raw, config: airportConfig, transLvl: tl });

    const { error } = await supabase.from("atis_messages").insert({
      airport_icao: icao,
      info_letter: letter,
      metar: raw,
      approach_primary: airportConfig.approach || "NO APPR",
      approach_optional: null,
      runway: `DEP ${airportConfig.dep} / ARR ${airportConfig.arr}`,
      extra_info: `TA ${TA_BY_AIRPORT[icao]}FT TL FL${tl}`,
      remarks: airportConfig.remarks || null,
      full_text: fullText,
      created_by: controllerName,
    });

    if (error) throw error;
    return true;
  }, [controllerName]);

  useEffect(() => {
    const check = async () => {
      const stored = readConfigs();
      for (const [icao, cfg] of Object.entries(stored)) {
        if (!cfg.active || !cfg.dep || !cfg.arr) continue;
        try {
          const updated = await publish(icao, cfg, false);
          if (updated && icao === airport) await loadAirportState(icao);
        } catch (error) {
          console.error("PF24 automatic ATIS update failed", icao, error);
        }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(timer);
  }, [airport, loadAirportState, publish]);

  const send = async () => {
    if (!config.active) {
      await supabase.from("atis_messages").delete().eq("airport_icao", airport);
      setOpen(false);
      return;
    }
    if (!config.dep || !config.arr) return;

    try {
      setBusy(true);
      const latest = await latestAtis(airport);
      const raw = await fetchMetar(airport);
      const elapsed = latest ? Date.now() - new Date(latest.created_at).getTime() : Number.POSITIVE_INFINITY;
      const letter = latest && elapsed < HOUR_MS ? latest.info_letter : nextInfoLetter(latest?.info_letter);
      const tl = transitionLevel(airport, raw);
      const fullText = buildFullText({ airport, letter, metar: raw, config, transLvl: tl });

      const { error } = await supabase.from("atis_messages").insert({
        airport_icao: airport,
        info_letter: letter,
        metar: raw,
        approach_primary: config.approach || "NO APPR",
        approach_optional: null,
        runway: `DEP ${config.dep} / ARR ${config.arr}`,
        extra_info: `TA ${TA_BY_AIRPORT[airport]}FT TL FL${tl}`,
        remarks: config.remarks || null,
        full_text: fullText,
        created_by: controllerName,
      });
      if (error) throw error;
      setInfoLetter(letter);
      setMetar(raw);
      setTransLvl(tl);
      setOpen(false);
    } catch (error) {
      console.error("PF24 ATIS publish failed", error);
    } finally {
      setBusy(false);
    }
  };

  if (!host || !open) return null;

  const preview = metar
    ? buildFullText({ airport, letter: infoLetter, metar, config, transLvl })
    : `${airport} ATIS INFO ${infoLetter}... METAR NO DISPONIBLE`;

  return createPortal(
    <div className="absolute left-1/2 top-1/2 z-[60] w-[620px] -translate-x-1/2 -translate-y-1/2 border border-[#777] bg-[#cecece] font-mono text-[12px] text-[#111] shadow-[0_0_0_1px_#111]" data-pf24-atis-dialog="true">
      <div className="h-[25px] px-[5px] pt-[3px] text-[14px]">ATIS dialog</div>
      <div className="grid grid-cols-[305px_1fr] gap-[10px] px-[10px] pb-[12px]">
        <div>
          <div className="mb-[16px] flex items-center justify-between pt-[22px]">
            <label className="flex items-center gap-[8px] text-[16px]">
              <span>ATIS Active</span>
              <button type="button" onClick={() => void setActive(!config.active)} className="relative h-[28px] w-[28px] bg-[#efefef]">
                {config.active && <><span className="absolute left-[2px] top-[13px] h-[2px] w-[32px] rotate-45 bg-[#111]"/><span className="absolute left-[2px] top-[13px] h-[2px] w-[32px] -rotate-45 bg-[#111]"/></>}
              </button>
            </label>
            <div className="flex items-center gap-[7px] text-[16px]"><span>ATIS Letter</span><span className="flex h-[28px] w-[28px] items-center justify-center bg-[#efefef] text-[24px]">{infoLetter}</span></div>
          </div>

          <div className="space-y-[9px]">
            <Field label="Airport"><select value={airport} onChange={(e) => setAirport(e.target.value)} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none">{airports.map((icao) => <option key={icao}>{icao}</option>)}</select></Field>
            <Field label="Runway DEP"><select value={config.dep} onChange={(e) => patchConfig({ dep: e.target.value })} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none"><option value="" />{runwayOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Runway ARR"><select value={config.arr} onChange={(e) => patchConfig({ arr: e.target.value })} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none"><option value="" />{runwayOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Appr Procedures"><input value={config.approach} maxLength={10} onChange={(e) => patchConfig({ approach: e.target.value.toUpperCase().slice(0, 10) })} className="h-[23px] w-full bg-[#ececec] px-[4px] uppercase outline-none" /></Field>
          </div>

          <div className="mt-[22px] grid grid-cols-2 gap-[24px] text-center">
            <div><div className="mb-[9px] text-[16px]">Trans Atl</div><div className="mx-auto flex h-[25px] w-[98px] items-center justify-center bg-[#ececec] text-[16px]">{TA_BY_AIRPORT[airport]}ft</div></div>
            <div><div className="mb-[9px] text-[16px]">Trans Lvl</div><div className="mx-auto flex h-[25px] w-[98px] items-center justify-center bg-[#ececec] text-[16px]">FL{transLvl}</div></div>
          </div>

          <div className="mt-[45px] flex justify-around">
            <button type="button" onClick={() => setOpen(false)} className="bg-[#ececec] px-[14px] py-[7px] text-[16px]">Cancel</button>
            <button type="button" disabled={busy || (config.active && (!config.dep || !config.arr))} onClick={() => void send()} className="bg-[#ececec] px-[18px] py-[7px] text-[16px] disabled:opacity-40">{busy ? "..." : "Send"}</button>
          </div>
        </div>

        <div>
          <div className="h-[215px] overflow-hidden bg-[#f0f0f0] p-[8px] text-[15px] leading-[1.45]">
            <div>{airport} ATIS INFO {infoLetter}... {metarTime(metar)}</div>
            <div className="whitespace-pre-wrap break-words">{preview.replace(`${airport} ATIS INFO ${infoLetter}... `, "")}</div>
          </div>
          <div className="mt-[6px] text-[16px]">Remarks</div>
          <textarea value={config.remarks} maxLength={30} onChange={(e) => patchConfig({ remarks: e.target.value.toUpperCase().slice(0, 30) })} className="mt-[3px] h-[100px] w-full resize-none bg-[#ececec] p-[5px] uppercase outline-none" />
        </div>
      </div>
    </div>,
    host,
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid grid-cols-[145px_1fr] items-center gap-[7px] text-[16px]"><span className="text-right">{label}</span>{children}</label>;
}
