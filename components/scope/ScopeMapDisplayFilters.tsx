"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type FilterKey = "ctrs" | "tmas" | "atzs" | "waypoints" | "terrain" | "taxiLetters" | "gateNumbers";
type FilterState = Record<FilterKey, boolean>;

const STORAGE_KEY = "pf24_scope_map_display_filters_v1";
const FILTER_BUTTON_WIDTH = 22;

const DEFAULT_FILTERS: FilterState = {
  ctrs: true,
  tmas: true,
  atzs: true,
  waypoints: true,
  terrain: true,
  taxiLetters: true,
  gateNumbers: true,
};

const FILTER_ITEMS: Array<{ key: FilterKey; label: string }> = [
  { key: "ctrs", label: "CTRs" },
  { key: "tmas", label: "TMAs" },
  { key: "atzs", label: "ATZs" },
  { key: "waypoints", label: "Waypoints" },
  { key: "terrain", label: "Terrain" },
  { key: "taxiLetters", label: "Taxi Ways Letters" },
  { key: "gateNumbers", label: "Gate Numbers" },
];

function readFilters(): FilterState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<FilterState>;
    return {
      ctrs: typeof parsed.ctrs === "boolean" ? parsed.ctrs : true,
      tmas: typeof parsed.tmas === "boolean" ? parsed.tmas : true,
      atzs: typeof parsed.atzs === "boolean" ? parsed.atzs : true,
      waypoints: typeof parsed.waypoints === "boolean" ? parsed.waypoints : true,
      terrain: typeof parsed.terrain === "boolean" ? parsed.terrain : true,
      taxiLetters: typeof parsed.taxiLetters === "boolean" ? parsed.taxiLetters : true,
      gateNumbers: typeof parsed.gateNumbers === "boolean" ? parsed.gateNumbers : true,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function findToolbarRow() {
  return document.querySelector<HTMLElement>("main.fixed header > div:first-child");
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

function directToolbarButtons(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLButtonElement>(":scope > button"));
}

function classifyAirportLabels(root: ParentNode) {
  const groups = root.querySelectorAll<SVGGElement>("[data-map-layer$='svg-labels-upright']");
  for (const group of Array.from(groups)) {
    const texts = Array.from(group.querySelectorAll<SVGTextElement>("text"));
    if (texts.length === 0) continue;

    const taxiSizes = texts
      .filter((text) => /^[A-Z]$/i.test(text.textContent?.trim() ?? ""))
      .map((text) => Number.parseFloat(text.getAttribute("font-size") ?? "0"))
      .filter((value) => Number.isFinite(value) && value > 0);
    const taxiReference = taxiSizes.length > 0 ? Math.max(...taxiSizes) : 0;

    for (const text of texts) {
      const label = text.textContent?.trim() ?? "";
      if (!label) continue;
      if (/^[A-Z]$/i.test(label)) {
        text.dataset.pf24MapLabelKind = "taxi";
        continue;
      }

      const fontSize = Number.parseFloat(text.getAttribute("font-size") ?? "0");
      if (taxiReference > 0 && Number.isFinite(fontSize) && fontSize >= taxiReference * 0.12) {
        text.dataset.pf24MapLabelKind = "gate";
      } else {
        text.dataset.pf24MapLabelKind = "runway";
      }
    }
  }
}

function FilterGlyph() {
  return (
    <svg width="22" height="21" viewBox="0 0 46 44" aria-hidden="true">
      <text
        x="35"
        y="10"
        fill="#e2e2e2"
        fontFamily="monospace"
        fontSize="9"
        textAnchor="middle"
      >FL</text>
      <path
        d="M4 18 L11 12 L27 12 L34 18 L34 22 L24 30 L24 42 L16 42 L16 30 L4 22 Z M8 19 L13 15 L25 15 L30 19 L30 20 L23 25 L16 25 L8 20 Z"
        fill="#e2e2e2"
        fillRule="evenodd"
      />
    </svg>
  );
}

export default function ScopeMapDisplayFilters() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; scale: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setFilters(readFilters());
  }, []);

  useEffect(() => {
    let attempts = 0;
    let host: HTMLDivElement | null = null;

    const install = () => {
      const row = findToolbarRow();
      if (!row) return false;

      const existing = row.querySelector<HTMLElement>(":scope > [data-pf24-map-filter-host='true']");
      if (existing) {
        host = existing as HTMLDivElement;
        existing.style.width = `${FILTER_BUTTON_WIDTH}px`;
        existing.style.flexBasis = `${FILTER_BUTTON_WIDTH}px`;
        setToolbarHost(existing);
        return true;
      }

      const buttons = directToolbarButtons(row);
      if (buttons.length < 2) return false;
      const firstExistingTool = buttons.at(-2);
      if (!firstExistingTool) return false;

      host = document.createElement("div");
      host.dataset.pf24MapFilterHost = "true";
      host.className = "scopeTopCell relative h-[21px] shrink-0";
      host.style.width = `${FILTER_BUTTON_WIDTH}px`;
      host.style.flexBasis = `${FILTER_BUTTON_WIDTH}px`;
      row.insertBefore(host, firstExistingTool);
      setToolbarHost(host);
      return true;
    };

    if (!install()) {
      const timer = window.setInterval(() => {
        attempts += 1;
        if (install() || attempts >= 50) window.clearInterval(timer);
      }, 100);
      return () => {
        window.clearInterval(timer);
        if (host?.isConnected) host.remove();
      };
    }

    return () => {
      if (host?.isConnected) host.remove();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const update = () => {
      const button = buttonRef.current;
      const main = document.querySelector<HTMLElement>("main.fixed");
      if (!button || !main) return;
      const buttonRect = button.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const logicalWidth = button.offsetWidth || FILTER_BUTTON_WIDTH;
      const scale = logicalWidth > 0 ? buttonRect.width / logicalWidth : 1;
      setMenuPosition({
        left: (buttonRect.left - mainRect.left) / Math.max(scale, 0.001),
        top: (buttonRect.bottom - mainRect.top) / Math.max(scale, 0.001),
        scale,
      });
    };

    update();
    window.addEventListener("resize", update);
    const timer = window.setInterval(update, 300);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24MapDisplayFilters = "true";
    style.textContent = `
      [data-pf24-map-filter-ctrs='off'] [data-map-layer='airspace'] > [stroke='#087153'] {
        display: none !important;
      }
      [data-pf24-map-filter-tmas='off'] [data-map-layer='airspace'] > [stroke='#176997']:not([data-map-layer]) {
        display: none !important;
      }
      [data-pf24-map-filter-atzs='off'] [data-map-layer='mdpc-twr'],
      [data-pf24-map-filter-atzs='off'] [data-map-layer='mdst-twr'],
      [data-pf24-map-filter-atzs='off'] [data-map-layer='mdab-twr'],
      [data-pf24-map-filter-atzs='off'] [data-map-layer='mdcr-twr'] {
        display: none !important;
      }
      [data-pf24-map-filter-waypoints='off'] [data-map-layer='fixes'] {
        display: none !important;
      }
      [data-pf24-map-filter-terrain='off'] [data-pf24-island-layer='true'] {
        display: none !important;
      }
      [data-pf24-map-filter-taxi-letters='off'] [data-pf24-map-label-kind='taxi'] {
        display: none !important;
      }
      [data-pf24-map-filter-gate-numbers='off'] [data-pf24-map-label-kind='gate'] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const radar = findRadar();
    if (!radar) return;

    radar.dataset.pf24MapFilterCtrs = filters.ctrs ? "on" : "off";
    radar.dataset.pf24MapFilterTmas = filters.tmas ? "on" : "off";
    radar.dataset.pf24MapFilterAtzs = filters.atzs ? "on" : "off";
    radar.dataset.pf24MapFilterWaypoints = filters.waypoints ? "on" : "off";
    radar.dataset.pf24MapFilterTerrain = filters.terrain ? "on" : "off";
    radar.dataset.pf24MapFilterTaxiLetters = filters.taxiLetters ? "on" : "off";
    radar.dataset.pf24MapFilterGateNumbers = filters.gateNumbers ? "on" : "off";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const radar = findRadar();
    if (!radar) return;

    let frame = 0;
    const classify = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => classifyAirportLabels(radar));
    };

    classifyAirportLabels(radar);
    const observer = new MutationObserver(classify);
    observer.observe(radar, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && (buttonRef.current?.contains(target) || menuRef.current?.contains(target))) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (!mounted || !toolbarHost) return null;

  const main = document.querySelector<HTMLElement>("main.fixed");

  return (
    <>
      {createPortal(
        <button
          ref={buttonRef}
          type="button"
          data-pf24-map-filter-button="true"
          aria-label="Map display filters"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`flex h-full w-full items-center justify-center bg-[#064a40] font-mono text-[#e2e2e2] hover:bg-[#0a554a] ${open ? "scopeToolOn" : ""}`}
        >
          <FilterGlyph />
        </button>,
        toolbarHost,
      )}

      {open && menuPosition && main && createPortal(
        <div
          ref={menuRef}
          data-pf24-map-filter-menu="true"
          className="absolute w-[172px] bg-[#064a40] font-mono text-[#e2e2e2] shadow-[0_0_0_1px_#102f2a]"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            zIndex: 1201,
          }}
        >
          <div className="flex h-[13px] items-center justify-center border-b border-[#102f2a] text-[7px] tracking-[.5px]">MAP FILTER</div>
          {FILTER_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, [item.key]: !current[item.key] }))}
              className="flex h-[24px] w-full items-center border-b border-[#102f2a] px-[7px] text-left text-[10px] hover:bg-[#0a554a]"
              style={{ background: filters[item.key] ? "#0a554a" : "#064a40" }}
            >
              <span className="mr-[6px] inline-flex w-[10px] justify-center text-[9px]">{filters[item.key] ? "X" : ""}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>,
        main,
      )}
    </>
  );
}
