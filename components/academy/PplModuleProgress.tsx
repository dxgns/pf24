"use client";

import { useEffect } from "react";
import { PPL_MODULES, PPL_PROGRESS_COOKIE } from "@/lib/academy/pplModules";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readSeenModules() {
  const prefix = `${encodeURIComponent(PPL_PROGRESS_COOKIE)}=`;
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  if (!raw) return new Set<number>();

  return new Set(
    decodeURIComponent(raw)
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= PPL_MODULES.length),
  );
}

export default function PplModuleProgress({ moduleNumber }: { moduleNumber: number }) {
  useEffect(() => {
    const seen = readSeenModules();
    if (seen.has(moduleNumber)) return;

    seen.add(moduleNumber);
    const value = Array.from(seen).sort((a, b) => a - b).join(",");
    document.cookie = `${encodeURIComponent(PPL_PROGRESS_COOKIE)}=${encodeURIComponent(value)}; Path=/academia/piloto; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [moduleNumber]);

  return null;
}
