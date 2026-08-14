"use client";

import { useEffect } from "react";

const LIST_TITLES = ["SECTOR LIST", "COMBINED TAXI LIST", "FREQ"] as const;

function hideNativeListBodies() {
  const windows = Array.from(
    document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"),
  );

  for (const title of LIST_TITLES) {
    const win = windows.find((element) =>
      element.firstElementChild?.textContent?.toUpperCase().includes(title),
    );
    const body = win?.children[1];
    if (body instanceof HTMLElement) {
      body.style.display = "none";
    }
  }
}

function scheduleHide() {
  hideNativeListBodies();
  window.setTimeout(hideNativeListBodies, 0);
  window.setTimeout(hideNativeListBodies, 60);
  window.setTimeout(hideNativeListBodies, 180);
}

export default function ScopeNativeListBodyGuard() {
  useEffect(() => {
    scheduleHide();

    const onUiChange = () => scheduleHide();

    document.addEventListener("click", onUiChange, true);
    window.addEventListener("pf24-menu-visibility-sync", onUiChange);
    window.addEventListener("resize", onUiChange);

    return () => {
      document.removeEventListener("click", onUiChange, true);
      window.removeEventListener("pf24-menu-visibility-sync", onUiChange);
      window.removeEventListener("resize", onUiChange);
    };
  }, []);

  return null;
}
