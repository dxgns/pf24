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

function windowCollapsed(win: HTMLElement) {
  const header = win.firstElementChild as HTMLElement | null;
  if (!header) return false;
  const buttons = Array.from(header.querySelectorAll<HTMLButtonElement>(":scope button"));
  const collapse = buttons.length >= 3 ? buttons[buttons.length - 2] : null;
  const path = collapse?.querySelector<SVGPathElement>("path")?.getAttribute("d") ?? "";
  return path.includes("M2 3") && path.includes("L6 7");
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

    if (title === "FREQ" && !live && connected && children.length >= 2) {
      live = children[children.length - 1];
      live.dataset.pf24LiveFreqList = "true";
    }

    const collapsed = windowCollapsed(win);
    for (const child of children) {
      if (child === live) {
        child.style.display = connected && !collapsed ? "" : "none";
      } else {
        child.style.display = "none";
      }
    }

    if (live) live.style.display = connected && !collapsed ? "" : "none";
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
