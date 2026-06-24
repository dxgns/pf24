"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AtisMessage = {
  id: string;
  airport_icao: string;
  info_letter: string;
  metar: string;
  approach_primary: string;
  approach_optional: string | null;
  runway: string;
  extra_info: string | null;
  remarks: string | null;
  full_text: string;
  created_by: string | null;
  created_at: string;
};

export default function LatestAtisPanel({
  showAlerts = true,
}: {
  showAlerts?: boolean;
}) {
  const [atis, setAtis] = useState<AtisMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [alertAtis, setAlertAtis] = useState<AtisMessage | null>(null);

  function playAtisUpdateAlarm() {
    try {
        const audio = new AudioContext();
        const start = audio.currentTime;

        for (let i = 0; i < 5; i++) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();

        osc.connect(gain);
        gain.connect(audio.destination);

        osc.type = "sine";
        osc.frequency.value = i % 2 === 0 ? 720 : 520;

        const t = start + i * 0.32;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.07, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

        osc.start(t);
        osc.stop(t + 0.22);
        }
    } catch {}
    }

  useEffect(() => {
    async function loadInitialAtis() {
      const { data, error } = await supabase
        .from("atis_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      const latestByAirport = Object.values(
        (data ?? []).reduce<Record<string, AtisMessage>>((acc, item) => {
          if (!acc[item.airport_icao]) {
            acc[item.airport_icao] = item;
          }

          return acc;
        }, {})
      );

      setAtis(latestByAirport.slice(0, 8));
    }

    loadInitialAtis();

    const channel = supabase
      .channel("latest-atis-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "atis_messages" },
        (payload) => {
          const newAtis = payload.new as AtisMessage;

            if (showAlerts) {
            setAlertAtis(newAtis);
            playAtisUpdateAlarm();
            }

            setAtis((current) => {
            const withoutSameAirport = current.filter(
              (item) => item.airport_icao !== newAtis.airport_icao
            );

            return [newAtis, ...withoutSameAirport].slice(0, 8);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (atis.length === 0) {
    return (
      <div className="panel mt-6 rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-sky-300">Últimos ATIS</h2>
        <p className="mt-4 text-slate-400">No hay ATIS publicados todavía.</p>
      </div>
    );
  }

  return (
    <div className="panel mt-6 rounded-3xl p-6">
      <h2 className="text-2xl font-bold text-sky-300">Últimos ATIS</h2>

      <div className="mt-5 grid gap-3">
        {atis.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/10 bg-[#020617] p-4"
          >
            <button
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="mono font-bold text-sky-300">
                  {item.airport_icao} INFO {item.info_letter}
                </p>

                <span className="text-xs text-slate-500">
                  {new Date(item.created_at).toISOString().slice(11, 16)}Z
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                RWY {item.runway} · APPR {item.approach_primary}
                {item.approach_optional ? ` / ${item.approach_optional}` : ""}
              </p>
            </button>

            {openId === item.id && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-4">
                <p className="mono text-xs text-slate-500">METAR</p>
                <p className="mt-1 text-sm text-slate-300">{item.metar}</p>

                <p className="mono mt-4 text-xs text-slate-500">
                  ATIS COMPLETO
                </p>
                <p className="mt-1 text-sm leading-7 text-slate-200">
                  {item.full_text}
                </p>

                <p className="mt-4 text-xs text-slate-500">
                  Publicado por: {item.created_by ?? "Sector desconocido"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

        {alertAtis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
            <div className="max-w-lg rounded-3xl border border-sky-400 bg-slate-950 p-8 text-center shadow-2xl">
            <p className="mono text-sm uppercase tracking-[0.3em] text-sky-300">
                ATIS actualizado
            </p>

            <h2 className="mt-4 text-3xl font-extrabold text-white">
                {alertAtis.airport_icao} INFO {alertAtis.info_letter}
            </h2>

            <p className="mt-4 text-slate-300">
                Se publicó una nueva información ATIS.
            </p>

            <p className="mt-4 rounded-xl border border-white/10 bg-[#020617] p-4 text-sm leading-6 text-slate-300">
                {alertAtis.full_text}
            </p>

            <button
                onClick={() => setAlertAtis(null)}
                className="mt-8 rounded-xl bg-sky-500 px-6 py-3 font-bold text-white hover:bg-sky-400"
            >
                Entendido
            </button>
            </div>
        </div>
        )}

    </div>
  );
}