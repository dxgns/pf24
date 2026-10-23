"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PILOT_EVALUATION_MODULE } from "@/lib/academy/pilotModules";

type ProgressResponse = {
  ok: boolean;
  changed?: boolean;
};

export default function PilotModuleProgress({ moduleNumber }: { moduleNumber: number }) {
  const router = useRouter();

  useEffect(() => {
    if (moduleNumber < 1 || moduleNumber >= PILOT_EVALUATION_MODULE) return;

    let active = true;

    void fetch("/academia/piloto/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleNumber }),
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<ProgressResponse>;
      })
      .then((result) => {
        if (active && result?.ok && result.changed) router.refresh();
      })
      .catch(() => {
        // Progress is non-critical UI state; keep the module usable if saving fails.
      });

    return () => {
      active = false;
    };
  }, [moduleNumber, router]);

  return null;
}
