"use client";

import { useEffect } from "react";
import { normalizeAirlineCallsign, spokenAirlineCallsign } from "@/lib/scope/airlines";

const LABEL_SELECTOR = "[data-pf24-traffic-label='true']";
const MENU_SELECTOR = "[data-pf24-callsign-menu='true']";
const FOOTER_INFO_SELECTOR = "main.fixed footer > div.notranslate.pointer-events-none.absolute";

function buttonText(button: HTMLButtonElement) {
  return (button.textContent ?? "").trim().toUpperCase();
}

function ensureContactMe() {
  document.querySelectorAll<HTMLElement>(MENU_SELECTOR).forEach((menu) => {
    const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>(":scope > button"));
    const free = buttons.find((button) => buttonText(button) === "FREE");
    const exists = buttons.some((button) => buttonText(button) === "CONTACT ME");
    if (!free || exists) return;

    free.style.borderBottom = "1px solid #f2f2f2";

    const contact = document.createElement("button");
    contact.type = "button";
    contact.textContent = "Contact Me";
    contact.dataset.pf24ContactMe = "true";
    contact.className = "block w-full px-2 text-center hover:bg-[#626a6f]";
    contact.style.height = "18px";
    contact.style.lineHeight = "18px";
    contact.addEventListener("mousedown", (event) => event.stopPropagation());
    contact.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.appendChild(contact);
  });
}

function createEdge(label: HTMLElement, side: "top" | "right" | "bottom" | "left", width: number, height: number) {
  const edge = document.createElement("div");
  edge.dataset.pf24TrafficDragEdge = side;
  edge.style.position = "absolute";
  edge.style.pointerEvents = "auto";
  edge.style.zIndex = "3";
  edge.style.background = "transparent";
  edge.style.cursor = "move";

  if (side === "top") {
    edge.style.left = "-4px";
    edge.style.top = "-5px";
    edge.style.width = `${width + 8}px`;
    edge.style.height = "7px";
  } else if (side === "bottom") {
    edge.style.left = "-4px";
    edge.style.top = `${height - 2}px`;
    edge.style.width = `${width + 8}px`;
    edge.style.height = "7px";
  } else if (side === "left") {
    edge.style.left = "-5px";
    edge.style.top = "-2px";
    edge.style.width = "7px";
    edge.style.height = `${height + 4}px`;
  } else {
    edge.style.left = `${width - 2}px`;
    edge.style.top = "-2px";
    edge.style.width = "7px";
    edge.style.height = `${height + 4}px`;
  }

  label.appendChild(edge);
}

function ensureLabelHitboxes() {
  document.querySelectorAll<HTMLElement>(LABEL_SELECTOR).forEach((label) => {
    const first = label.firstElementChild;
    const detail = first?.tagName === "DIV";
    label.dataset.pf24TrafficMode = detail ? "detail" : "simple";

    const width = detail ? 98 : 58;
    const height = detail ? 41 : 29;

    const existing = Array.from(label.querySelectorAll<HTMLElement>(":scope > [data-pf24-traffic-drag-edge]"));
    if (existing.length === 4 && label.dataset.pf24HitboxMode === (detail ? "detail" : "simple")) return;
    existing.forEach((edge) => edge.remove());
    label.dataset.pf24HitboxMode = detail ? "detail" : "simple";
    createEdge(label, "top", width, height);
    createEdge(label, "right", width, height);
    createEdge(label, "bottom", width, height);
    createEdge(label, "left", width, height);
  });
}

function syncCallsignLabels() {
  document.querySelectorAll<HTMLElement>(LABEL_SELECTOR).forEach((label) => {
    const detail = label.dataset.pf24TrafficMode === "detail";
    const callsignNode = detail
      ? label.querySelector<HTMLElement>(":scope > div:nth-child(2) > span:first-child")
      : label.querySelector<HTMLElement>(":scope > span:nth-child(2)");
    if (!callsignNode) return;

    const raw = (callsignNode.dataset.pf24RawCallsign || callsignNode.textContent || "").trim();
    if (!raw) return;
    if (!callsignNode.dataset.pf24RawCallsign) callsignNode.dataset.pf24RawCallsign = raw;

    const normalized = normalizeAirlineCallsign(raw);
    if (normalized && callsignNode.textContent !== normalized) callsignNode.textContent = normalized;
  });
}

function syncFooterState() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  if (!footer) return;
  const info = document.querySelector<HTMLElement>(FOOTER_INFO_SELECTOR);
  if (info) footer.dataset.pf24HasSelectedTraffic = "true";
  else delete footer.dataset.pf24HasSelectedTraffic;
}

