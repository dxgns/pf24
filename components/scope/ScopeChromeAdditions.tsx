"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";

type ListKey = "sector" | "taxi" | "freq";
type ListVisibility = Record<ListKey, boolean>;

const WINDOW_LAYOUT_KEY = "pf24_scope_window_layout_v3";
const MENU_VISIBILITY_KEY = "pf24_scope_menu_visibility_v1";
const WINDOW_TITLES: Record<ListKey, string> = {
  sector: "SECTOR LIST",
  taxi: "COMBINED TAXI LIST",
  freq: "Freq",
};
const WINDOW_DEFAULTS: Record<ListKey, { x: number; y: number }> = {
  sector: { x: 8, y: 50 },
  taxi: { x: 8, y: 104 },
  freq: { x: 1120, y: 48 },
};
const DEFAULT_VISIBILITY: ListVisibility = { sector: true, taxi: true, freq: true };

function findTopBar(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main.fixed header > div:first-child");
}

function findMenu(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main.fixed .scopeMenu");
}

function findConfigDialog(): HTMLElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const general = buttons.find((button) => button.textContent?.trim() === "General");
  const personalization = buttons.find((button) => button.textContent?.trim() === "Personalization");
  if (!general || !personalization) return null;
  const dialog = general.closest<HTMLElement>("div.absolute");
  return dialog && dialog.contains(personalization) ? dialog : null;
}

function findScopeWindow(title: string): HTMLElement | null {
  const windows = Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"));
  const normalized = title.toUpperCase();
  return windows.find((windowElement) => windowElement.firstElementChild?.textContent?.trim().toUpperCase().includes(normalized)) ?? null;
}

function listKeyFromCloseButton(button: HTMLButtonElement): ListKey | null {
  const windowElement = button.closest("div.absolute.z-30") as HTMLElement | null;
  if (!windowElement || windowElement.parentElement?.tagName !== "SECTION") return null;

  const header = windowElement.firstElementChild as HTMLElement | null;
  if (!header || !header.contains(button)) return null;
  const headerButtons = Array.from(header.querySelectorAll<HTMLButtonElement>("button"));
  if (headerButtons.length === 0 || headerButtons[headerButtons.length - 1] !== button) return null;

  const title = header.textContent?.trim().toUpperCase() ?? "";
  if (title.includes("SECTOR LIST")) return "sector";
  if (title.includes("COMBINED TAXI LIST")) return "taxi";
  if (title.includes("FREQ")) return "freq";
  return null;
}

