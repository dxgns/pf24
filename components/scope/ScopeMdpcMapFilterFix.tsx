"use client";

import { useEffect } from "react";

const MDPC_LABEL_GROUPS = [
  "[data-map-layer='mdpc-svg-labels-upright']",
  "[data-map-layer='mdpc-svg-labels-upright-low']",
].join(", ");
const LEMH_LABEL_GROUP = "[data-map-layer='lemh-upright-labels']";
const FILTER_STORAGE_KEY = "pf24_scope_map_display_filters_v1";
const MDPC_RUNWAY_LABELS = new Set(["08", "09", "26", "27"]);
const LEMH_RUNWAY_LABELS = new Set(["19", "01"]);

type StoredFilters = {
  taxiLetters?: boolean;
  gateNumbers?: boolean;
};

type LabelKind = "taxi" | "gate" | "runway";

function mdpcLabelKind(text: string): LabelKind {
  const value = text.trim().toUpperCase();
  if (/^[A-Z]$/.test(value)) return "taxi";
  if (MDPC_RUNWAY_LABELS.has(value)) return "runway";
  return "gate";
}

function lemhLabelKind(text: SVGTextElement): LabelKind {
  const explicit = text.dataset.pf24MapLabelKind;
  if (explicit === "taxi" || explicit === "gate" || explicit === "runway") return explicit;
  const value = (text.textContent ?? "").trim().toUpperCase();
  return LEMH_RUNWAY_LABELS.has(value) ? "runway" : "taxi";
}

function readStoredFilters(): StoredFilters {
  try {
    const value = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) ?? "{}") as StoredFilters;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function filterVisibility(radar: HTMLElement | null) {
  const stored = readStoredFilters();
  return {
    taxiVisible: radar?.dataset.pf24MapFilterTaxiLetters
      ? radar.dataset.pf24MapFilterTaxiLetters !== "off"
      : stored.taxiLetters !== false,
    gatesVisible: radar?.dataset.pf24MapFilterGateNumbers
      ? radar.dataset.pf24MapFilterGateNumbers !== "off"
      : stored.gateNumbers !== false,
  };
}

function applyVisibility(text: SVGTextElement, kind: LabelKind, taxiVisible: boolean, gatesVisible: boolean) {
  text.dataset.pf24MapLabelKind = kind;

  const visible = kind === "taxi"
    ? taxiVisible
    : kind === "gate"
      ? gatesVisible
      : true;

  if (visible) {
    text.style.removeProperty("display");
    text.style.removeProperty("visibility");
  } else {
    text.style.setProperty("display", "none", "important");
    text.style.setProperty("visibility", "hidden", "important");
  }
}

export default function ScopeMdpcMapFilterFix() {
  useEffect(() => {
    let frame = 0;
    let radar: HTMLElement | null = null;
    let radarObserver: MutationObserver | null = null;
    let locateObserver: MutationObserver | null = null;

    const sync = () => {
      frame = 0;
      if (!radar) return;
      const { taxiVisible, gatesVisible } = filterVisibility(radar);

      // MDPC is rendered in two places: the original vector-map copy and the
      // low airport layer used for the final stacking order. The latter is the
      // visible one, so both groups must always receive the same filter state.
      for (const group of Array.from(radar.querySelectorAll<SVGGElement>(MDPC_LABEL_GROUPS))) {
        for (const text of Array.from(group.querySelectorAll<SVGTextElement>("text"))) {
          applyVisibility(text, mdpcLabelKind(text.textContent ?? ""), taxiVisible, gatesVisible);
        }
      }

      // LEMH labels are rendered outside the SVG to stay upright. Apply the
      // same filter state directly so Taxi Ways Letters reliably hides them.
      for (const group of Array.from(radar.querySelectorAll<SVGGElement>(LEMH_LABEL_GROUP))) {
        for (const text of Array.from(group.querySelectorAll<SVGTextElement>("text"))) {
          applyVisibility(text, lemhLabelKind(text), taxiVisible, gatesVisible);
        }
      }
    };

    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    const bindRadar = () => {
      const next = document.querySelector<HTMLElement>("main.fixed > section");
      if (!next || next === radar) return Boolean(next);

      radarObserver?.disconnect();
      radar = next;
      radarObserver = new MutationObserver(queueSync);
      radarObserver.observe(radar, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "data-pf24-map-filter-taxi-letters",
          "data-pf24-map-filter-gate-numbers",
        ],
      });
      queueSync();
      return true;
    };

    if (!bindRadar()) {
      // Only observe page structure until the radar exists. Unlike the previous
      // implementation this does not poll the whole DOM every 150 ms forever.
      locateObserver = new MutationObserver(() => {
        if (!bindRadar()) return;
        locateObserver?.disconnect();
        locateObserver = null;
      });
      locateObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("storage", queueSync);

    return () => {
      locateObserver?.disconnect();
      radarObserver?.disconnect();
      window.removeEventListener("storage", queueSync);
      if (frame) window.cancelAnimationFrame(frame);

      const selectors = `${MDPC_LABEL_GROUPS} text, ${LEMH_LABEL_GROUP} text`;
      for (const text of Array.from(document.querySelectorAll<SVGTextElement>(selectors))) {
        text.style.removeProperty("display");
        text.style.removeProperty("visibility");
      }
    };
  }, []);

  return null;
}
