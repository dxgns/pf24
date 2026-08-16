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
type PublishedAtis = { airport_icao: string; created_by: string | null; created_at: string };

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

  // ATIS is airport-local: only that airport's APP or TWR may create/update it.
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
    if (!config?.active || allowed.has(upper)) continue;
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

function findAtisDialog() {
  return document.querySelector<HTMLElement>("[data-pf24-atis-dialog='true']");
}

function latestPublishedByAirport(rows: PublishedAtis[]) {
  const latest = new Map<string, PublishedAtis>();
  for (const row of rows) {
    const airport = String(row.airport_icao ?? "").trim().toUpperCase();
    if (!airport || !ATIS_AIRPORTS.has(airport)) continue;
    const current = latest.get(airport);
    if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
      latest.set(airport, { ...row, airport_icao: airport });
    }
  }
  return latest;
}

async function loadPublished() {
  const { data, error } = await supabase
    .from("atis_messages")
    .select("airport_icao,created_by,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("PF24 ATIS publication state lookup failed:", error);
    return new Map<string, PublishedAtis>();
  }

  return latestPublishedByAirport((data ?? []) as PublishedAtis[]);
}

function setDialogLocked(dialog: HTMLElement, locked: boolean) {
  dialog.dataset.pf24AtisLockedByOther = locked ? "true" : "false";

  dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea").forEach((field) => {
    field.disabled = locked;
    field.setAttribute("aria-disabled", locked ? "true" : "false");
  });
}

function setSendVisibility(dialog: HTMLElement, visible: boolean) {
  const send = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim().toUpperCase() === "SEND",
  );
  if (!send) return;

  send.style.display = visible ? "" : "none";
  send.disabled = !visible;
  send.setAttribute("aria-hidden", visible ? "false" : "true");
}

export default function ScopeAtisJurisdictionGuard({ controllerName }: { controllerName: string }) {
  const [position, setPosition] = useState("");

  const enforce = useCallback(async (nextPosition = position) => {
    const currentPosition = nextPosition || readPosition();
    const allowed = jurisdiction(currentPosition);
    disableUnauthorizedConfigs(allowed);

    const dialog = findAtisDialog();
    const published = await loadPublished();

    if (dialog) {
      const select = airportSelect(dialog);
      if (select) {
        Array.from(select.options).forEach((option) => {
          const icao = option.value.trim().toUpperCase();
          const enabled = ATIS_AIRPORTS.has(icao) && allowed.has(icao);
          option.disabled = !enabled;
          option.hidden = !enabled;
        });

        if (!allowed.has(select.value.trim().toUpperCase())) {
          const firstAllowed = Array.from(select.options).find((option) => {
            const icao = option.value.trim().toUpperCase();
            return ATIS_AIRPORTS.has(icao) && allowed.has(icao);
          });
          if (firstAllowed) setReactSelectValue(select, firstAllowed.value);
        }
      }

      const selected = select?.value?.trim().toUpperCase() ?? "";
      const owner = selected ? published.get(selected)?.created_by?.trim() ?? "" : "";
      const lockedByOther = Boolean(selected && owner && owner !== controllerName);
      const unauthorized = !selected || !allowed.has(selected);

      setDialogLocked(dialog, lockedByOther || unauthorized);
      setSendVisibility(dialog, !lockedByOther && !unauthorized);
    }

    // Remove stale/invalid ATIS publications owned by this controller. Never touch another controller's valid ATIS.
    const { data: ownAtis } = await supabase
      .from("atis_messages")
      .select("id,airport_icao")
      .eq("created_by", controllerName);

    const unauthorizedIds = (ownAtis ?? [])
      .filter((row) => !allowed.has(String(row.airport_icao ?? "").trim().toUpperCase()))
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

    const schedule = () => {
      window.setTimeout(() => void enforce(position || readPosition()), 0);
      window.setTimeout(() => void enforce(position || readPosition()), 100);
      window.setTimeout(() => void enforce(position || readPosition()), 350);
    };

    const blockUnauthorizedSend = async (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const dialog = target?.closest<HTMLElement>("[data-pf24-atis-dialog='true']");
      if (!dialog) return;

      const button = target?.closest<HTMLButtonElement>("button");
      if (button?.textContent?.trim().toUpperCase() !== "SEND") return;

      const selected = airportSelect(dialog)?.value?.trim().toUpperCase() ?? "";
      const allowed = jurisdiction(position || readPosition());
      const published = await loadPublished();
      const owner = selected ? published.get(selected)?.created_by?.trim() ?? "" : "";

      if (selected && allowed.has(selected) && (!owner || owner === controllerName)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setSendVisibility(dialog, false);
      setDialogLocked(dialog, true);
    };

    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true });

    const channel = supabase
      .channel("scope-atis-jurisdiction-v4")
      .on("postgres_changes", { event: "*", schema: "public", table: "atis_messages" }, schedule)
      .subscribe();

    const refreshTimer = window.setInterval(schedule, 1200);

    window.addEventListener("pf24-scope-connection-change", onConnection);
    document.addEventListener("click", schedule, true);
    document.addEventListener("click", blockUnauthorizedSend, true);

    return () => {
      observer.disconnect();
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
      document.removeEventListener("click", schedule, true);
      document.removeEventListener("click", blockUnauthorizedSend, true);
    };
  }, [enforce, position, controllerName]);

  return null;
}
