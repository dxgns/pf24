"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CONNECTION_STORAGE_KEY = "pf24_scope_connection_session_v1";
const ATIS_CONFIG_STORAGE_KEY = "pf24_scope_atis_configs_v1";

const ATIS_AIRPORTS = new Set([
  "MDPC",
  "MDST",
  "LCLK",
  "LCPH",
  "EGKK",
  "EGHI",
  "LEMH",
  "GCLP",
  "EFKT",
]);

type StoredConnection = { callsign?: string };
type StoredAtisConfig = { active?: boolean; dep?: string; arr?: string; approach?: string; remarks?: string };
type StoredAtisConfigs = Record<string, StoredAtisConfig>;

function readPosition() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CONNECTION_STORAGE_KEY) ?? "null") as StoredConnection | null;
    return parsed?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function jurisdiction(position: string) {
  const upper = position.trim().toUpperCase();
  if (!upper) return new Set<string>();
  const airport = upper.slice(0, 4);
  const facility = upper.split("_").at(-1) ?? "";

  // ATIS is airport-local: only the airport's APP or TWR may create it.
  if ((facility === "APP" || facility === "TWR") && ATIS_AIRPORTS.has(airport)) {
    return new Set([airport]);
  }

  return new Set<string>();
}

function readConfigs(): StoredAtisConfigs {
  try {
    const parsed = JSON.parse(localStorage.getItem(ATIS_CONFIG_STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as StoredAtisConfigs : {};
  } catch {
    return {};
  }
}

function disableUnauthorizedConfigs(allowed: Set<string>) {
  const configs = readConfigs();
  let changed = false;
  const next: StoredAtisConfigs = { ...configs };
  for (const [icao, config] of Object.entries(configs)) {
    const upper = icao.toUpperCase();
    if ((ATIS_AIRPORTS.has(upper) && allowed.has(upper)) || !config?.active) continue;
    next[icao] = { ...config, active: false };
    changed = true;
  }
  if (changed) localStorage.setItem(ATIS_CONFIG_STORAGE_KEY, JSON.stringify(next));
}

function airportSelect(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLSelectElement>("select")).find((select) => {
    const row = select.closest("div");
    return row?.textContent?.toUpperCase().includes("AIRPORT") ?? false;
  }) ?? null;
}

function setReactSelectValue(select: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ScopeAtisJurisdictionGuard({ controllerName }: { controllerName: string }) {
  const [position, setPosition] = useState("");

  const enforce = useCallback(async (nextPosition = position) => {
    const allowed = jurisdiction(nextPosition);
    disableUnauthorizedConfigs(allowed);

    const dialog = document.querySelector<HTMLElement>("[data-pf24-atis-dialog='true']");
    if (dialog) {
      const select = airportSelect(dialog);
      if (select) {
        Array.from(select.options).forEach((option) => {
          const icao = option.value.toUpperCase();
          const enabled = ATIS_AIRPORTS.has(icao) && allowed.has(icao);
          option.disabled = !enabled;
          option.hidden = !enabled;
        });
        if (!ATIS_AIRPORTS.has(select.value.toUpperCase()) || !allowed.has(select.value.toUpperCase())) {
          const firstAllowed = Array.from(select.options).find((option) => {
            const icao = option.value.toUpperCase();
            return ATIS_AIRPORTS.has(icao) && allowed.has(icao);
          });
          if (firstAllowed) setReactSelectValue(select, firstAllowed.value);
        }
      }
    }

    const { data: allAtis } = await supabase.from("atis_messages").select("id,airport_icao");
    const globallyInvalidIds = (allAtis ?? [])
      .filter((row) => !ATIS_AIRPORTS.has(String(row.airport_icao ?? "").toUpperCase()))
      .map((row) => row.id)
      .filter(Boolean);
    if (globallyInvalidIds.length) {
      await supabase.from("atis_messages").delete().in("id", globallyInvalidIds);
    }

    const { data } = await supabase
      .from("atis_messages")
      .select("id,airport_icao")
      .eq("created_by", controllerName);
    const unauthorizedIds = (data ?? [])
      .filter((row) => !allowed.has(String(row.airport_icao ?? "").toUpperCase()))
      .map((row) => row.id)
      .filter(Boolean);
    if (unauthorizedIds.length) {
      await supabase.from("atis_messages").delete().in("id", unauthorizedIds);
    }
  }, [controllerName, position]);

  useEffect(() => {
    const initial = readPosition();
    setPosition(initial);
    void enforce(initial);

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const next = detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "";
      setPosition(next);
      void enforce(next);
    };

    const onUi = () => {
      window.setTimeout(() => void enforce(position || readPosition()), 0);
      window.setTimeout(() => void enforce(position || readPosition()), 80);
    };

    const blockUnauthorized = (event: MouseEvent) => {
      const dialog = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-pf24-atis-dialog='true']") : null;
      if (!dialog) return;
      const select = airportSelect(dialog);
      const selected = select?.value?.toUpperCase() ?? "";
      if (!selected) return;
      const allowed = jurisdiction(position || readPosition());
      if (ATIS_AIRPORTS.has(selected) && allowed.has(selected)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    window.addEventListener("pf24-scope-connection-change", onConnection);
    document.addEventListener("click", onUi, true);
    document.addEventListener("click", blockUnauthorized, true);

    return () => {
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      document.removeEventListener("click", onUi, true);
      document.removeEventListener("click", blockUnauthorized, true);
    };
  }, [enforce, position]);

  return null;
}
