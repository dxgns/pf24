"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";

type Personalization = {
  radarBackground: string;
  topBar: string;
  secondaryBar: string;
  windowHeader: string;
  windowText: string;
  traffic: string;
  selectedTraffic: string;
  vector: string;
  trail: string;
  metar: string;
};

const STORAGE_KEY = "pf24_scope_personalization_v1";

const DEFAULTS: Personalization = {
  radarBackground: "#151515",
  topBar: "#064a40",
  secondaryBar: "#555c61",
  windowHeader: "#555c61",
  windowText: "#e9e9e9",
  traffic: "#00e000",
  selectedTraffic: "#00ff00",
  vector: "#00e000",
  trail: "#00d000",
  metar: "#00efff",
};

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function loadSettings(): Personalization {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Personalization>;
    return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, normalizeColor(parsed[key as keyof Personalization], fallback)])) as Personalization;
  } catch {
    return DEFAULTS;
  }
}

function applySettings(settings: Personalization) {
  const root = document.documentElement;
  root.style.setProperty("--pf24-radar-bg", settings.radarBackground);
  root.style.setProperty("--pf24-topbar", settings.topBar);
  root.style.setProperty("--pf24-secondarybar", settings.secondaryBar);
  root.style.setProperty("--pf24-window-header", settings.windowHeader);
  root.style.setProperty("--pf24-window-text", settings.windowText);
  root.style.setProperty("--pf24-traffic", settings.traffic);
  root.style.setProperty("--pf24-selected-traffic", settings.selectedTraffic);
  root.style.setProperty("--pf24-vector", settings.vector);
  root.style.setProperty("--pf24-trail", settings.trail);
  root.style.setProperty("--pf24-metar", settings.metar);
}

function findPersonalizationHost(): HTMLElement | null {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.textContent?.trim() === "Personalization");
  const dialog = button?.closest<HTMLElement>("div.absolute");
  if (!dialog || dialog.children.length < 2) return null;
  return dialog.children[1] as HTMLElement;
}

export default function ScopePersonalization() {
  const [saved, setSaved] = useState<Personalization>(DEFAULTS);
  const [draft, setDraft] = useState<Personalization>(DEFAULTS);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const initial = loadSettings();
    setSaved(initial);
    setDraft(initial);
    applySettings(initial);
  }, []);

  const syncDialog = useCallback(() => setHost(findPersonalizationHost()), []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      const label = target?.textContent?.trim();
      if (label === "Scope configuration") {
        window.setTimeout(() => { syncDialog(); setActive(false); }, 0);
        return;
      }
      if (label === "Personalization") {
        window.setTimeout(() => { syncDialog(); setActive(true); }, 0);
        return;
      }
      if (label === "General") {
        setActive(false);
        return;
      }
      if (label === "Cancelar" || label === "Guardar") setActive(false);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [syncDialog]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24Personalization = "true";
    style.textContent = `
      main.fixed { background: var(--pf24-radar-bg, #151515) !important; }
      main.fixed > section { background: var(--pf24-radar-bg, #151515) !important; }
      main.fixed header > div:first-child { background: var(--pf24-topbar, #064a40) !important; }
      main.fixed header > div:last-child { background: var(--pf24-secondarybar, #555c61) !important; }
      main.fixed > section > div.absolute.z-30 > div:first-child { background: var(--pf24-window-header, #555c61) !important; color: var(--pf24-window-text, #e9e9e9) !important; }
      [data-pf24-metar-overlay='true'] { color: var(--pf24-metar, #00efff) !important; }
      [data-pf24-traffic-sim='true'] { --traffic-color: var(--pf24-traffic, #00e000); }
      [data-pf24-traffic-sim='true'] div[class*='text-[#00e000]'], [data-pf24-traffic-sim='true'] span[class*='text-[#00e000]'] { color: var(--pf24-traffic, #00e000) !important; }
      [data-pf24-traffic-sim='true'] svg line { stroke: var(--pf24-vector, #00e000) !important; }
      [data-pf24-traffic-sim='true'] svg circle { fill: var(--pf24-trail, #00d000) !important; }
      [data-pf24-traffic-sim='true'] [data-pf24-traffic-target='true'] span { border-color: var(--pf24-traffic, #00e000) !important; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const patch = (key: keyof Personalization, value: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    setDraft((current) => {
      const next = { ...current, [key]: value.toLowerCase() };
      applySettings(next);
      return next;
    });
  };

  const save = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setSaved(draft); };
  const cancel = () => { setDraft(saved); applySettings(saved); };
  const reset = () => { setDraft(DEFAULTS); applySettings(DEFAULTS); };

  useEffect(() => {
    const onConfigAction = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      const label = button?.textContent?.trim();
      if (label === "Guardar" && active) save();
      if (label === "Cancelar" && active) cancel();
    };
    document.addEventListener("click", onConfigAction, true);
    return () => document.removeEventListener("click", onConfigAction, true);
  }, [active, draft, saved]);

  const goGeneral = () => {
    const general = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "General");
    general?.click();
    setActive(false);
  };

  if (!host || !active) return null;

  const fields: Array<[keyof Personalization, string]> = [
    ["radarBackground", "Radar background"], ["topBar", "Top bar"], ["secondaryBar", "Secondary bar"], ["windowHeader", "Window headers"],
    ["windowText", "Window header text"], ["traffic", "Traffic"], ["selectedTraffic", "Selected traffic"], ["vector", "HDG vector"], ["trail", "History trail"], ["metar", "METAR"],
  ];

  return createPortal(
    <div className="absolute inset-0 bg-[#cecece] px-[18px] pt-[12px] text-[12px] text-[#111]" data-pf24-personalization-panel="true">
      <div className="mb-[12px] flex gap-[4px]">
        <button type="button" onClick={goGeneral} className="border border-[#999] bg-[#e5e5e5] px-[10px] py-[3px]">General</button>
        <button type="button" className="border border-[#999] bg-[#d7d7d7] px-[10px] py-[3px]">Personalization</button>
      </div>
      <div className="grid grid-cols-2 gap-x-[36px] gap-y-[7px]">
        {fields.map(([key, label]) => (
          <label key={key} className="grid grid-cols-[1fr_92px] items-center gap-[8px]">
            <span>{label}</span>
            <span className="flex h-[23px] items-center border border-[#aaa] bg-[#ededed] px-[3px]">
              <input type="color" value={draft[key]} onChange={(event) => patch(key, event.target.value)} className="h-[17px] w-[24px] cursor-pointer border-0 bg-transparent p-0" />
              <input value={draft[key].toUpperCase()} maxLength={7} onChange={(event) => { const value = event.target.value; if (/^#[0-9a-f]{6}$/i.test(value)) patch(key, value); }} className="ml-[4px] w-[58px] bg-transparent font-mono text-[10px] outline-none" />
            </span>
          </label>
        ))}
      </div>
      <button type="button" onClick={reset} className="mt-[15px] border border-[#999] bg-[#e5e5e5] px-[10px] py-[3px] text-[11px]">Restore defaults</button>
      <p className="mt-[10px] text-[10px] text-[#555]">Personal settings are stored only in this browser.</p>
    </div>, host,
  );
}
