"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  selectApproachModeForPlan,
  selectProcedureMatches,
  type ApproachMode,
} from "@/lib/pfpilot/approaches";

type PilotPlan = {
  id?: string;
  arrival_icao?: string;
  route?: string;
  [key: string]: unknown;
};

function parseAltitude(value: string | null | undefined) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function findMetricValue(root: HTMLElement, label: string) {
  const target = normalizedText(label);
  for (const item of Array.from(root.querySelectorAll("p"))) {
    if (normalizedText(item.textContent) !== target) continue;
    const sibling = item.nextElementSibling as HTMLElement | null;
    if (sibling) return sibling.textContent ?? "";
  }
  return "";
}

function activeProcedureText(root: HTMLElement) {
  for (const item of Array.from(root.querySelectorAll("p"))) {
    if (normalizedText(item.textContent) !== "ACTIVE PROCEDURE") continue;
    const card = item.closest(".rounded-2xl") as HTMLElement | null;
    return normalizedText(card?.textContent);
  }
  return "";
}

function isGuidanceEnabled(root: HTMLElement) {
  return Array.from(root.querySelectorAll("button")).some(
    (button) => normalizedText(button.textContent) === "GUIDANCE ON",
  );
}

function isMissedApproachActive(root: HTMLElement) {
  return Array.from(root.querySelectorAll("span")).some(
    (item) => normalizedText(item.textContent) === "MISSED APPROACH",
  );
}

function speakMinimums() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance("Minimums");
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 0.9;
  utterance.volume = 1;

  const englishVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (englishVoice) utterance.voice = englishVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export default function PFPilotMinimumsAudio({ plan }: { plan: PilotPlan | null }) {
  const matches = useMemo(
    () => selectProcedureMatches(plan),
    [plan?.id, plan?.arrival_icao, plan?.route],
  );
  const initialMode = useMemo<ApproachMode>(
    () => selectApproachModeForPlan(plan, matches.approach) ?? "ILS",
    [plan?.id, plan?.route, matches.approach?.id],
  );
  const [mode, setMode] = useState<ApproachMode>(initialMode);
  const previousAltitudeRef = useRef<number | null>(null);
  const armedRef = useRef(false);
  const calledRef = useRef(false);

  const resetCallout = () => {
    previousAltitudeRef.current = null;
    armedRef.current = false;
    calledRef.current = false;
  };

  useEffect(() => {
    setMode(initialMode);
    resetCallout();
  }, [initialMode, matches.approach?.id]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button) return;
      const text = normalizedText(button.textContent);
      if (text === "ILS") {
        setMode("ILS");
        resetCallout();
      } else if (text === "LOC (GS OUT)") {
        setMode("LOC");
        resetCallout();
      } else if (text === "RNAV (GNSS)") {
        setMode("RNAV");
        resetCallout();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const approach = matches.approach;
    const minimum = approach?.approach.minima[mode]?.feet;
    if (!approach || !minimum) return;

    const evaluate = () => {
      const root = document.querySelector<HTMLElement>('[data-pf24-pfpilot-state="active"]');
      if (!root) {
        resetCallout();
        return;
      }

      const altitude = parseAltitude(findMetricValue(root, "ALTITUDE"));
      if (altitude === null) return;

      const procedureText = activeProcedureText(root);
      const approachIsActive =
        procedureText.includes("APPROACH") &&
        procedureText.includes(approach.airport) &&
        procedureText.includes(`RWY ${approach.runway}`);

      if (!approachIsActive || !isGuidanceEnabled(root) || isMissedApproachActive(root)) {
        previousAltitudeRef.current = altitude;
        armedRef.current = false;
        calledRef.current = false;
        return;
      }

      if (altitude >= minimum + 250) {
        armedRef.current = true;
        calledRef.current = false;
      }

      const previous = previousAltitudeRef.current;
      const descending = previous !== null && altitude < previous;
      const crossedMinimum =
        previous !== null &&
        previous > minimum + 20 &&
        altitude <= minimum + 20;

      if (armedRef.current && !calledRef.current && descending && crossedMinimum) {
        calledRef.current = true;
        speakMinimums();
      }

      previousAltitudeRef.current = altitude;
    };

    evaluate();
    const root = document.querySelector<HTMLElement>('[data-pf24-pfpilot-state="active"]');
    if (!root) return;

    const observer = new MutationObserver(evaluate);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [matches.approach, mode]);

  return null;
}
