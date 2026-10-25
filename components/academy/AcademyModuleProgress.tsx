"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ProgressResponse = {
  ok: boolean;
  changed?: boolean;
};

export default function AcademyModuleProgress({
  endpoint,
  moduleNumber,
  evaluationModule,
}: {
  endpoint: string;
  moduleNumber: number;
  evaluationModule: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (moduleNumber < 1 || moduleNumber >= evaluationModule) return;

    let active = true;

    void fetch(endpoint, {
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
        // El progreso no debe impedir que el alumno lea el módulo.
      });

    return () => {
      active = false;
    };
  }, [endpoint, evaluationModule, moduleNumber, router]);

  return null;
}
