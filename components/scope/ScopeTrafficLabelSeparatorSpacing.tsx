"use client";

import { useEffect } from "react";

const LABEL_SELECTOR = "[data-pf24-traffic-label='true']";
const SHIFT_PX = -4;

export default function ScopeTrafficLabelSeparatorSpacing() {
  useEffect(() => {
    let queued = false;

    const sync = () => {
      queued = false;
      for (const label of Array.from(document.querySelectorAll<HTMLElement>(LABEL_SELECTOR))) {
        for (const span of Array.from(label.querySelectorAll<HTMLSpanElement>("span"))) {
          if (span.textContent?.trim() !== "--") continue;
          span.dataset.pf24TrafficLabelSeparator = "true";
          span.style.transform = `translateX(${SHIFT_PX}px)`;
        }
      }
    };

    const queue = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(queue);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    sync();

    return () => {
      observer.disconnect();
      for (const span of Array.from(document.querySelectorAll<HTMLElement>("[data-pf24-traffic-label-separator='true']"))) {
        span.style.removeProperty("transform");
        span.removeAttribute("data-pf24-traffic-label-separator");
      }
    };
  }, []);

  return null;
}
