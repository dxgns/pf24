"use server";

import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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

  const callsign = String(formData.get("callsign") ?? "")
    .toUpperCase()
    .replace(/\s/g, "")
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
    .replace(/\s+/g, " ")
    .trim();

  const flightLevel = String(formData.get("flightLevel") ?? "")
    .replace(/\D/g, "")
    .slice(0, 3);

  const notes = String(formData.get("notes") ?? "");

  if (
    !callsign ||
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

  if (callsign.length < 2) {
    return {
      ok: false,
      error: "El callsign debe tener al menos 2 caracteres.",
    };
  }

  if (departure === arrival) {
    return {
      ok: false,
      error: "El aeropuerto de salida y llegada no pueden ser el mismo.",
    };
  }

  if (flightLevel.length < 1 || flightLevel.length > 3) {
    return {
      ok: false,
      error: "El FL debe tener entre 1 y 3 números.",
    };
  }

  const forbiddenRouteWords = [
    "GPS",
    "DIRECT",
    "DIRECTO",
    "DIR",
    "AUTO",
    "AUTOMATIC",
    "AUTOMATICA",
    "AUTOMÁTICA",
    "RANDOM",
    "ANY",
    "ANYWHERE",
    "NA",
    "N/A",
    "NONE",
    "NULL",
    "TEST",
    "PRUEBA",
    "ASD",
    "QWE",
    "ABC",
    "XXX",
    "TBD",
    "TBA",
    "NO",
    "SIN",
    "SINRUTA",
    "NO ROUTE",
    "NO PLAN",
    "FREE",
    "FREE ROUTE",
    "VFR",
    "IFR",
    "RUTA",
    "ROUTE",
  ];

  const forbiddenRouteCharacters =
    /[.,;:!¡?¿'"`´¨^~_\-–—/\\|()[\]{}<>+=*@#$%&]/;

  if (forbiddenRouteCharacters.test(route)) {
    return {
      ok: false,
      error:
        "La ruta solo puede contener letras, números y espacios. No uses puntos, guiones, barras ni símbolos.",
    };
  }

  const routeWords = route
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  const onlyDctOrGps =
    routeWords.length > 0 &&
    routeWords.every((word) => word === "DCT" || word === "GPS");

  if (onlyDctOrGps) {
    return {
      ok: false,
      error:
        "La ruta no puede estar compuesta solo por GPS y/o DCT. Ingresa puntos de ruta válidos.",
    };
  }

  const invalidRouteWord = routeWords.some((word) =>
    forbiddenRouteWords.includes(word)
  );

  if (invalidRouteWord) {
    return {
      ok: false,
      error:
        "La ruta contiene palabras no válidas como GPS, DIRECT, TEST o similares.",
    };
  }

  if (routeWords.length < 2) {
    return {
      ok: false,
      error: "La ruta debe tener al menos dos puntos o segmentos.",
    };
  }

  const repeatedSameWord = routeWords.every((word) => word === routeWords[0]);

  if (repeatedSameWord) {
    return {
      ok: false,
      error: "La ruta no puede repetir el mismo punto en todos los segmentos.",
    };
  }

  const { data: activePilotFlights, error: activeError } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("created_by", pilotId)
    .neq("status", "FINISHED")
    .limit(1);

  if (activeError) {
    console.error(activeError);

    return {
      ok: false,
      error: "No se pudo verificar si tienes vuelos activos.",
    };
  }

  if (activePilotFlights && activePilotFlights.length > 0) {
    return {
      ok: false,
      error: "Ya tienes un vuelo activo. Finalízalo antes de crear otro.",
    };
  }

  const { data: existingCallsign, error: callsignError } = await supabase
    .from("flight_plans")
    .select("id")
    .eq("callsign", callsign)
    .neq("status", "FINISHED")
    .limit(1);

  if (callsignError) {
    console.error(callsignError);

    return {
      ok: false,
      error: "No se pudo verificar el callsign.",
    };
  }

  if (existingCallsign && existingCallsign.length > 0) {
    return {
      ok: false,
      error: "Ese callsign ya está en uso por otro vuelo activo.",
    };
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

    return {
      ok: false,
      error: "No se pudo crear el plan de vuelo. Inténtalo nuevamente.",
    };
  }

  revalidatePath("/piloto");
  revalidatePath("/atc");

  return {
    ok: true,
  };
}