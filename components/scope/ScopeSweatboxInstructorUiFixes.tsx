"use client";

import { useEffect } from "react";
import {
  SCOPE_SERVER_EVENT,
  readScopeServerMode,
  type ScopeServerMode,
  type SweatboxSessionDetail,
} from "@/lib/scope/sweatbox";

const EDITOR_SELECTOR = "[data-pf24-atc-fpl-editor='true']";

function unlockField(field: HTMLInputElement | HTMLTextAreaElement) {
  field.disabled = false;
  field.readOnly = false;
  field.removeAttribute("disabled");
  field.removeAttribute("readonly");
  field.setAttribute("aria-disabled", "false");
  field.tabIndex = 0;
  field.style.pointerEvents = "auto";
  field.style.userSelect = "text";
  field.style.cursor = "text";
}

function unlockInstructorEditors() {
  document.querySelectorAll<HTMLElement>(EDITOR_SELECTOR).forEach((editor) => {
    editor.dataset.pf24SweatboxInstructorEditor = "true";
    editor.style.pointerEvents = "auto";
    editor.style.zIndex = "2147483000";
    editor.style.isolation = "isolate";

    editor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea").forEach(unlockField);
    editor.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = false;
      button.style.pointerEvents = "auto";
    });
  });
}

export default function ScopeSweatboxInstructorUiFixes({ canInstruct }: { canInstruct: boolean }) {
  useEffect(() => {
    let connected = false;
    let mode: ScopeServerMode = readScopeServerMode();
    let frame = 0;

    const editable = () => connected && canInstruct && mode === "SWEATBOX_INSTRUCTOR";
    const apply = () => {
      frame = 0;
      if (!editable()) return;
      unlockInstructorEditors();
    };
    const queue = () => {
      if (frame || !editable()) return;
      frame = window.requestAnimationFrame(apply);
    };

    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      connected = Boolean(detail.connected);
      mode = detail.mode;
      if (editable()) queue();
    };

    // React can re-apply readOnly during the frequent SweatBox traffic renders.
    // Clear it again whenever the editor or one of its attributes changes.
    const observer = new MutationObserver(queue);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["readonly", "disabled"],
    });

    // Make the field writable synchronously before the browser handles the
    // keystroke/focus. This avoids a one-frame race with a React re-render.
    const ensureTargetEditable = (event: Event) => {
      if (!editable()) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (!target.closest(EDITOR_SELECTOR)) return;
      unlockField(target);
    };

    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    document.addEventListener("pointerdown", ensureTargetEditable, true);
    document.addEventListener("focusin", ensureTargetEditable, true);
    document.addEventListener("keydown", ensureTargetEditable, true);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
      document.removeEventListener("pointerdown", ensureTargetEditable, true);
      document.removeEventListener("focusin", ensureTargetEditable, true);
      document.removeEventListener("keydown", ensureTargetEditable, true);
    };
  }, [canInstruct]);

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
