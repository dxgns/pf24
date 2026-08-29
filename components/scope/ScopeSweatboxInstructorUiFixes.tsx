"use client";

import { useEffect, useState } from "react";
import {
  SCOPE_SERVER_EVENT,
  readScopeServerMode,
  type SweatboxSessionDetail,
} from "@/lib/scope/sweatbox";

function unlockInstructorFplEditor() {
  const editor = document.querySelector<HTMLElement>("[data-pf24-atc-fpl-editor='true']");
  if (!editor) return;

  editor.dataset.pf24SweatboxInstructorEditor = "true";
  editor.style.pointerEvents = "auto";
  editor.style.zIndex = "2147483000";
  editor.style.isolation = "isolate";

  if (!editor.dataset.pf24SweatboxInputIsolation) {
    editor.dataset.pf24SweatboxInputIsolation = "true";
    const stop = (event: Event) => event.stopPropagation();
    editor.addEventListener("pointerdown", stop);
    editor.addEventListener("mousedown", stop);
    editor.addEventListener("keydown", stop);
    editor.addEventListener("keyup", stop);
    editor.addEventListener("wheel", stop);
  }

  editor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea").forEach((field) => {
    field.disabled = false;
    field.readOnly = false;
    field.removeAttribute("disabled");
    field.removeAttribute("readonly");
    field.setAttribute("aria-disabled", "false");
    field.tabIndex = 0;
    field.style.pointerEvents = "auto";
    field.style.userSelect = "text";
    field.style.cursor = "text";
  });

  editor.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = false;
    button.style.pointerEvents = "auto";
  });
}

export default function ScopeSweatboxInstructorUiFixes({ canInstruct }: { canInstruct: boolean }) {
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState(() => readScopeServerMode());
  const active = connected && mode === "SWEATBOX_INSTRUCTOR" && canInstruct;

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setConnected(Boolean(detail.connected));
      setMode(detail.mode);
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, []);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const queueUnlock = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        unlockInstructorFplEditor();
      });
    };

    queueUnlock();
    const observer = new MutationObserver(queueUnlock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "readonly"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active]);

  return <style jsx global>{`
    html[data-pf24-sweatbox-active='true'] [data-pf24-live-sector-list='true']:not([data-pf24-sweatbox-sector-layer='true']){display:none!important}
    [data-pf24-sweatbox-toolbar='true']{top:0!important;right:0!important;height:21px!important;border:0!important;box-shadow:none!important;background:#064a40!important}
    [data-pf24-sweatbox-toolbar='true']>button{height:21px!important;width:26px!important;min-width:26px!important;border-right:1px solid #173d38!important;padding:0!important}
    [data-pf24-sweatbox-toolbar='true']>button svg{height:18px!important;width:21px!important}
    [data-pf24-sweatbox-toolbar='true']>div.absolute{top:21px!important}
    [data-pf24-sweatbox-instructor-editor='true']{pointer-events:auto!important;z-index:2147483000!important;isolation:isolate!important}
    [data-pf24-sweatbox-instructor-editor='true'] input,
    [data-pf24-sweatbox-instructor-editor='true'] textarea{pointer-events:auto!important;user-select:text!important;cursor:text!important;opacity:1!important}
    [data-pf24-sweatbox-instructor-editor='true'] button{pointer-events:auto!important}
  `}</style>;
}