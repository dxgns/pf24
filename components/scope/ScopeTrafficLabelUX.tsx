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
      ${LABEL_SELECTOR} {
        letter-spacing: -0.3px !important;
      }

      ${LABEL_SELECTOR} > div.relative {
        width: 50px !important;
      }
      ${LABEL_SELECTOR} > div.relative > button:first-child {
        width: 50px !important;
      }
      ${LABEL_SELECTOR} > span.grid {
        width: 48px !important;
        grid-template-columns: 24px 24px !important;
        column-gap: 0 !important;
      }
      ${LABEL_SELECTOR} > span.block:last-child {
        width: 48px !important;
        padding-left: 24px !important;
      }

      ${LABEL_SELECTOR} > div.grid:nth-of-type(2) {
        width: 79px !important;
        grid-template-columns: 43px 7px 27px !important;
        column-gap: 1px !important;
      }
      ${LABEL_SELECTOR} > div.grid:nth-of-type(3) {
        width: 82px !important;
        grid-template-columns: 24px 34px 22px !important;
        column-gap: 1px !important;
      }
      ${LABEL_SELECTOR} > div.grid:nth-of-type(4) {
        width: 80px !important;
        grid-template-columns: 24px 23px 31px !important;
        column-gap: 1px !important;
      }
      ${LABEL_SELECTOR} > div.grid:nth-of-type(5) {
        width: 82px !important;
        grid-template-columns: 32px 23px 25px !important;
        column-gap: 1px !important;
      }
      ${LABEL_SELECTOR} > div.grid {
        line-height: 8px !important;
        min-height: 8px !important;
      }
      ${LABEL_SELECTOR} > div.grid > button,
      ${LABEL_SELECTOR} > div.grid > input,
      ${LABEL_SELECTOR} > div.grid > div.relative > button:first-child {
        line-height: 8px !important;
        min-height: 8px !important;
      }

      /* Same action menu geometry regardless of simple/detailed tag state. */
      ${LABEL_SELECTOR} [data-pf24-callsign-menu='true'] {
        width: 164px !important;
        min-width: 164px !important;
        height: auto !important;
        border: 2px solid #f1f1f1 !important;
        background: #565d61 !important;
        font-size: 13px !important;
        line-height: 27px !important;
        letter-spacing: 0 !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }
      ${LABEL_SELECTOR} [data-pf24-callsign-menu='true'] > div:first-child {
        height: 30px !important;
        min-height: 30px !important;
        padding: 0 10px !important;
        font-size: 14px !important;
        line-height: 30px !important;
        border-bottom: 2px solid #f1f1f1 !important;
        box-sizing: border-box !important;
      }
      ${LABEL_SELECTOR} [data-pf24-callsign-menu='true'] > button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 28px !important;
        min-height: 28px !important;
        padding: 0 10px !important;
        font-size: 13px !important;
        line-height: 27px !important;
        letter-spacing: 0 !important;
        border-bottom-width: 2px !important;
        box-sizing: border-box !important;
      }
      ${LABEL_SELECTOR} [data-pf24-callsign-menu='true'] > button:last-child {
        border-bottom-width: 0 !important;
      }

      [data-pf24-live-hold-list='true'] {
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      [data-pf24-live-hold-list='true'] > div {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        grid-template-columns: 28px minmax(0,1fr) 34px 34px !important;
        box-sizing: border-box !important;
      }
      [data-pf24-live-hold-list='true'] > div > span,
      [data-pf24-live-hold-list='true'] > div > div > span {
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        white-space: nowrap !important;
      }
      [data-pf24-live-hold-list='true'] > div.min-h-\\[78px\\] > div {
        width: 100% !important;
        grid-template-columns: 28px minmax(0,1fr) 34px 34px !important;
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
        redispatchToLabel(hit.label, "click", event);
      }, SINGLE_CLICK_DELAY_MS);
    };

    const onDoubleClickCapture = (event: MouseEvent) => {
      if (!getCallsignTarget(event.target)) return;
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
