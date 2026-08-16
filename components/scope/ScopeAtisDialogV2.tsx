"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type AirportConfig = { active: boolean; dep: string; arr: string; approach: string; remarks: string };
type ConfigMap = Record<string, AirportConfig>;
type LatestAtis = { info_letter: string; created_at: string; created_by: string | null };
type PublishedAtis = Record<string, { letter: string; createdBy: string }>;

const STORAGE_KEY = "pf24_scope_atis_configs_v1";
const HOUR_MS = 60 * 60 * 1000;
const MAX_PUBLISHED_ATIS = 5;
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

function emptyConfig(): AirportConfig {
  return { active: false, dep: "", arr: "", approach: "", remarks: "" };
}
function readConfigs(): ConfigMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as ConfigMap;
  } catch {
    return {};
  }
}
function writeConfigs(value: ConfigMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
function nextLetter(letter?: string | null) {
  if (!letter || !/^[A-Z]$/.test(letter)) return "A";
  return letter === "Z" ? "A" : String.fromCharCode(letter.charCodeAt(0) + 1);
}
function previousLetter(letter?: string | null) {
  if (!letter || !/^[A-Z]$/.test(letter)) return "Z";
  return letter === "A" ? "Z" : String.fromCharCode(letter.charCodeAt(0) - 1);
}
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
function buildText(airport: string, letter: string, metar: string, config: AirportConfig, tl: string) {
  return `${airport} ATIS INFO ${letter}... ${metarCore(metar)}... AERONAVES ESPEREN APPR ${config.approach || "NO APPR"}... SALIDAS PISTA ${config.dep || "---"}... LLEGADAS PISTA ${config.arr || "---"}... TRANS ALT ${TA_BY_AIRPORT[airport]}FT TRANS LVL FL${tl}... XPDR MODO ALT EN TODAS LAS CALLES DE RODAJE Y PISTAS EN USO... NOTIFIQUE INFO ${letter} EN CONTACTO INICIAL${config.remarks ? ` ${config.remarks}` : ""}`;
}
async function latestAtis(airport: string): Promise<LatestAtis | null> {
  const { data } = await supabase
    .from("atis_messages")
    .select("info_letter,created_at,created_by")
    .eq("airport_icao", airport)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as LatestAtis | null;
}
async function fetchMetar(airport: string) {
  const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(airport)}`, { cache: "no-store" });
  const data = await response.json() as { raw?: string | null };
  if (!response.ok || !data.raw) throw new Error("METAR unavailable");
  return data.raw;
}
function scopeConnected() {
  const top = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(top?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    .some((button) => button.textContent?.trim().toUpperCase() === "DISCONNECT");
}
async function publishedAtisAirports() {
  const { data } = await supabase.from("atis_messages").select("airport_icao");
  return new Set((data ?? []).map((row) => String(row.airport_icao || "").toUpperCase()).filter(Boolean));
}
async function canPublishAirport(airport: string, controllerName: string) {
  const latest = await latestAtis(airport);
  const owner = latest?.created_by?.trim() ?? "";
  if (owner && owner !== controllerName) return false;
  const published = await publishedAtisAirports();
  return published.has(airport) || published.size < MAX_PUBLISHED_ATIS;
}

export default function ScopeAtisDialogV2({ controllerName }: { controllerName: string }) {
  const airports = useMemo(() => Object.keys(RUNWAYS).sort(), []);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [airport, setAirport] = useState("MDPC");
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [infoLetter, setInfoLetter] = useState("A");
  const [metar, setMetar] = useState("");
  const [transLvl, setTransLvl] = useState("---");
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<PublishedAtis>({});

  const config = configs[airport] ?? emptyConfig();
  const runwayOptions = [...(RUNWAYS[airport] ?? []), ...(COMBINED_RUNWAYS[airport] ?? [])];
  const publishedCount = Object.keys(published).length;
  const airportPublished = published[airport] ?? null;
  const airportLockedByOther = Boolean(airportPublished?.createdBy && airportPublished.createdBy !== controllerName);
  const publicationLimitReached = publishedCount >= MAX_PUBLISHED_ATIS && !airportPublished;

  const refreshPublished = useCallback(async () => {
    const { data } = await supabase
      .from("atis_messages")
      .select("airport_icao,info_letter,created_at,created_by")
      .order("created_at", { ascending: false });
    const map: PublishedAtis = {};
    for (const row of data ?? []) {
      const icao = String(row.airport_icao ?? "").toUpperCase();
      if (!icao || map[icao]) continue;
      map[icao] = {
        letter: String(row.info_letter ?? "A"),
        createdBy: String(row.created_by ?? ""),
      };
    }
    setPublished(map);
  }, []);

  const loadAirport = useCallback(async (icao: string) => {
    const latest = await latestAtis(icao);
    try {
      const raw = await fetchMetar(icao);
      const elapsed = latest ? Date.now() - new Date(latest.created_at).getTime() : Infinity;
      setInfoLetter(latest && elapsed < HOUR_MS ? latest.info_letter : nextLetter(latest?.info_letter));
      setMetar(raw);
      setTransLvl(transitionLevel(icao, raw));
    } catch {
      setInfoLetter(latest ? latest.info_letter : "A");
      setMetar("");
      setTransLvl("---");
    }
  }, []);

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>("main.fixed > section"));
    setConfigs(readConfigs());
    setConnected(scopeConnected());
    void refreshPublished();

    const guardTopAtis = (event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-pf24-top-atis='true']")
        : null;
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setConnected(scopeConnected());
      setOpen((value) => !value);
    };
    const syncConnection = () => window.setTimeout(() => setConnected(scopeConnected()), 0);
    window.addEventListener("click", guardTopAtis, true);
    document.addEventListener("click", syncConnection);

    const channel = supabase
      .channel("scope-atis-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "atis_messages" }, () => void refreshPublished())
      .subscribe();

    return () => {
      window.removeEventListener("click", guardTopAtis, true);
      document.removeEventListener("click", syncConnection);
      void supabase.removeChannel(channel);
    };
  }, [refreshPublished]);

  useEffect(() => {
    if (open) void loadAirport(airport);
  }, [airport, loadAirport, open]);

  const patch = (value: Partial<AirportConfig>) => {
    setConfigs((current) => {
      const next = { ...current, [airport]: { ...(current[airport] ?? emptyConfig()), ...value } };
      writeConfigs(next);
      return next;
    });
  };

  const publishAutomatic = useCallback(async (icao: string, cfg: AirportConfig) => {
    if (!scopeConnected() || !cfg.active || !cfg.dep || !cfg.arr) return false;
    const latest = await latestAtis(icao);
    const owner = latest?.created_by?.trim() ?? "";
    if (owner && owner !== controllerName) return false;
    if (latest && Date.now() - new Date(latest.created_at).getTime() < HOUR_MS) return false;
    if (!(await canPublishAirport(icao, controllerName))) return false;

    const raw = await fetchMetar(icao);
    const letter = latest ? nextLetter(latest.info_letter) : "A";
    const tl = transitionLevel(icao, raw);

    await supabase.from("atis_messages").delete().eq("airport_icao", icao).eq("created_by", controllerName);
    const { error } = await supabase.from("atis_messages").insert({
      airport_icao: icao,
      info_letter: letter,
      metar: raw,
      approach_primary: cfg.approach || "NO APPR",
      approach_optional: null,
      runway: `DEP ${cfg.dep} / ARR ${cfg.arr}`,
      extra_info: `TA ${TA_BY_AIRPORT[icao]}FT TL FL${tl}`,
      remarks: cfg.remarks || null,
      full_text: buildText(icao, letter, raw, cfg, tl),
      created_by: controllerName,
    });
    if (error) throw error;
    await refreshPublished();
    return true;
  }, [controllerName, refreshPublished]);

  useEffect(() => {
    if (!connected) return;
    const check = async () => {
      for (const [icao, cfg] of Object.entries(readConfigs())) {
        if (!RUNWAYS[icao]) continue;
        try {
          if (await publishAutomatic(icao, cfg) && icao === airport) await loadAirport(icao);
        } catch (error) {
          console.error("PF24 automatic ATIS update failed", icao, error);
        }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(timer);
  }, [airport, connected, loadAirport, publishAutomatic]);

  const setActive = async (active: boolean) => {
    if (airportLockedByOther && active) return;
    patch({ active });
    if (!active) {
      await supabase.from("atis_messages").delete().eq("airport_icao", airport).eq("created_by", controllerName);
      await refreshPublished();
    }
  };

  const send = async () => {
    if (!connected || !config.active || !config.dep || !config.arr) return;
    if (!(await canPublishAirport(airport, controllerName))) {
      await refreshPublished();
      return;
    }

    const latest = await latestAtis(airport);
    const owner = latest?.created_by?.trim() ?? "";
    if (owner && owner !== controllerName) {
      await refreshPublished();
      return;
    }

    try {
      setBusy(true);
      const raw = await fetchMetar(airport);
      const tl = transitionLevel(airport, raw);
      const letter = infoLetter;

      await supabase.from("atis_messages").delete().eq("airport_icao", airport).eq("created_by", controllerName);
      const { error } = await supabase.from("atis_messages").insert({
        airport_icao: airport,
        info_letter: letter,
        metar: raw,
        approach_primary: config.approach || "NO APPR",
        approach_optional: null,
        runway: `DEP ${config.dep} / ARR ${config.arr}`,
        extra_info: `TA ${TA_BY_AIRPORT[airport]}FT TL FL${tl}`,
        remarks: config.remarks || null,
        full_text: buildText(airport, letter, raw, config, tl),
        created_by: controllerName,
      });
      if (error) throw error;
      setMetar(raw);
      setTransLvl(tl);
      await refreshPublished();
      setOpen(false);
    } catch (error) {
      console.error("PF24 ATIS publish failed", error);
    } finally {
      setBusy(false);
    }
  };

  if (!host || !open) return null;
  const preview = metar
    ? buildText(airport, infoLetter, metar, config, transLvl)
    : `${airport} ATIS INFO ${infoLetter}... METAR NO DISPONIBLE`;

  return createPortal(
    <div className="absolute left-1/2 top-1/2 z-[60] w-[620px] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-[#777] bg-[#cecece] font-mono text-[12px] text-[#111] shadow-[0_0_0_1px_#111]" data-pf24-atis-dialog="true">
      <div className="h-[25px] px-[5px] pt-[3px] text-[14px]">ATIS dialog</div>
      <div className="grid grid-cols-[305px_1fr] gap-[10px] px-[10px] pb-[12px]">
        <div>
          <div className="mb-[16px] flex items-center justify-between pt-[22px]">
            <label className="flex items-center gap-[8px] text-[16px]">
              <span>ATIS Active</span>
              <button
                type="button"
                disabled={airportLockedByOther}
                onClick={() => void setActive(!config.active)}
                className="relative h-[28px] w-[28px] overflow-hidden bg-[#efefef] disabled:opacity-40"
              >
                {config.active && <>
                  <span className="absolute left-[3px] top-[13px] h-[2px] w-[22px] rotate-45 bg-[#111]"/>
                  <span className="absolute left-[3px] top-[13px] h-[2px] w-[22px] -rotate-45 bg-[#111]"/>
                </>}
              </button>
            </label>
            <div className="flex items-center gap-[7px] text-[16px]">
              <span>ATIS Letter</span>
              <button
                type="button"
                disabled={airportLockedByOther}
                onClick={() => setInfoLetter((value) => previousLetter(value))}
                onContextMenu={(event) => { event.preventDefault(); if (!airportLockedByOther) setInfoLetter((value) => nextLetter(value)); }}
                title="Click izquierdo: letra anterior · Click derecho: letra siguiente"
                className="flex h-[28px] w-[28px] items-center justify-center bg-[#efefef] text-[24px] disabled:opacity-40"
              >{infoLetter}</button>
            </div>
          </div>

          <div className="space-y-[9px]">
            <Field label="Airport">
              <select value={airport} onChange={(e) => setAirport(e.target.value)} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none">
                {airports.map((icao) => <option key={icao}>{icao}</option>)}
              </select>
            </Field>
            <Field label="Runway DEP">
              <select disabled={airportLockedByOther} value={config.dep} onChange={(e) => patch({ dep: e.target.value })} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none disabled:opacity-60">
                <option value="" />{runwayOptions.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Runway ARR">
              <select disabled={airportLockedByOther} value={config.arr} onChange={(e) => patch({ arr: e.target.value })} className="h-[23px] w-full bg-[#ececec] px-[4px] outline-none disabled:opacity-60">
                <option value="" />{runwayOptions.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Appr Procedures">
              <input disabled={airportLockedByOther} value={config.approach} maxLength={15} onChange={(e) => patch({ approach: e.target.value.toUpperCase().slice(0, 15) })} className="h-[23px] w-full bg-[#ececec] px-[4px] uppercase outline-none disabled:opacity-60" />
            </Field>
          </div>

          <div className="mt-[22px] grid grid-cols-2 gap-[24px] text-center">
            <div><div className="mb-[9px] text-[16px]">Trans Atl</div><div className="mx-auto flex h-[25px] w-[98px] items-center justify-center bg-[#ececec] text-[16px]">{TA_BY_AIRPORT[airport]}ft</div></div>
            <div><div className="mb-[9px] text-[16px]">Trans Lvl</div><div className="mx-auto flex h-[25px] w-[98px] items-center justify-center bg-[#ececec] text-[16px]">FL{transLvl}</div></div>
          </div>

          <div className={`mt-[45px] flex ${airportLockedByOther ? "justify-center" : "justify-around"}`}>
            <button type="button" onClick={() => setOpen(false)} className="bg-[#ececec] px-[14px] py-[7px] text-[16px]">Cancel</button>
            {!airportLockedByOther && <button
              type="button"
              disabled={busy || !connected || !config.active || !config.dep || !config.arr || publicationLimitReached}
              onClick={() => void send()}
              className="bg-[#ececec] px-[18px] py-[7px] text-[16px] disabled:opacity-40"
            >{busy ? "..." : "Send"}</button>}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden">
          <div className="h-[215px] w-full overflow-y-auto overflow-x-hidden bg-[#f0f0f0] p-[8px] text-[11px] leading-[1.35] [overflow-wrap:anywhere]">{preview}</div>
          <div className="mt-[6px] text-[16px]">Remarks</div>
          <textarea
            disabled={airportLockedByOther}
            value={config.remarks}
            maxLength={40}
            onChange={(e) => patch({ remarks: e.target.value.toUpperCase().slice(0, 40) })}
            className="mt-[3px] h-[100px] w-full resize-none overflow-x-hidden bg-[#ececec] p-[5px] uppercase outline-none disabled:opacity-60 [overflow-wrap:anywhere]"
          />
        </div>
      </div>
    </div>,
    host,
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid grid-cols-[145px_1fr] items-center gap-[7px] text-[16px]"><span className="text-right">{label}</span>{children}</label>;
}
