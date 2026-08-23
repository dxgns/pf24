"use server";

import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { getDefaultTransponder } from "@/lib/flightRules";
import { normalizeGameCallsign, setGameCallsignInNotes } from "@/lib/flightPlanGameCallsign";

type CreateFlightPlanResult = {
  ok: boolean;
  error?: string;
};

export async function createFlightPlan(
  formData: FormData
): Promise<CreateFlightPlanResult> {
  const session = await auth();

  if (!session) {
    return {
      ok: false,
      error: "Debes iniciar sesión para crear un plan de vuelo.",
    };
  }

  const pilotId = session.user?.email ?? session.user?.name ?? "unknown";

  const callsign = normalizeGameCallsign(String(formData.get("callsign") ?? ""));
  const gameCallsign = normalizeGameCallsign(String(formData.get("gameCallsign") ?? callsign)) || callsign;

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
    .replace(/\s+/g, " ")
    .trim();

  const flightLevel = String(formData.get("flightLevel") ?? "")
    .replace(/\D/g, "")
    .slice(0, 3);

  const visibleNotes = String(formData.get("notes") ?? "");
  const notes = setGameCallsignInNotes(visibleNotes, gameCallsign);

  if (
    !callsign ||
    !gameCallsign ||
    !aircraftType ||
    !flightRules ||
    !departure ||
    !arrival ||
    !route ||
    !flightLevel
  ) {
    return {
      ok: false,
      error: "Faltan datos obligatorios en el plan de vuelo.",
    };
  }

  if (callsign.length < 2 || gameCallsign.length < 2) {
    return {
      ok: false,
      error: "Los callsigns deben tener al menos 2 caracteres.",
    };
  }

  if (callsign.length > 12 || gameCallsign.length > 12) {
    return {
      ok: false,
      error: "Los callsigns no pueden superar los 12 caracteres.",
    };
  }

  if (flightLevel.length < 1 || flightLevel.length > 3) {
    return {
      ok: false,
      error: "El FL debe tener entre 1 y 3 números.",
    };
  }

  const forbiddenRouteWords = [
    "GPS", "DIRECT", "DIRECTO", "DIR", "AUTO", "AUTOMATIC", "AUTOMATICA",
    "AUTOMÁTICA", "RANDOM", "ANY", "ANYWHERE", "NA", "N/A", "NONE", "NULL",
    "TEST", "PRUEBA", "ASD", "QWE", "ABC", "XXX", "TBD", "TBA", "NO", "SIN",
    "SINRUTA", "NO ROUTE", "NO PLAN", "FREE", "FREE ROUTE", "VFR", "IFR", "RUTA", "ROUTE",
  ];

  const forbiddenRouteCharacters = /[.,;:!¡?¿'"`´¨^~_\-–—/\\|()[\]{}<>+=*@#$%&]/;

  if (forbiddenRouteCharacters.test(route)) {
    return {
      ok: false,
      error: "La ruta solo puede contener letras, números y espacios. No uses puntos, guiones, barras ni símbolos.",
    };
  }

  const routeWords = route.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const onlyDctOrGps = routeWords.length > 0 && routeWords.every((word) => word === "DCT" || word === "GPS");

  if (onlyDctOrGps) {
    return { ok: false, error: "La ruta no puede estar compuesta solo por GPS y/o DCT. Ingresa puntos de ruta válidos." };
  }

  if (routeWords.some((word) => forbiddenRouteWords.includes(word))) {
    return { ok: false, error: "La ruta contiene palabras no válidas como GPS, DIRECT, TEST o similares." };
  }

  if (routeWords.length < 2 && route !== "LCL") {
    return { ok: false, error: "La ruta debe tener al menos dos puntos o segmentos, o utilizar LCL." };
  }

  if (routeWords.length > 1 && routeWords.every((word) => word === routeWords[0])) {
    return { ok: false, error: "La ruta no puede repetir el mismo punto en todos los segmentos." };
  }

  const { data: activePilotFlights, error: activeError } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("created_by", pilotId)
    .neq("status", "FINISHED")
    .limit(1);

  if (activeError) {
    console.error(activeError);
    return { ok: false, error: "No se pudo verificar si tienes vuelos activos." };
  }

  if (activePilotFlights && activePilotFlights.length > 0) {
    return { ok: false, error: "Ya tienes un vuelo activo. Finalízalo antes de crear otro." };
  }

  const { data: existingCallsign, error: callsignError } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("callsign", callsign)
    .neq("status", "FINISHED")
    .limit(1);

  if (callsignError) {
    console.error(callsignError);
    return { ok: false, error: "No se pudo verificar el callsign." };
  }

  if (existingCallsign && existingCallsign.length > 0) {
    return { ok: false, error: "Ese callsign ya está en uso por otro vuelo activo." };
  }

  const gameMarker = `[[PF24_GAME_CALLSIGN:${gameCallsign}]]%`;
  const { data: existingGameCallsign, error: gameCallsignError } = await supabase
    .from("flight_plans")
    .select("id")
    .like("notes", gameMarker)
    .neq("status", "FINISHED")
    .limit(1);

  if (gameCallsignError) {
    console.error(gameCallsignError);
    return { ok: false, error: "No se pudo verificar el callsign del juego." };
  }

  if (existingGameCallsign && existingGameCallsign.length > 0) {
    return { ok: false, error: "Ese callsign del juego ya está vinculado a otro vuelo activo." };
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
    transponder: getDefaultTransponder(flightRules),
    status: "PENDING",
    // Keep a DB-valid initial sector status. The Scope UI is responsible for
    // presenting the untouched initial STS as visually empty.
    sector_status: "STUP",
  });

  if (error) {
    console.error("PF24 createFlightPlan insert failed:", error);
    return { ok: false, error: "No se pudo crear el plan de vuelo. Inténtalo nuevamente." };
  }

  revalidatePath("/piloto");
  revalidatePath("/scope");

  return { ok: true };
}
