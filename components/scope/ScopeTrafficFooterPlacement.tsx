"use client";

import { useEffect } from "react";

const INFO_SELECTOR = "[data-pf24-selected-traffic-info='true']";
const CLONE_ATTR = "data-pf24-selected-traffic-info-clone";

function placeTrafficInfo() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  const form = footer?.querySelector<HTMLFormElement>("form");
  const input = form?.querySelector<HTMLInputElement>("input");
  const info = footer?.querySelector<HTMLElement>(INFO_SELECTOR);
  if (!footer || !form || !input || !info) return;

  const left = input.offsetLeft + input.offsetWidth + 6;
  info.style.setProperty("position", "absolute", "important");
  info.style.setProperty("left", `${left}px`, "important");
  info.style.setProperty("right", "auto", "important");
  info.style.setProperty("bottom", "9px", "important");
  info.style.setProperty("max-width", `calc(100% - ${left + 8}px)`, "important");
}

export default function ScopeTrafficFooterPlacement() {
  useEffect(() => {
    let savedHtml = "";
    let savedClass = "";
    let frame = 0;

    const sync = () => {
      frame = 0;
      const footer = document.querySelector<HTMLElement>("main.fixed footer");
      const detailedTag = document.querySelector<HTMLElement>("[data-pf24-traffic-detail='true']");
      const realInfo = footer?.querySelector<HTMLElement>(`${INFO_SELECTOR}:not([${CLONE_ATTR}='true'])`) ?? null;
      const clone = footer?.querySelector<HTMLElement>(`[${CLONE_ATTR}='true']`) ?? null;

      if (realInfo) {
        savedHtml = realInfo.innerHTML;
        savedClass = realInfo.className;
        clone?.remove();
        placeTrafficInfo();
        return;
      }

      if (!detailedTag) {
        savedHtml = "";
        savedClass = "";
        clone?.remove();
        return;
      }

      if (footer && savedHtml && !clone) {
        const restored = document.createElement("div");
        restored.setAttribute("data-pf24-selected-traffic-info", "true");
        restored.setAttribute(CLONE_ATTR, "true");
        restored.className = savedClass;
        restored.innerHTML = savedHtml;
        footer.appendChild(restored);
        placeTrafficInfo();
      } else if (clone) {
        placeTrafficInfo();
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const first = window.setTimeout(schedule, 60);
    const second = window.setTimeout(schedule, 250);

    const main = document.querySelector<HTMLElement>("main.fixed");
    const observer = main ? new MutationObserver(schedule) : null;
    observer?.observe(main!, { childList: true, subtree: true });

    window.addEventListener("resize", schedule);
    document.addEventListener("click", schedule, true);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("click", schedule, true);
      document.querySelectorAll<HTMLElement>(`[${CLONE_ATTR}='true']`).forEach((node) => node.remove());
    };
  }, []);

  return null;
}
