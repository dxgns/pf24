"use client";

import { useEffect } from "react";

const LIST_TITLES = ["SECTOR LIST", "COMBINED TAXI LIST", "FREQ"] as const;

function scopeConnected() {
  const top = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(top?.querySelectorAll<HTMLButtonElement>("button") ?? []).some(
    (button) => button.textContent?.trim().toUpperCase() === "DISCONNECT",
  );
}

function liveSelector(title: (typeof LIST_TITLES)[number]) {
  if (title === "SECTOR LIST") return "[data-pf24-live-sector-list='true']";
  if (title === "COMBINED TAXI LIST") return "[data-pf24-live-taxi-list='true']";
  return "[data-pf24-live-freq-list='true']";
}

function syncListBodies() {
  const windows = Array.from(
    document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"),
  );
  const connected = scopeConnected();

  for (const title of LIST_TITLES) {
    const win = windows.find((element) =>
      element.firstElementChild?.textContent?.toUpperCase().includes(title),
    );
    if (!win) continue;

    const header = win.firstElementChild;
    const children = Array.from(win.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== header,
    );

    let live = win.querySelector<HTMLElement>(`:scope > ${liveSelector(title)}`);

    // FREQ predates the explicit live marker. When both native + live bodies are
    // mounted, the operational portal is the last direct child; mark it once so
    // collapse/expand can never confuse it with the legacy body again.
    if (title === "FREQ" && !live && connected && children.length >= 2) {
      live = children[children.length - 1];
      live.dataset.pf24LiveFreqList = "true";
    }

    for (const child of children) {
      if (child === live) {
        child.style.display = connected ? "" : "none";
      } else {
        // Everything that is not the operational portal is legacy PF24Scope
        // content and must never become visible again.
        child.style.display = "none";
      }
    }

    // If the operational component briefly treated its own portal as the native
    // body during a collapse, undo that inline display:none here.
    if (live && connected) live.style.display = "";
  }
}

function scheduleSync() {
  syncListBodies();
  window.setTimeout(syncListBodies, 0);
  window.setTimeout(syncListBodies, 50);
  window.setTimeout(syncListBodies, 160);
  window.setTimeout(syncListBodies, 320);
}

export default function ScopeNativeListBodyGuard() {
  useEffect(() => {
    scheduleSync();

    const onUiChange = () => scheduleSync();

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
