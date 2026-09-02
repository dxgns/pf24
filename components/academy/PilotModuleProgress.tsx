"use client";

import { useEffect } from "react";
import { PE_MODULES, PILOT_PROGRESS_COOKIE } from "@/lib/academy/pilotModules";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readSeenModules() {
  const prefix = `${encodeURIComponent(PILOT_PROGRESS_COOKIE)}=`;
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  if (!raw) return new Set<number>();

  return new Set(
    decodeURIComponent(raw)
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= PE_MODULES.length),
  );
}

export default function PilotModuleProgress({ moduleNumber }: { moduleNumber: number }) {
  useEffect(() => {
    const seen = readSeenModules();
    if (seen.has(moduleNumber)) return;

    seen.add(moduleNumber);
    const value = Array.from(seen).sort((a, b) => a - b).join(",");
    document.cookie = `${encodeURIComponent(PILOT_PROGRESS_COOKIE)}=${encodeURIComponent(value)}; Path=/academia/piloto; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [moduleNumber]);

  return null;
}
