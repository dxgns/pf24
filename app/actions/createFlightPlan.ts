"use server";

import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function createFlightPlan(formData: FormData) {
  const session = await auth();

  if (!session) {
    throw new Error("No autenticado");
  }

  const pilotId = session.user?.email ?? session.user?.name ?? "unknown";

  const callsign = String(formData.get("callsign") ?? "")
    .toUpperCase()
    .trim();

  const aircraftType = String(formData.get("aircraftType") ?? "");
  const flightRules = String(formData.get("flightRules") ?? "");

  const departure = String(formData.get("departure") ?? "")
    .toUpperCase()
    .trim();

  const arrival = String(formData.get("arrival") ?? "")
    .toUpperCase()
    .trim();

  const route = String(formData.get("route") ?? "")
    .toUpperCase()
    .trim();

  const flightLevel = String(formData.get("flightLevel") ?? "")
    .replace(/\D/g, "")
    .slice(0, 3);

  const notes = String(formData.get("notes") ?? "");

  if (!callsign || !aircraftType || !flightRules || !departure || !arrival || !route || !flightLevel) {
    throw new Error("Faltan datos obligatorios");
  }

  if (flightLevel.length > 3) {
    throw new Error("El FL debe tener máximo 3 números");
  }

  const { data: activePilotFlights, error: activeError } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("created_by", pilotId)
    .neq("status", "FINISHED")
    .limit(1);

  if (activeError) {
    console.error(activeError);
    throw new Error("No se pudo verificar vuelos activos");
  }

  if (activePilotFlights && activePilotFlights.length > 0) {
    throw new Error("Ya tienes un vuelo activo. Finalízalo antes de crear otro.");
  }

  const { data: existingCallsign, error: callsignError } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("callsign", callsign)
    .neq("status", "FINISHED")
    .limit(1);

  if (callsignError) {
    console.error(callsignError);
    throw new Error("No se pudo verificar el callsign");
  }

  if (existingCallsign && existingCallsign.length > 0) {
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
    created_by: pilotId,
    transponder: flightRules === "VFR" ? "7000" : "2000",
    status: "PENDING",
    sector_status: "STUP",
  });

  if (error) {
    console.error(error);
    throw new Error("No se pudo crear el plan de vuelo");
  }

  revalidatePath("/piloto");
  revalidatePath("/atc");
}