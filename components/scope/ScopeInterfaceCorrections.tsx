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

function syncChatLayout() {
  const footer = document.querySelector<HTMLElement>("main.fixed footer");
  if (!footer) return;
  const tabs = findChatTabs(footer);
  if (!tabs) return;

  tabs.style.left = "4px";
  tabs.style.bottom = "8px";
  tabs.style.width = "150px";
  tabs.style.height = "auto";
  tabs.style.maxHeight = "68px";
  tabs.style.display = "flex";
  tabs.style.flexDirection = "column";
  tabs.style.alignItems = "flex-start";
  tabs.style.gap = "0";
  tabs.style.overflowX = "hidden";
  tabs.style.overflowY = "auto";

  for (const item of Array.from(tabs.children)) {
    if (!(item instanceof HTMLElement)) continue;
    item.style.display = "block";
    item.style.width = "100%";
    item.style.height = "14px";
    item.style.lineHeight = "14px";
    item.style.paddingLeft = "4px";

    const raw = item.textContent?.trim() ?? "";
    if (/^\d{3}\.\d{3}$/.test(raw)) {
      const position = Object.entries(ATC_FREQUENCIES).find(([, frequency]) => frequency === raw)?.[0];
      if (position && item.dataset.pf24ChatRelabeled !== "true") {
        item.textContent = `${position}  ${raw}`;
        item.dataset.pf24ChatRelabeled = "true";
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
      holder.style.paddingLeft = "156px";
      holder.style.width = "168px";
      holder.style.justifyContent = "flex-end";
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
    panel.innerHTML = '<div>Bienvenido a PFScope.</div><div>Ejecuta el comando .ayuda para ver la lista de comandos</div><div style="position:absolute;top:76px;left:0;color:#222">Console</div>';
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
          const log = footer?.querySelector<HTMLElement>(":scope > div.pointer-events-none");
          const body = log?.firstElementChild as HTMLElement | null;
          if (body && !body.querySelector("[data-pf24-console-greeting='true']")) {
            const greeting = document.createElement("div");
            greeting.dataset.pf24ConsoleGreeting = "true";
            greeting.innerHTML = `<div>Bienvenido a PFScope.</div><div>Ejecuta el comando .ayuda para ver la lista de comandos</div><div>Te haz conectado en ${detail.callsign}.</div>`;
            body.prepend(greeting);
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
    window.addEventListener("pf24-scope-connection-change", onConnection);
    ensureDisconnectedConsole();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      style.remove();
    };
  }, []);

  return null;
}
