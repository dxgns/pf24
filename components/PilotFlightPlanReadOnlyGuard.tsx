"use client";

import { useEffect } from "react";

function activePlanCards(root: ParentNode) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  const cards = new Set<HTMLElement>();

  for (const button of buttons) {
    const text = button.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "";
    if (!text.includes("FINALIZAR VUELO")) continue;
    const card = button.closest<HTMLElement>(".panel");
    if (card) cards.add(card);
  }

  return Array.from(cards);
}

function belongsToLockedPlan(element: Element | null) {
  const card = element?.closest<HTMLElement>(".panel");
  if (!card) return false;
  return Array.from(card.querySelectorAll<HTMLButtonElement>("button")).some((button) =>
    (button.textContent?.replace(/\s+/g, " ").trim().toUpperCase() ?? "").includes("FINALIZAR VUELO"),
  );
}

export default function PilotFlightPlanReadOnlyGuard() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("main.radar-grid") ?? document.body;

    const lock = () => {
      for (const card of activePlanCards(root)) {
        card.dataset.pf24PilotFplReadonly = "true";
        card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")
          .forEach((control) => {
            if (!control.disabled) control.disabled = true;
            control.setAttribute("aria-readonly", "true");
          });
      }
    };

    const blockEdit = (event: Event) => {
      const target = event.target instanceof Element
        ? event.target.closest("input,select,textarea")
        : null;
      if (!target || !belongsToLockedPlan(target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    lock();
    const observer = new MutationObserver(lock);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

    document.addEventListener("beforeinput", blockEdit, true);
    document.addEventListener("input", blockEdit, true);
    document.addEventListener("change", blockEdit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("beforeinput", blockEdit, true);
      document.removeEventListener("input", blockEdit, true);
      document.removeEventListener("change", blockEdit, true);
    };
  }, []);

  return null;
}
