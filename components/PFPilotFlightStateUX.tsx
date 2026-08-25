"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActivePlan = {
  id: string;
  callsign: string;
};

function normalizedText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function setDisplay(element: HTMLElement | null, visible: boolean) {
  if (!element) return;
  const next = visible ? "" : "none";
  if (element.style.display !== next) element.style.display = next;
}

function findFlightDeckCard() {
  const marked = document.querySelector<HTMLElement>("[data-pf24-pfpilot-flight-deck='true']");
  if (marked) return marked;

  for (const panel of Array.from(document.querySelectorAll<HTMLElement>("aside .panel"))) {
    const marker = Array.from(panel.querySelectorAll<HTMLElement>("p")).find(
      (item) => normalizedText(item.textContent).toUpperCase() === "PFPILOT",
    );
    if (!marker) continue;
    panel.dataset.pf24PfpilotFlightDeck = "true";
    return panel;
  }

  return null;
}

function findFlightPlanModule() {
  return Array.from(document.querySelectorAll<HTMLElement>("section .panel")).find((panel) => {
    const heading = Array.from(panel.querySelectorAll<HTMLHeadingElement>("h2")).find(
      (item) => normalizedText(item.textContent).toUpperCase() === "FLIGHT PLAN",
    );
    return Boolean(heading);
  }) ?? null;
}

function findCreatePanel(module: HTMLElement) {
  const heading = Array.from(module.querySelectorAll<HTMLHeadingElement>("h2")).find(
    (item) => normalizedText(item.textContent).toUpperCase() === "NUEVO PLAN DE VUELO",
  );
  return heading?.closest<HTMLElement>(".panel") ?? null;
}

function findEmptyPlanPanel(module: HTMLElement) {
  return Array.from(module.querySelectorAll<HTMLElement>(".panel")).find((panel) =>
    normalizedText(panel.textContent).toUpperCase().includes("NO TIENES VUELOS ACTIVOS ACTUALMENTE"),
  ) ?? null;
}

function isFinishButton(button: HTMLButtonElement) {
  return normalizedText(button.textContent).toUpperCase().includes("FINALIZAR");
}

function findExistingPlanCards(module: HTMLElement) {
  const cards = new Set<HTMLElement>();

  for (const card of Array.from(module.querySelectorAll<HTMLElement>("[data-pf24-pilot-fpl-readonly='true']"))) {
    cards.add(card);
  }

  for (const button of Array.from(module.querySelectorAll<HTMLButtonElement>("button"))) {
    if (!isFinishButton(button)) continue;
    const card = button.closest<HTMLElement>(".panel");
    if (card && card !== module) cards.add(card);
  }

  return Array.from(cards);
}

export default function PFPilotFlightStateUX({ pilotId }: { pilotId: string }) {
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const finishingRef = useRef(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("flight_plans")
      .select("id,callsign")
      .eq("created_by", pilotId)
      .neq("status", "FINISHED")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("PFPilot flight-state refresh failed:", error);
      return;
    }

    const row = (data ?? [])[0] as ActivePlan | undefined;
    setActivePlan(row ?? null);
  }, [pilotId]);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel(`pfpilot-flight-state-ux-${pilotId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_plans" },
        () => void refresh(),
      )
      .subscribe();

    const fallback = window.setInterval(() => void refresh(), 2500);

    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [pilotId, refresh]);

  useEffect(() => {
    let frame: number | null = null;

    const sync = () => {
      frame = null;

      const deck = findFlightDeckCard();
      setDisplay(deck, Boolean(activePlan));
      if (deck && activePlan) {
        const heading = deck.querySelector<HTMLHeadingElement>("h2");
        const callsign = activePlan.callsign.trim().toUpperCase();
        if (heading && heading.textContent !== callsign) heading.textContent = callsign;
      }

      const module = findFlightPlanModule();
      if (!module) return;

      const createPanel = findCreatePanel(module);
      const emptyPanel = findEmptyPlanPanel(module);
      const existingCards = findExistingPlanCards(module);

      // Exactly one Flight Plan state is visible at a time:
      // no active plan -> creation form only; active plan -> filed plan only.
      setDisplay(createPanel, !activePlan);
      setDisplay(emptyPanel, false);
      for (const card of existingCards) setDisplay(card, Boolean(activePlan));
    };

    const queueSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    queueSync();
    const observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activePlan]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button")
        : null;
      if (!button || !isFinishButton(button) || !button.closest("section")) return;

      // PFPilot owns the finish flow. Stop PilotFlightPlans from redirecting to
      // /dashboard after the database update.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (!activePlan || finishingRef.current) return;
      if (!window.confirm("¿Finalizar este vuelo?")) return;

      finishingRef.current = true;
      void supabase
        .from("flight_plans")
        .update({
          status: "FINISHED",
          sector_status: "PARKED",
          assumed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activePlan.id)
        .eq("created_by", pilotId)
        .neq("status", "FINISHED")
        .then(({ error }) => {
          finishingRef.current = false;
          if (error) {
            console.error("PFPilot finish flight failed:", error);
            window.alert("No se pudo finalizar el vuelo.");
            return;
          }
          setActivePlan(null);
          void refresh();
        });
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [activePlan, pilotId, refresh]);

  return null;
}
