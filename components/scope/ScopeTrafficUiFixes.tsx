"use client";

import { useEffect } from "react";

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

  if (side === "top") {
    edge.style.left = "-3px";
    edge.style.top = "-4px";
    edge.style.width = `${width + 6}px`;
    edge.style.height = "5px";
  } else if (side === "bottom") {
    edge.style.left = "-3px";
    edge.style.top = `${height - 1}px`;
    edge.style.width = `${width + 6}px`;
    edge.style.height = "5px";
  } else if (side === "left") {
    edge.style.left = "-4px";
    edge.style.top = "-1px";
    edge.style.width = "5px";
    edge.style.height = `${height + 2}px`;
  } else {
    edge.style.left = `${width - 1}px`;
    edge.style.top = "-1px";
    edge.style.width = "5px";
    edge.style.height = `${height + 2}px`;
  }

  label.appendChild(edge);
}

function ensureLabelHitboxes() {
  document.querySelectorAll<HTMLElement>(LABEL_SELECTOR).forEach((label) => {
    const first = label.firstElementChild;
    const detail = first?.tagName === "DIV";
    label.dataset.pf24TrafficMode = detail ? "detail" : "simple";

    const width = detail ? 96 : 56;
    const height = detail ? 40 : 28;

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

function syncFooterState() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  if (!footer) return;
  const info = document.querySelector<HTMLElement>(FOOTER_INFO_SELECTOR);
  if (info) footer.dataset.pf24HasSelectedTraffic = "true";
  else delete footer.dataset.pf24HasSelectedTraffic;
}

export default function ScopeTrafficUiFixes() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24TrafficUiFixes = "true";
    style.textContent = `
      ${LABEL_SELECTOR} {
        letter-spacing: -0.15px !important;
      }

      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] {
        pointer-events: none !important;
        width: 72px !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > *:not([data-pf24-traffic-drag-edge]) {
        pointer-events: auto;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:first-child {
        width: 10px !important;
        height: 7px !important;
        font-size: 8px !important;
        line-height: 7px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > div:nth-child(2) {
        width: 56px !important;
        height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > div:nth-child(2) > button {
        width: 56px !important;
        height: 8px !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:nth-child(3) {
        width: 54px !important;
        grid-template-columns: 28px 26px !important;
        column-gap: 0 !important;
        font-size: 9px !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='simple'] > span:nth-child(4) {
        width: 54px !important;
        padding-left: 28px !important;
        font-size: 9px !important;
        line-height: 7px !important;
      }

      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] {
        pointer-events: none !important;
        width: 126px !important;
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
        width: 88px !important;
        grid-template-columns: 47px 7px 34px !important;
        column-gap: 0 !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(3) {
        width: 96px !important;
        grid-template-columns: 27px 39px 30px !important;
        column-gap: 0 !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(4) {
        width: 88px !important;
        grid-template-columns: 27px 26px 35px !important;
        column-gap: 0 !important;
        line-height: 8px !important;
      }
      ${LABEL_SELECTOR}[data-pf24-traffic-mode='detail'] > div:nth-child(5) {
        width: 96px !important;
        grid-template-columns: 40px 25px 31px !important;
        column-gap: 0 !important;
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
        protectedLabel = label;
      } else if (button && text.startsWith("AHDG")) {
        headingDrag = true;
        protectedLabel = label;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY };
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
      headingDrag = false;
      labelDrag = false;
      protectedLabel = null;

      if (!wasProtected || !label) return;
      window.setTimeout(() => {
        const underPointer = document.elementFromPoint(lastPointer.x, lastPointer.y);
        if (underPointer && label.contains(underPointer)) return;
        label.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
      }, 60);
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseout", onMouseOut, true);
    window.addEventListener("mouseup", onMouseUp, true);

    const sync = () => {
      ensureContactMe();
      ensureLabelHitboxes();
      syncFooterState();
    };

    sync();
    const interval = window.setInterval(sync, 250);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      style.remove();
    };
  }, []);

  return null;
}
