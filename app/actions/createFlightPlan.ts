"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function createFlightPlan(formData: FormData) {
  const callsign = String(formData.get("callsign") ?? "").toUpperCase().trim();
  const aircraftType = String(formData.get("aircraftType") ?? "");
  const flightRules = String(formData.get("flightRules") ?? "");
  const departure = String(formData.get("departure") ?? "");
  const arrival = String(formData.get("arrival") ?? "");
  const route = String(formData.get("route") ?? "").toUpperCase().trim();
  const flightLevel = String(formData.get("flightLevel") ?? "").toUpperCase().trim();
  const notes = String(formData.get("notes") ?? "");

  const { data: existing } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("callsign", callsign)
    .neq("status", "FINISHED")
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("Callsign ya está en uso");
  }

  const { error } = await supabase.from("flight_plans").insert({
    callsign,
    aircraft_type: aircraftType,
    flight_rules: flightRules,
    departure_icao: departure,
    arrival_icao: arrival,
    route,
    flight_level: flightLevel,
    notes,
    transponder: flightRules === "VFR" ? "7000" : "2000",
  });

  if (error) {
    console.error(error);
    throw new Error("No se pudo crear el plan de vuelo");
  }

  revalidatePath("/piloto");
  revalidatePath("/atc");
}