function readSavedVisibility(): ListVisibility {
  try {
    const raw = localStorage.getItem(MENU_VISIBILITY_KEY);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed = JSON.parse(raw) as Partial<ListVisibility>;
    return {
      sector: parsed.sector !== false,
      taxi: parsed.taxi !== false,
      freq: parsed.freq !== false,
    };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

function saveVisibility(value: ListVisibility) {
  localStorage.setItem(MENU_VISIBILITY_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pf24-menu-visibility-sync"));
}

function applyVisibility(value: ListVisibility) {
  (Object.keys(WINDOW_TITLES) as ListKey[]).forEach((key) => {
    const element = findScopeWindow(WINDOW_TITLES[key]);
    if (element) element.style.display = value[key] ? "" : "none";
  });
}

function prepareWindowForReload(key: ListKey) {
  try {
    const raw = localStorage.getItem(WINDOW_LAYOUT_KEY);
    const layout = raw ? JSON.parse(raw) as Record<string, { x?: number; y?: number; open?: boolean; collapsed?: boolean }> : {};
    const current = layout[key] ?? WINDOW_DEFAULTS[key];
    layout[key] = {
      x: typeof current.x === "number" ? current.x : WINDOW_DEFAULTS[key].x,
      y: typeof current.y === "number" ? current.y : WINDOW_DEFAULTS[key].y,
      open: true,
      collapsed: false,
    };
    localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify(layout));
  } catch {}
}

export default function ScopeChromeAdditions() {
  const [topBar, setTopBar] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [configDialog, setConfigDialog] = useState<HTMLElement | null>(null);
  const [listVisibility, setListVisibility] = useState<ListVisibility>(DEFAULT_VISIBILITY);

  const sync = useCallback(() => {
    setTopBar(findTopBar());
    setMenu(findMenu());
    setConfigDialog(findConfigDialog());
    const saved = readSavedVisibility();
    setListVisibility(saved);
    applyVisibility(saved);
  }, []);

  useEffect(() => {
    sync();
    const initial = window.setTimeout(sync, 120);
    const onClick = () => window.setTimeout(sync, 0);
    const onVisibilitySync = () => sync();
    document.addEventListener("click", onClick);
    window.addEventListener("resize", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("pf24-menu-visibility-sync", onVisibilitySync);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("click", onClick);
      window.removeEventListener("resize", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("pf24-menu-visibility-sync", onVisibilitySync);
    };
  }, [sync]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24ScopeCursor = "true";
    style.textContent = `
      main.fixed, main.fixed * {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cg fill='%23ffffff'%3E%3Crect x='15' y='2' width='2' height='10'/%3E%3Crect x='15' y='20' width='2' height='10'/%3E%3Crect x='2' y='15' width='10' height='2'/%3E%3Crect x='20' y='15' width='10' height='2'/%3E%3Crect x='14' y='14' width='4' height='4'/%3E%3C/g%3E%3C/svg%3E") 16 16, crosshair !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const emptySpacer = Array.from(menu.children).find((child) => child instanceof HTMLElement && child.textContent?.trim() === "");
    if (!(emptySpacer instanceof HTMLElement)) return;
    const previousDisplay = emptySpacer.style.display;
    emptySpacer.style.display = "none";
    return () => { emptySpacer.style.display = previousDisplay; };
  }, [menu]);

  useEffect(() => {
    const onCloseCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const matched = listKeyFromCloseButton(button);
      if (!matched) return;

      const next = { ...readSavedVisibility(), [matched]: false };
      saveVisibility(next);
      setListVisibility(next);
    };

    document.addEventListener("click", onCloseCapture, true);
    return () => document.removeEventListener("click", onCloseCapture, true);
  }, []);

  const toggleWindow = (key: ListKey) => {
    const current = readSavedVisibility();
    const nextValue = !current[key];
    const next = { ...current, [key]: nextValue };
    saveVisibility(next);
    setListVisibility(next);

    const windowElement = findScopeWindow(WINDOW_TITLES[key]);
    if (windowElement) {
      windowElement.style.display = nextValue ? "" : "none";
      return;
    }

    if (nextValue) {
      prepareWindowForReload(key);
      window.location.reload();
    }
  };

  const topAtis = topBar ? createPortal(
    <div className="pointer-events-none absolute left-[658px] top-0 z-[3] h-[21px] w-[60px]">
      <button
        type="button"
        data-pf24-top-atis="true"
        onClick={(event) => {
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("pf24-atis-dialog-toggle"));
        }}
        className="scopeTopCell pointer-events-auto h-[21px] w-[60px] border-l border-[#173d38] text-[12px] tracking-[1px] text-[#e2e2e2]"
        style={{ background: "var(--pf24-topbar, #064a40)" }}
      >ATIS</button>
    </div>,
    topBar,
  ) : null;

  const menuOptions = menu ? createPortal(
    <div data-pf24-list-menu-options="true" className="w-full border-t border-[#102f2a] bg-[#064a40]">
      {(Object.keys(WINDOW_TITLES) as ListKey[]).map((key) => {
        const labels: Record<ListKey, string> = {
          sector: "Show Sector List",
          taxi: "Show Combined Taxi List",
          freq: "Show Frequencies List",
        };
        return <button
          key={key}
          type="button"
          onClick={(event) => { event.stopPropagation(); toggleWindow(key); }}
          className="flex h-[29px] w-full items-center border-b border-[#102f2a] px-[6px] text-left text-[11px] tracking-[.3px] text-[#e2e2e2] hover:bg-[#0a554a]"
        >
          <span className="mr-[8px] flex h-[19px] w-[19px] shrink-0 items-center justify-center border-[2px] border-[#022f2a] bg-[#064a40] text-[21px] leading-none text-[#00ff32]">
            {listVisibility[key] ? "✓" : ""}
          </span>
          <span>{labels[key]}</span>
        </button>;
      })}
    </div>,
    menu,
  ) : null;

  const closeConfig = configDialog ? createPortal(
    <button
      type="button"
      data-pf24-config-close="true"
      onClick={() => {
        const cancel = Array.from(configDialog.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Cancelar");
        cancel?.click();
      }}
      className="absolute bottom-[10px] right-[12px] border border-[#9b9b9b] bg-[#e5e5e5] px-[14px] py-[3px] text-[12px] text-[#111]"
    >Close</button>,
    configDialog,
  ) : null;

  return <>{topAtis}{menuOptions}{closeConfig}</>;
}
