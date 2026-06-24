"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildAtisText } from "@/lib/buildAtis";

const AIRPORTS = ["MDPC", "MDST", "MDAB", "LCLK", "LCPH", "LCRA", "EGKK", "EGHI", "LEMH", "GCLP", "EFKT"];

function nextInfoLetter(last?: string) {
  if (!last) return "A";
  const code = last.charCodeAt(0);
  if (code >= 90) return "A";
  return String.fromCharCode(code + 1);
}

export default function AtisCreator({
  controllerPosition,
}: {
  controllerPosition: string;
}) {
  const [airport, setAirport] = useState("MDPC");
  const [infoLetter, setInfoLetter] = useState("A");
  const [approachPrimary, setApproachPrimary] = useState("ILS");
  const [approachOptional, setApproachOptional] = useState("");
  const [runway, setRunway] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadNextInfo() {
      const { data } = await supabase
        .from("atis_messages")
        .select("info_letter")
        .eq("airport_icao", airport)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setInfoLetter(nextInfoLetter(data?.info_letter));
    }

    loadNextInfo();
  }, [airport]);

  async function publishAtis() {
    if (!runway.trim()) {
      alert("Debes ingresar una pista.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/metar?icao=${airport}`);
      const metarData = await response.json();
      const metar = metarData.metar ?? "METAR NO DISPONIBLE";

      const fullText = buildAtisText({
        airport,
        info: infoLetter,
        metar,
        approachPrimary,
        approachOptional,
        runway,
        extraInfo,
        remarks,
      });

      const { error } = await supabase.from("atis_messages").insert({
        airport_icao: airport,
        info_letter: infoLetter,
        metar,
        approach_primary: approachPrimary,
        approach_optional: approachOptional || null,
        runway,
        extra_info: extraInfo || null,
        remarks: remarks || null,
        full_text: fullText,
        created_by: controllerPosition,
      });

      if (error) {
        console.error(error);
        alert("No se pudo publicar el ATIS.");
        return;
      }

      alert(`ATIS ${airport} INFO ${infoLetter} publicado.`);
      setInfoLetter(nextInfoLetter(infoLetter));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <h2 className="text-2xl font-extrabold">ATIS</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <select value={airport} onChange={(e) => setAirport(e.target.value)} className="rounded-xl bg-slate-800 p-3">
          {AIRPORTS.map((airport) => (
            <option key={airport}>{airport}</option>
          ))}
        </select>

        <input value={`INFO ${infoLetter}`} disabled className="rounded-xl bg-slate-800 p-3 opacity-70" />

        <select value={approachPrimary} onChange={(e) => setApproachPrimary(e.target.value)} className="rounded-xl bg-slate-800 p-3">
          <option value="ILS">ILS</option>
          <option value="RNP">RNP</option>
          <option value="VISUAL">VISUAL</option>
        </select>

        <select value={approachOptional} onChange={(e) => setApproachOptional(e.target.value)} className="rounded-xl bg-slate-800 p-3">
          <option value="">Sin opcional</option>
          <option value="ILS">ILS</option>
          <option value="RNP">RNP</option>
          <option value="VISUAL">VISUAL</option>
        </select>

        <input value={runway} onChange={(e) => setRunway(e.target.value.toUpperCase())} placeholder="Pista, ej: 08" className="rounded-xl bg-slate-800 p-3" />

        <input value={extraInfo} onChange={(e) => setExtraInfo(e.target.value)} placeholder="Información adicional" className="rounded-xl bg-slate-800 p-3" />
      </div>

      <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="RMK" className="mt-4 w-full rounded-xl bg-slate-800 p-3" />

      <button onClick={publishAtis} disabled={loading} className="mt-4 w-full rounded-xl bg-sky-500 p-3 font-semibold hover:bg-sky-400">
        {loading ? "Publicando..." : "Publicar ATIS"}
      </button>
    </div>
  );
}