"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type FilterKey = "ctrs" | "tmas" | "atzs" | "waypoints" | "terrain" | "taxiLetters" | "gateNumbers";
type FilterState = Record<FilterKey, boolean>;
type Anchor = { left: number; top: number; scale: number };

const STORAGE_KEY = "pf24_scope_map_display_filters_v1";
const BUTTON_WIDTH = 48;
const BUTTON_HEIGHT = 21;

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
    <svg width="43" height="19" viewBox="0 0 116 52" aria-hidden="true">
      <path
        d="M7 18 L24 8 L49 8 L66 18 L66 28 L47 47 L47 51 L26 51 L26 38 L8 21 Z M12 19 L27 12 L47 12 L61 20 L61 25 L47 31 L26 31 L12 25 Z"
        fill="#e2e2e2"
        fillRule="evenodd"
      />
      <text x="72" y="22" fill="#e2e2e2" fontFamily="monospace" fontSize="20" fontWeight="600">FL</text>
    </svg>
  );
}

export default function ScopeMapDisplayFilters() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const shiftedButtonsRef = useRef<HTMLButtonElement[]>([]);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setFilters(readFilters());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const position = () => {
      if (cancelled) return;
      const row = findToolbarRow();
      if (!row) return;
      const buttons = directToolbarButtons(row);
      if (buttons.length < 2) return;

      const plannedRoute = buttons.at(-2);
      const distance = buttons.at(-1);
      if (!plannedRoute || !distance) return;

      for (const oldButton of shiftedButtonsRef.current) {
        if (oldButton !== plannedRoute && oldButton !== distance && oldButton.dataset.pf24MapFilterShift === "true") {
          oldButton.style.removeProperty("transform");
          oldButton.style.removeProperty("z-index");
          delete oldButton.dataset.pf24MapFilterShift;
        }
      }

      const plannedRect = plannedRoute.getBoundingClientRect();
      const logicalWidth = plannedRoute.offsetWidth || BUTTON_WIDTH;
      const scale = logicalWidth > 0 ? plannedRect.width / logicalWidth : 1;
      const alreadyShifted = plannedRoute.dataset.pf24MapFilterShift === "true";
      const baseLeft = plannedRect.left - (alreadyShifted ? BUTTON_WIDTH * scale : 0);
      const baseTop = plannedRect.top;

      plannedRoute.style.transform = `translateX(${BUTTON_WIDTH}px)`;
      distance.style.transform = `translateX(${BUTTON_WIDTH}px)`;
      plannedRoute.style.zIndex = "1";
      distance.style.zIndex = "1";
      plannedRoute.dataset.pf24MapFilterShift = "true";
      distance.dataset.pf24MapFilterShift = "true";
      shiftedButtonsRef.current = [plannedRoute, distance];

      setAnchor((current) => {
        if (
          current &&
          Math.abs(current.left - baseLeft) < 0.25 &&
          Math.abs(current.top - baseTop) < 0.25 &&
          Math.abs(current.scale - scale) < 0.001
        ) return current;
        return { left: baseLeft, top: baseTop, scale };
      });
    };

    position();
    const interval = window.setInterval(position, 400);
    window.addEventListener("resize", position);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("resize", position);
      for (const button of shiftedButtonsRef.current) {
        if (button.dataset.pf24MapFilterShift === "true") {
          button.style.removeProperty("transform");
          button.style.removeProperty("z-index");
          delete button.dataset.pf24MapFilterShift;
        }
      }
      shiftedButtonsRef.current = [];
    };
  }, []);

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

  if (!mounted || !anchor) return null;

  return createPortal(
    <>
      <button
        ref={buttonRef}
        type="button"
        data-pf24-map-filter-button="true"
        aria-label="Map display filters"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="fixed flex items-center justify-center border-r border-[#173d38] bg-[#064a40] font-mono text-[#e2e2e2] hover:bg-[#0a554a]"
        style={{
          left: anchor.left,
          top: anchor.top,
          width: BUTTON_WIDTH,
          height: BUTTON_HEIGHT,
          transform: `scale(${anchor.scale})`,
          transformOrigin: "top left",
          zIndex: 1200,
          background: open ? "#0a5b50" : "#064a40",
        }}
      >
        <FilterGlyph />
      </button>

      {open && (
        <div
          ref={menuRef}
          data-pf24-map-filter-menu="true"
          className="fixed w-[172px] bg-[#064a40] font-mono text-[#e2e2e2] shadow-[0_0_0_1px_#102f2a]"
          style={{
            left: anchor.left,
            top: anchor.top + BUTTON_HEIGHT * anchor.scale,
            transform: `scale(${anchor.scale})`,
            transformOrigin: "top left",
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
        </div>
      )}
    </>,
    document.body,
  );
}
