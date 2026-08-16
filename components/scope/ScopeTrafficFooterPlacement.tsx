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

    const sync = () => {
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

    sync();
    const first = window.setTimeout(sync, 60);
    const second = window.setTimeout(sync, 250);
    const timer = window.setInterval(sync, 180);
    const onResize = () => sync();
    const onClick = () => window.setTimeout(sync, 0);

    window.addEventListener("resize", onResize);
    document.addEventListener("click", onClick, true);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearInterval(timer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onClick, true);
      document.querySelectorAll<HTMLElement>(`[${CLONE_ATTR}='true']`).forEach((node) => node.remove());
    };
  }, []);

  return null;
}
