"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminEndAtcSession } from "@/app/actions/adminMaintenance";

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
};

export default function AdminATCSessions({
  initialSessions,
}: {
  initialSessions: ATCSession[];
}) {
  const [sessions, setSessions] = useState(initialSessions);

  async function loadSessions() {
    const { data, error } = await supabase
      .from("atc_sessions")
      .select("*")
      .eq("is_active", true)
      .order("started_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setSessions(data ?? []);
  }

  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel("admin-atc-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atc_sessions" },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="panel rounded-3xl p-6">
      <h2 className="text-2xl font-bold text-sky-300">
        ATCs conectados
      </h2>

      <div className="mt-5 grid gap-3">
        {sessions.length ? (
          sessions.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-[#020617] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mono font-bold text-sky-300">
                    {item.position}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Controlador: {item.controller_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Inicio: {new Date(item.started_at).toISOString().slice(11, 19)}Z
                  </p>
                </div>

                <button
                  onClick={async () => {
                    const confirmed = confirm(
                      `¿Finalizar sesión ${item.position}?`
                    );

                    if (!confirmed) return;

                    await adminEndAtcSession(item.id, item.position);
                    await loadSessions();
                  }}
                  className="rounded-xl border border-red-400 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500 hover:text-white"
                >
                  Finalizar sesión
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-400">
            No hay sesiones ATC activas.
          </p>
        )}
      </div>
    </section>
  );
}