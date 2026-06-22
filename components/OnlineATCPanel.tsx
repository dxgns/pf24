"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ATCSession = {
  id: string;
  controller_name: string;
  position: string;
  started_at: string;
  is_active: boolean;
};

export default function OnlineATCPanel({
  initialSessions,
}: {
  initialSessions: ATCSession[];
}) {
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    const channel = supabase
      .channel("online-atc-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atc_sessions" },
        async () => {
          const { data } = await supabase
            .from("atc_sessions")
            .select("*")
            .eq("is_active", true)
            .order("started_at", { ascending: false });

          setSessions(data ?? []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="panel rounded-3xl p-6">
      <h2 className="text-2xl font-bold text-sky-300">ATCs Online</h2>

      {sessions.length === 0 ? (
        <p className="mt-4 text-slate-400">
          No hay controladores conectados actualmente.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-2xl border border-white/10 bg-[#020617] p-4"
            >
              <p className="mono font-bold text-sky-300">
                {session.position}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Controlador: {session.controller_name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}