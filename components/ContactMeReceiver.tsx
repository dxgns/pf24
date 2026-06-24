"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ContactMessage = {
  id: string;
  pilot_id: string;
  callsign: string;
  message: string;
  acknowledged: boolean;
};

export default function ContactMeReceiver({ pilotId }: { pilotId: string }) {
  const [message, setMessage] = useState<ContactMessage | null>(null);

  function playContactAlarm() {
    try {
      const ctx = new AudioContext();
      const start = ctx.currentTime;

      for (let cycle = 0; cycle < 3; cycle++) {
        const base = start + cycle * 0.8;

        [1000, 650, 1000, 650].forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = "square";
          osc.frequency.value = freq;

          const t = base + index * 0.15;

          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.20, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

          osc.start(t);
          osc.stop(t + 0.12);
        });
      }
    } catch {}
  }

  useEffect(() => {
    const channel = supabase
      .channel("pilot-contact-me")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages" },
        (payload) => {
          const newMessage = payload.new as ContactMessage;

          if (newMessage.pilot_id !== pilotId) return;

          setMessage(newMessage);
          playContactAlarm();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pilotId]);

  async function acknowledge() {
    if (!message) return;

    await supabase
      .from("contact_messages")
      .update({ acknowledged: true })
      .eq("id", message.id);

    setMessage(null);
  }

  if (!message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="max-w-lg rounded-3xl border border-green-400 bg-slate-950 p-8 text-center shadow-2xl">
        <p className="mono text-sm uppercase tracking-[0.3em] text-green-300">
          Contact Me
        </p>

        <h2 className="mt-4 text-3xl font-extrabold text-white">
          {message.callsign}
        </h2>

        <p className="mt-6 text-xl font-bold text-green-300">
          {message.message}
        </p>

        <button
          onClick={acknowledge}
          className="mt-8 rounded-xl bg-green-500 px-6 py-3 font-bold text-white hover:bg-green-400"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}