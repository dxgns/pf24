"use client";

import { useEffect } from "react";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readSeenModules(cookieName: string) {
  const prefix = `${encodeURIComponent(cookieName)}=`;
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  if (!raw) return new Set<number>();

  return new Set(
    decodeURIComponent(raw)
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
}

export default function AtcModuleProgress({ cookieName, moduleNumber }: { cookieName: string; moduleNumber: number }) {
  useEffect(() => {
    const seen = readSeenModules(cookieName);
    if (seen.has(moduleNumber)) return;

    seen.add(moduleNumber);
    const value = Array.from(seen).sort((a, b) => a - b).join(",");
    document.cookie = `${encodeURIComponent(cookieName)}=${encodeURIComponent(value)}; Path=/academia/atc; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [cookieName, moduleNumber]);

  return null;
}