function syncFooterCallsign() {
  const info = document.querySelector<HTMLElement>(FOOTER_INFO_SELECTOR);
  if (!info) return;
  const spoken = info.querySelector<HTMLElement>("span.notranslate");
  if (!spoken) return;

  const firstText = Array.from(info.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (!firstText?.textContent) return;

  const source = firstText.textContent;
  const pipe = source.lastIndexOf("|");
  const bracket = source.lastIndexOf("[");
  if (pipe < 0 || bracket <= pipe) return;

  const raw = source.slice(pipe + 1, bracket).trim();
  if (!raw) return;
  const normalized = normalizeAirlineCallsign(raw);
  if (!normalized) return;

  const prefix = source.slice(0, pipe + 1);
  const nextText = `${prefix}  ${normalized} [`;
  if (firstText.textContent !== nextText) firstText.textContent = nextText;

  const spokenValue = spokenAirlineCallsign(normalized, raw);
  if (spoken.textContent !== spokenValue) spoken.textContent = spokenValue;
}

export default function ScopeTrafficUiFixes() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficUiFixes = "true";
    style.textContent = `
      ${LABEL_SELECTOR} {
        letter-spacing: -0.2px !important;
      }

      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] {
        pointer-events: none !important;
        width: 62px !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > *:not([data-pf24-traffic-drag-edge]) {
        pointer-events: auto;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:nth-child(1) {
        display: block !important;
        width: 10px !important;
        height: 7px !important;
        font-size: 8px !important;
        line-height: 7px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:nth-child(2) {
        display: block !important;
        width: 58px !important;
        height: 8px !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:nth-child(3) {
        display: block !important;
        width: 58px !important;
        height: 8px !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:nth-child(4) {
        display: block !important;
        width: 58px !important;
        height: 7px !important;
        padding-left: 30px !important;
        font-size: 9px !important;
        line-height: 7px !important;
      }

      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] {
        pointer-events: none !important;
        width: 104px !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > *:not([data-pf24-traffic-drag-edge]) {
        pointer-events: auto;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:first-child {
        width: 38px !important;
        height: 8px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(2) {
        width: 94px !important;
        grid-template-columns: 50px 8px 36px !important;
        column-gap: 0 !important;
        height: 8px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(3) {
        width: 100px !important;
        grid-template-columns: 29px 42px 29px !important;
        column-gap: 0 !important;
        height: 8px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(4) {
        width: 94px !important;
        grid-template-columns: 29px 28px 37px !important;
        column-gap: 0 !important;
        height: 8px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(5) {
        width: 100px !important;
        grid-template-columns: 43px 26px 31px !important;
        column-gap: 0 !important;
        height: 8px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] button,
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] input {
        font-size: 9px !important;
        line-height: 8px !important;
        min-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] input {
        width: 31px !important;
      }

      ${FOOTER_INFO_SELECTOR} {
        left: 455px !important;
        right: auto !important;
        bottom: 9px !important;
        width: 380px !important;
        max-width: 380px !important;
        height: 18px !important;
        border: 0 !important;
        background: transparent !important;
        padding: 0 4px !important;
        line-height: 18px !important;
      }
      main.fixed footer[data-pf24-has-selected-traffic='true'] form > div.ml-1 {
        margin-left: 390px !important;
      }
    `;
    document.head.appendChild(style);

    let headingDrag = false;
    let labelDrag = false;
    let protectedLabel: HTMLElement | null = null;
    let dragStart = { x: 0, y: 0 };
    let dragMoved = false;
    let suppressClickUntil = 0;
    let lastPointer = { x: 0, y: 0 };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      const label = event.target.closest<HTMLElement>(LABEL_SELECTOR);
      if (!label) return;

      const edge = event.target.closest("[data-pf24-traffic-drag-edge]");
      const button = event.target.closest<HTMLButtonElement>("button");
      const text = (button?.textContent ?? "").trim().toUpperCase();

      if (edge) {
        labelDrag = true;
        dragMoved = false;
        dragStart = { x: event.clientX, y: event.clientY };
        protectedLabel = label;
      } else if (button && text.startsWith("AHDG")) {
        headingDrag = true;
        protectedLabel = label;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      if (labelDrag && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) >= 4) dragMoved = true;
    };

    const onMouseOut = (event: MouseEvent) => {
      if ((!headingDrag && !labelDrag) || !protectedLabel) return;
      if (!(event.target instanceof Node) || !protectedLabel.contains(event.target)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && protectedLabel.contains(related)) return;
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onMouseUp = () => {
      const label = protectedLabel;
      const wasProtected = headingDrag || labelDrag;
      if (labelDrag && dragMoved) suppressClickUntil = performance.now() + 250;
      headingDrag = false;
      labelDrag = false;
      dragMoved = false;
      protectedLabel = null;

      if (!wasProtected || !label) return;
      window.setTimeout(() => {
        const underPointer = document.elementFromPoint(lastPointer.x, lastPointer.y);
        if (underPointer && label.contains(underPointer)) return;
        label.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
      }, 60);
    };

    const onClick = (event: MouseEvent) => {
      if (performance.now() > suppressClickUntil || !(event.target instanceof Element)) return;
      if (!event.target.closest(LABEL_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("mouseup", onMouseUp, true);

    const sync = () => {
      ensureContactMe();
      ensureLabelHitboxes();
      syncCallsignLabels();
      syncFooterState();
      syncFooterCallsign();
    };

    sync();
    const interval = window.setInterval(sync, 250);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      style.remove();
    };
  }, []);

  return null;
}
