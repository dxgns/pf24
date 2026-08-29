"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { scopeIsSweatbox } from "@/lib/scope/sweatbox";

const ATIS_CONFIG_STORAGE_KEY = "pf24_scope_atis_configs_v1";

type AirportConfig = {
  active?: boolean;
  dep?: string;
  arr?: string;
  approach?: string;
  remarks?: string;
};

type ConfigMap = Record<string, AirportConfig>;

function deactivateAllLocalAtis() {
  try {
    const configs = JSON.parse(localStorage.getItem(ATIS_CONFIG_STORAGE_KEY) ?? "{}") as ConfigMap;
    const next: ConfigMap = {};
    for (const [icao, config] of Object.entries(configs)) next[icao] = { ...config, active: false };
    localStorage.setItem(ATIS_CONFIG_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("pf24-atis-config-sync"));
  } catch {}
}

export default function ScopeAtisDisconnectCleanup({ controllerName }: { controllerName: string }) {
  useEffect(() => {
    const onDisconnect = async () => {
      // Training ATIS never lives in atis_messages, so a SweatBox disconnect must
      // not remove the controller's live-network ATIS from another Scope session.
      if (scopeIsSweatbox()) return;
      deactivateAllLocalAtis();
      const { error } = await supabase.from("atis_messages").delete().eq("created_by", controllerName);
      if (error) console.error("PF24 Scope owned ATIS cleanup failed:", error);
    };

    window.addEventListener("pf24-scope-explicit-disconnect", onDisconnect);
    return () => window.removeEventListener("pf24-scope-explicit-disconnect", onDisconnect);
  }, [controllerName]);

  return null;
}
