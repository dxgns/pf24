"use client";

import { useEffect } from "react";

function placeTrafficInfo() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  const form = footer?.querySelector<HTMLFormElement>("form");
  const input = form?.querySelector<HTMLInputElement>("input");
  const info = footer?.querySelector<HTMLElement>("[data-pf24-selected-traffic-info='true']");
  if (!footer || !form || !input || !info) return;

  const left = input.offsetLeft + input.offsetWidth + 6;
  info.style.setProperty("left", `${left}px`, "important");
  info.style.setProperty("right", "auto", "important");
  info.style.setProperty("bottom", "9px", "important");
  info.style.setProperty("max-width", `calc(100% - ${left + 8}px)`, "important");
}

export default function ScopeTrafficFooterPlacement() {
  useEffect(() => {
    placeTrafficInfo();
    const first = window.setTimeout(placeTrafficInfo, 60);
    const second = window.setTimeout(placeTrafficInfo, 250);
    const timer = window.setInterval(placeTrafficInfo, 700);
    const onResize = () => placeTrafficInfo();
    const onClick = () => window.setTimeout(placeTrafficInfo, 0);

    window.addEventListener("resize", onResize);
    document.addEventListener("click", onClick, true);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearInterval(timer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
