"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminDeleteAtis } from "@/app/actions/adminMaintenance";

type AtisMessage = {
  id: string;
  airport_icao: string;
  info_letter: string;
  created_by: string | null;
  created_at: string;
};

export default function AdminActiveAtis({
  initialAtis,
}: {
  initialAtis: AtisMessage[];
}) {
  const [atisList, setAtisList] = useState(initialAtis);

  async function loadAtis() {
    const { data, error } = await supabase
      .from("atis_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setAtisList(data ?? []);
  }

  useEffect(() => {
    loadAtis();

    const channel = supabase
      .channel("admin-active-atis")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atis_messages" },
        () => {
          loadAtis();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="panel mt-8 rounded-3xl p-6">
      <h2 className="text-2xl font-bold text-sky-300">ATIS activos</h2>

      <div className="mt-5 grid gap-3">
        {atisList.length ? (
          atisList.map((atis) => (
            <div
              key={atis.id}
              className="rounded-2xl border border-white/10 bg-[#020617] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mono font-bold text-sky-300">
                    {atis.airport_icao} INFO {atis.info_letter}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Publicado por: {atis.created_by ?? "Sector desconocido"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(atis.created_at)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}
                    Z
                  </p>
                </div>

                <button
                  onClick={async () => {
                    const confirmed = confirm(
                      `¿Eliminar ATIS ${atis.airport_icao} INFO ${atis.info_letter}?`
                    );

                    if (!confirmed) return;

                    await adminDeleteAtis(
                      atis.id,
                      `${atis.airport_icao} INFO ${atis.info_letter}`
                    );

                    await loadAtis();
                  }}
                  className="rounded-xl border border-red-400 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500 hover:text-white"
                >
                  Eliminar ATIS
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-400">No hay ATIS activos.</p>
        )}
      </div>
    </section>
  );
}