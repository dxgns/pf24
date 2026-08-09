"use client";

import { useCallback, useEffect } from "react";
import { DISCORD_ROLES } from "@/lib/discordRoles";

type Rank = "NONE" | "S0" | "S1" | "S2" | "S3" | "C1" | "C3" | "CI";
type Facility = "DEL" | "GND" | "TWR" | "APP" | "CTR";

const FACILITIES_BY_RANK: Record<Rank, Facility[]> = {
  NONE: [],
  S0: [],
  S1: ["DEL", "GND"],
  S2: ["DEL", "GND", "TWR"],
  S3: ["DEL", "GND", "TWR", "APP"],
  C1: ["DEL", "GND", "TWR", "APP", "CTR"],
  C3: ["DEL", "GND", "TWR", "APP", "CTR"],
  CI: ["DEL", "GND", "TWR", "APP", "CTR"],
};

function rankFromRoles(roles: string[]): Rank {
  if (roles.includes(DISCORD_ROLES.CI)) return "CI";
  if (roles.includes(DISCORD_ROLES.C3)) return "C3";
  if (roles.includes(DISCORD_ROLES.C1)) return "C1";
  if (roles.includes(DISCORD_ROLES.S3)) return "S3";
  if (roles.includes(DISCORD_ROLES.S2)) return "S2";
  if (roles.includes(DISCORD_ROLES.S1)) return "S1";
  if (roles.includes(DISCORD_ROLES.S0)) return "S0";
  return "NONE";
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setReactSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ScopeRatingAccess({ roles }: { roles: string[] }) {
  const rank = rankFromRoles(roles);
  const allowed = FACILITIES_BY_RANK[rank];

  const sync = useCallback(() => {
    const dialog = document.querySelector<HTMLElement>(".connectBox");
    if (!dialog) return;

    const rows = Array.from(dialog.querySelectorAll<HTMLElement>("div.mb-1"));
    let ratingInput: HTMLInputElement | null = null;
    let facilitySelect: HTMLSelectElement | null = null;

    for (const row of rows) {
      const label = row.firstElementChild;
      if (!(label instanceof HTMLElement)) continue;
      const text = label.textContent?.trim();

      if (text === "Password" || text === "Password ATC") {
        label.textContent = "Password ATC";
      }

      if (text === "Rating") {
        ratingInput = row.querySelector<HTMLInputElement>("input");
      }

      if (text === "Facility") {
        facilitySelect = row.querySelector<HTMLSelectElement>("select");
      }
    }

    if (ratingInput) {
      if (ratingInput.value !== rank) setReactInputValue(ratingInput, rank);
      ratingInput.readOnly = true;
      ratingInput.tabIndex = -1;
      ratingInput.setAttribute("aria-readonly", "true");
      ratingInput.classList.add("cursor-default");
    }

    if (facilitySelect) {
      for (const option of Array.from(facilitySelect.options)) {
        if (!option.value) {
          option.disabled = false;
          continue;
        }
        option.disabled = !allowed.includes(option.value as Facility);
      }

      if (facilitySelect.value && !allowed.includes(facilitySelect.value as Facility)) {
        setReactSelectValue(facilitySelect, "");
      }
      facilitySelect.disabled = rank === "S0" || rank === "NONE";
    }

    const connectButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Connect");
    if (connectButton && (rank === "S0" || rank === "NONE")) connectButton.disabled = true;
  }, [allowed, rank]);

  useEffect(() => {
    sync();

    const scheduleSync = () => window.setTimeout(sync, 0);
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (button?.textContent?.trim() === "Connect" && (rank === "S0" || rank === "NONE")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      scheduleSync();
    };
    const onChange = () => scheduleSync();

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onChange, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onChange, true);
      document.removeEventListener("change", onChange, true);
    };
  }, [rank, sync]);

  return null;
}