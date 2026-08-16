"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildAtisText } from "@/lib/buildAtis";

const AIRPORTS = ["MDPC", "MDST", "LCLK", "LCPH", "LEMH", "GCLP", "EGKK", "EGHI", "EFKT"];

function nextInfoLetter(last?: string) {
  if (!last) return "A";
  const code = last.charCodeAt(0);
  if (code >= 90) return "A";
  return String.fromCharCode(code + 1);
}

export default function AtisCreator({ controllerPosition }: { controllerPosition: string }) {
  const [airport, setAirport] = useState("MDPC");
  const [infoLetter, setInfoLetter] = useState("A");
  const [approachPrimary, setApproachPrimary] = useState("ILS");
  const [approachOptional, setApproachOptional] = useState("");
  const [departureRunway, setDepartureRunway] = useState("");
  const [arrivalRunway, setArrivalRunway] = useState("");
  const [transitionAltitude, setTransitionAltitude] = useState("");
  const [transitionLevel, setTransitionLevel] = useState("");
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
    const departure = departureRunway.trim().toUpperCase();
    const arrival = arrivalRunway.trim().toUpperCase();
    const transAlt = transitionAltitude.trim();
    const transLvl = transitionLevel.trim().replace(/^FL/i, "").padStart(3, "0");
    const extraInfoFormatted = extraInfo.trim().toUpperCase();
    const remarksFormatted = remarks.trim().toUpperCase();

    if (!departure || !arrival) {
      alert("Debes ingresar la pista de salida y la pista de llegada.");
      return;
    }

    if (!/^\d{1,5}$/.test(transAlt) || !/^\d{3}$/.test(transLvl)) {
      alert("Debes ingresar Trans Alt y Trans Lvl válidos. Ejemplo: 3000 y 040.");
      return;
    }

    // Los valores se guardan redundantes en extra_info y runway. El bot recibe
    // runway de forma fiable en Realtime y así no pierde Trans Alt / Trans Lvl.
    const transitionMetadata = `[TRANS_ALT=${transAlt}][TRANS_LVL=${transLvl}]`;
    const runwayFormatted = `DEP ${departure} | ARR ${arrival} ${transitionMetadata}`;
    const storedExtraInfo = extraInfoFormatted
      ? `${transitionMetadata} ${extraInfoFormatted}`
      : transitionMetadata;

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
        departureRunway: departure,
        arrivalRunway: arrival,
        transitionAltitude: transAlt,
        transitionLevel: transLvl,
        extraInfo: extraInfoFormatted,
        remarks: remarksFormatted,
      });

      const { error } = await supabase.from("atis_messages").insert({
        airport_icao: airport,
        info_letter: infoLetter,
        metar,
        approach_primary: approachPrimary,
        approach_optional: approachOptional || null,
        runway: runwayFormatted,
        extra_info: storedExtraInfo,
        remarks: remarksFormatted || null,
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
      setDepartureRunway("");
      setArrivalRunway("");
      setExtraInfo("");
      setRemarks("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <h2 className="text-2xl font-extrabold">ATIS</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <select value={airport} onChange={(e) => setAirport(e.target.value)} className="rounded-xl bg-slate-800 p-3">
          {AIRPORTS.map((item) => <option key={item}>{item}</option>)}
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

        <input
          value={departureRunway}
          onChange={(e) => setDepartureRunway(e.target.value.toUpperCase())}
          placeholder="Pista de salida, ej: 08"
          className="rounded-xl bg-slate-800 p-3 uppercase"
        />

        <input
          value={arrivalRunway}
          onChange={(e) => setArrivalRunway(e.target.value.toUpperCase())}
          placeholder="Pista de llegada, ej: 09"
          className="rounded-xl bg-slate-800 p-3 uppercase"
        />

        <input
          value={transitionAltitude}
          onChange={(e) => setTransitionAltitude(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          placeholder="Trans Alt, ej: 3000"
          className="rounded-xl bg-slate-800 p-3"
        />

        <input
          value={transitionLevel}
          onChange={(e) => setTransitionLevel(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric"
          placeholder="Trans Lvl, ej: 040"
          className="rounded-xl bg-slate-800 p-3"
        />

        <input
          value={extraInfo}
          onChange={(e) => setExtraInfo(e.target.value.toUpperCase())}
          placeholder="Información adicional"
          className="rounded-xl bg-slate-800 p-3 uppercase md:col-span-2"
        />
      </div>

      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value.toUpperCase())}
        placeholder="RMK"
        className="mt-4 w-full rounded-xl bg-slate-800 p-3 uppercase"
      />

      <button
        onClick={publishAtis}
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-sky-500 p-3 font-semibold hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Publicando..." : "Publicar ATIS"}
      </button>
    </div>
  );
}
