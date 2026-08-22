"use client";

import { useEffect } from "react";

const ORANGE = "#fd5f10";
const SELECTOR = "[data-pf24-conflict-callsign='true']";

export default function ScopeConflictColorGuard() {
  useEffect(() => {
    const painted = new Set<HTMLElement>();
    let queued = false;

    const sync = () => {
      queued = false;
      const current = new Set(Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)));
      let restored = false;

      for (const element of painted) {
        if (current.has(element) && element.isConnected) continue;
        element.style.removeProperty("color");
        painted.delete(element);
        restored = true;
      }

      for (const element of current) {
        if (element.style.getPropertyValue("color") !== ORANGE || element.style.getPropertyPriority("color") !== "important") {
          element.style.setProperty("color", ORANGE, "important");
        }
        painted.add(element);
      }

      if (restored) window.dispatchEvent(new Event("pf24-traffic-ownership-change"));
    };

    const queue = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(queue);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "data-pf24-conflict-callsign"],
    });
    const timer = window.setInterval(sync, 120);
    sync();

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      for (const element of painted) element.style.removeProperty("color");
      painted.clear();
    };
  }, []);

  return null;
}
