"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function ScopeWeatherAtisLetters() {
  const lettersRef = useRef<Record<string, string>>({});

  const applyLetters = useCallback(() => {
    const weather = document.querySelector<HTMLElement>("[data-pf24-weather-window='true']");
    if (!weather) return;

    for (const row of Array.from(weather.querySelectorAll<HTMLElement>("div"))) {
      const spans = Array.from(row.querySelectorAll<HTMLSpanElement>(":scope > span"));
      if (spans.length < 2) continue;
      const station = spans[1]?.textContent?.trim().toUpperCase() ?? "";
      if (!/^[A-Z0-9]{4}$/.test(station) || !spans[0]) continue;
      spans[0].textContent = lettersRef.current[station] ?? "-";
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("atis_messages")
      .select("airport_icao,info_letter,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("PF24 Scope ATIS letter load failed:", error);
      return;
    }

    const next: Record<string, string> = {};
    for (const row of data ?? []) {
      if (!next[row.airport_icao]) next[row.airport_icao] = row.info_letter;
    }
    lettersRef.current = next;
    applyLetters();
  }, [applyLetters]);

  useEffect(() => {
    void refresh();
    const scope = document.querySelector<HTMLElement>("main.fixed");
    const observer = new MutationObserver(() => applyLetters());
    if (scope) observer.observe(scope, { subtree: true, childList: true, characterData: true });

    const channel = supabase
      .channel("scope-weather-atis-letters")
      .on("postgres_changes", { event: "*", schema: "public", table: "atis_messages" }, () => void refresh())
      .subscribe();

    const onToggle = () => window.setTimeout(applyLetters, 0);
    window.addEventListener("pf24-weather-toggle", onToggle);

    return () => {
      observer.disconnect();
      supabase.removeChannel(channel);
      window.removeEventListener("pf24-weather-toggle", onToggle);
    };
  }, [applyLetters, refresh]);

  return null;
}
