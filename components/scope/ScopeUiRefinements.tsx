"use client";

import { useEffect } from "react";

type SavedTools = { heading: boolean; trail: boolean };

const TOOL_STORAGE_KEY = "pf24_scope_toolbar_tools_v1";

function topButtons(): HTMLButtonElement[] {
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(row?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []);
}

function readTools(): SavedTools {
  try {
    const raw = localStorage.getItem(TOOL_STORAGE_KEY);
    if (!raw) return { heading: false, trail: false };
    const parsed = JSON.parse(raw) as Partial<SavedTools>;
    return { heading: parsed.heading === true, trail: parsed.trail === true };
  } catch {
    return { heading: false, trail: false };
  }
}

function writeTools(value: SavedTools) {
  localStorage.setItem(TOOL_STORAGE_KEY, JSON.stringify(value));
}

export default function ScopeUiRefinements() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.pf24UiRefinements = "true";
    style.textContent = `
      /* Weather panel dimensions are controlled by WeatherPanel itself. */
      [data-pf24-weather-window='true'] {
        box-sizing: border-box !important;
      }
      [data-pf24-weather-window='true'] [data-pf24-metar-row='true'] {
        overflow: hidden !important;
        white-space: nowrap !important;
        text-overflow: clip !important;
      }

      /* Timer uses the same palette/borders as HOLD LIST, without changing its layout. */
      [data-pf24-functional-timer='true'] { background: #555c61 !important; color: #e8e8e8 !important; }
      [data-pf24-functional-timer='true'] > div { background: #555c61 !important; }
      [data-pf24-functional-timer='true'] > div:first-child { border-bottom-color: #ededed !important; }
      [data-pf24-functional-timer='true'] button { border-color: #ededed !important; }
      [data-pf24-functional-timer='true'] button:hover { background: #646b70 !important; }

      /* Keep the original General / Personalization tab strip visible and identical. */
      [data-pf24-personalization-panel='true'] {
        position: relative !important;
        inset: auto !important;
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(style);

    const restore = () => {
      const buttons = topButtons();
      const saved = readTools();
      const heading = buttons[5];
      const trail = buttons[6];
      if (saved.heading && heading && !heading.classList.contains("scopeToolOn")) heading.click();
      if (saved.trail && trail && !trail.classList.contains("scopeToolOn")) trail.click();
    };
    const restoreTimer = window.setTimeout(restore, 220);

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const buttons = topButtons();
      const index = buttons.indexOf(button);
      if (index !== 5 && index !== 6) return;
      window.setTimeout(() => {
        const current = readTools();
        writeTools({
          heading: index === 5 ? button.classList.contains("scopeToolOn") : current.heading,
          trail: index === 6 ? button.classList.contains("scopeToolOn") : current.trail,
        });
      }, 0);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      window.clearTimeout(restoreTimer);
      document.removeEventListener("click", onClick, true);
      style.remove();
    };
  }, []);

  return null;
}
