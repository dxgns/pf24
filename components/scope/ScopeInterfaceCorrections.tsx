"use client";

import { useEffect } from "react";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";

const CONNECTION_KEY = "pf24_scope_connection_session_v1";

function findConfigDialog(button: HTMLButtonElement) {
  return button.closest<HTMLElement>("div.absolute");
}

function readPosition() {
  try {
    const value = JSON.parse(sessionStorage.getItem(CONNECTION_KEY) ?? "null") as { callsign?: string } | null;
    return value?.callsign?.trim().toUpperCase() ?? "";
  } catch { return ""; }
}

function findChatTabs(footer: HTMLElement) {
  return Array.from(footer.querySelectorAll<HTMLElement>(":scope > div")).find((node) =>
    Array.from(node.children).some((child) => child.textContent?.trim() === "Console"),
  ) ?? null;
}

function findChatLog(footer: HTMLElement) {
  return Array.from(footer.querySelectorAll<HTMLElement>(":scope > div")).find((node) => {
    if (!node.className.includes("pointer-events-none")) return false;
    const child = node.firstElementChild;
    return child instanceof HTMLElement && child.className.includes("overflow-y-auto");
  })?.firstElementChild as HTMLElement | null;
}

function syncChatLayout() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  if (!footer) return;

  const log = findChatLog(footer);
  if (log) {
    log.dataset.pf24KeyboardScrollOnly = "true";
    log.style.overflowY = "hidden";
    log.style.scrollbarWidth = "none";
  }

  const tabs = findChatTabs(footer);
  if (!tabs) return;

  // The chat selector lives outside the console area, immediately above the gray footer.
  tabs.style.left = "8px";
  tabs.style.top = "-48px";
  tabs.style.bottom = "auto";
  tabs.style.width = "150px";
  tabs.style.height = "auto";
  tabs.style.maxHeight = "46px";
  tabs.style.display = "flex";
  tabs.style.flexDirection = "column";
  tabs.style.alignItems = "flex-start";
  tabs.style.gap = "0";
  tabs.style.overflow = "hidden";
  tabs.style.color = "#d8d8d8";

  for (const item of Array.from(tabs.children)) {
    if (!(item instanceof HTMLElement)) continue;
    item.style.display = "block";
    item.style.width = "100%";
    item.style.height = "14px";
    item.style.lineHeight = "14px";
    item.style.paddingLeft = "0";
    item.style.color = item.className.includes("text-[#00efff]") ? "#00efff" : "#d8d8d8";

    const raw = item.textContent?.trim() ?? "";
    if (/^\d{3}\.\d{3}$/.test(raw)) {
      const position = Object.entries(ATC_FREQUENCIES).find(([, frequency]) => frequency === raw)?.[0];
      if (position && item.dataset.pf24ChatRelabeled === "true") {
        item.textContent = raw;
        delete item.dataset.pf24ChatRelabeled;
      }
    }
  }

  const input = footer.querySelector<HTMLInputElement>("input");
  if (input) input.style.marginLeft = "170px";

  const onLabel = Array.from(footer.querySelectorAll<HTMLElement>("span")).find((span) => /^on\s+/i.test(span.textContent?.trim() ?? ""));
  if (onLabel) {
    const holder = onLabel.parentElement;
    if (holder) {
      holder.style.marginLeft = "0";
      holder.style.paddingLeft = "0";
      holder.style.width = "164px";
      holder.style.justifyContent = "flex-end";
      holder.style.paddingRight = "6px";
    }
  }
}

function ensureDisconnectedConsole() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  if (!footer || readPosition() || findChatTabs(footer)) return;

  let panel = footer.querySelector<HTMLElement>("[data-pf24-disconnected-console='true']");
  if (!panel) {
    panel = document.createElement("div");
    panel.dataset.pf24DisconnectedConsole = "true";
    panel.className = "absolute left-[4px] top-[4px] z-[63] font-mono text-[9px] text-[#e8e8e8]";
    panel.innerHTML = '<div>Bienvenido a PFScope.</div><div>Ejecuta el comando .ayuda para ver la lista de comandos</div><div style="position:absolute;top:-48px;left:4px;color:#d8d8d8">Console</div>';
    footer.appendChild(panel);
  }
}

export default function ScopeInterfaceCorrections() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24InterfaceCorrections = "true";
    style.textContent = `
      [data-pf24-weather-window='true'] {
        transform: scale(.92);
        transform-origin: top left;
      }
      [data-pf24-keyboard-scroll-only='true'] {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        overflow-y: hidden !important;
      }
      [data-pf24-keyboard-scroll-only='true']::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const onClickCapture = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button || button.dataset.pf24ConfigClose !== "true") return;
      const dialog = findConfigDialog(button);
      if (!dialog) return;
      const cancel = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
        const label = candidate.textContent?.trim().toLowerCase();
        return label === "cancel" || label === "cancelar";
      });
      if (!cancel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel.click();
    };

    const onWheelCapture = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-pf24-keyboard-scroll-only='true']")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const footer = document.querySelector<HTMLElement>("main.fixed footer");
      if (!footer) return;
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement) || !footer.contains(active)) return;
      const log = findChatLog(footer);
      if (!log) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      log.scrollBy({ top: event.key === "ArrowUp" ? -28 : 28, behavior: "auto" });
    };

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const footer = document.querySelector<HTMLElement>("main.fixed footer");
      footer?.querySelector("[data-pf24-disconnected-console='true']")?.remove();
      if (detail?.connected && detail.callsign) {
        window.setTimeout(() => {
          syncChatLayout();
          const tabs = footer ? findChatTabs(footer) : null;
          const consoleTab = tabs ? Array.from(tabs.children).find((child) => child.textContent?.trim() === "Console") as HTMLElement | undefined : undefined;
          consoleTab?.click();
          const log = footer ? findChatLog(footer) : null;
          if (log && !log.querySelector("[data-pf24-console-greeting='true']")) {
            const greeting = document.createElement("div");
            greeting.dataset.pf24ConsoleGreeting = "true";
            greeting.innerHTML = `<div>Bienvenido a PFScope.</div><div>Ejecuta el comando .ayuda para ver la lista de comandos</div><div>Te haz conectado en ${detail.callsign}.</div>`;
            log.prepend(greeting);
          }
        }, 40);
      } else {
        window.setTimeout(ensureDisconnectedConsole, 20);
      }
    };

    const timer = window.setInterval(() => {
      syncChatLayout();
      ensureDisconnectedConsole();
    }, 250);

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("wheel", onWheelCapture, { capture: true, passive: false });
    document.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("pf24-scope-connection-change", onConnection);
    ensureDisconnectedConsole();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("wheel", onWheelCapture, true);
      document.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      style.remove();
    };
  }, []);

  return null;
}
