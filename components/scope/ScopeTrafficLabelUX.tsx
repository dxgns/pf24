"use client";

import { useEffect, useRef } from "react";

const LABEL_SELECTOR = "[data-pf24-traffic-label='true']";
const SINGLE_CLICK_DELAY_MS = 180;

function getCallsignTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLButtonElement>("button");
  if (!button) return null;
  const label = button.closest<HTMLElement>(LABEL_SELECTOR);
  if (!label) return null;
  const firstButton = label.querySelector<HTMLButtonElement>("button");
  if (firstButton !== button) return null;
  return { button, label };
}

function redispatchToLabel(label: HTMLElement, type: "mousedown" | "click", source: MouseEvent) {
  label.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: source.button,
    buttons: source.buttons,
    clientX: source.clientX,
    clientY: source.clientY,
    screenX: source.screenX,
    screenY: source.screenY,
    ctrlKey: source.ctrlKey,
    shiftKey: source.shiftKey,
    altKey: source.altKey,
    metaKey: source.metaKey,
  }));
}

export default function ScopeTrafficLabelUX() {
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficLabelUx = "true";
    style.textContent = `
      /* Keep the real hitboxes large, but pack the visible text like a radar tag. */
      ${LABEL_SELECTOR} {
        letter-spacing: -0.15px !important;
      }

      /* Simple tag: callsign / FL+trend / speed / destination stay visually close. */
      ${LABEL_SELECTOR} > div.relative {
        width: 54px !important;
      }
      ${LABEL_SELECTOR} > div.relative > button:first-child {
        width: 54px !important;
      }
      ${LABEL_SELECTOR} > span.grid {
        width: 50px !important;
        grid-template-columns: 25px 25px !important;
        column-gap: 0 !important;
      }
      ${LABEL_SELECTOR} > span.block:last-child {
        width: 50px !important;
        padding-left: 25px !important;
      }

      /* Detailed tag. Outer width remains unchanged so connector geometry and hitbox stay correct. */
      ${LABEL_SELECTOR} > div.grid:nth-of-type(2) {
        width: 84px !important;
        grid-template-columns: 43px 8px 29px !important;
        column-gap: 2px !important;
      }
      ${LABEL_SELECTOR} > div.grid:nth-of-type(3) {
        width: 88px !important;
        grid-template-columns: 25px 36px 23px !important;
        column-gap: 2px !important;
      }
      ${LABEL_SELECTOR} > div.grid:nth-of-type(4) {
        width: 86px !important;
        grid-template-columns: 25px 25px 32px !important;
        column-gap: 2px !important;
      }
      ${LABEL_SELECTOR} > div.grid:nth-of-type(5) {
        width: 88px !important;
        grid-template-columns: 34px 24px 26px !important;
        column-gap: 2px !important;
      }
      ${LABEL_SELECTOR} > div.grid,
      ${LABEL_SELECTOR} > div.grid button,
      ${LABEL_SELECTOR} > div.grid input {
        line-height: 8px !important;
      }
    `;
    document.head.appendChild(style);

    const cancelPendingClick = () => {
      if (clickTimerRef.current === null) return;
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    };

    const onMouseDownCapture = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const hit = getCallsignTarget(event.target);
      if (!hit) return;

      // V6 deliberately stops mousedown propagation on buttons. Re-dispatch from the
      // label itself so the same callsign area can also be used as a drag handle.
      redispatchToLabel(hit.label, "mousedown", event);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const hit = getCallsignTarget(event.target);
      if (!hit) return;

      cancelPendingClick();
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        if (!hit.label.isConnected) return;
        // A normal click opens the detailed tag. V6's drag suppression still prevents
        // an accidental open after moving the label.
        redispatchToLabel(hit.label, "click", event);
      }, SINGLE_CLICK_DELAY_MS);
    };

    const onDoubleClickCapture = (event: MouseEvent) => {
      if (!getCallsignTarget(event.target)) return;
      // Preserve V6's double-click callsign action menu instead of also opening the tag.
      cancelPendingClick();
    };

    document.addEventListener("mousedown", onMouseDownCapture, true);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("dblclick", onDoubleClickCapture, true);

    return () => {
      cancelPendingClick();
      document.removeEventListener("mousedown", onMouseDownCapture, true);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("dblclick", onDoubleClickCapture, true);
      style.remove();
    };
  }, []);

  return null;
}
