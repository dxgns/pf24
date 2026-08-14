import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

// Aeropuertos del Scope que no publican un METAR utilizable de forma regular.
// Se usa la estación meteorológica aeronáutica operacional más cercana.
const METAR_FALLBACKS: Record<string, string> = {
  MDCR: "MDBH", // Cabo Rojo -> María Montez / Barahona
  MTCA: "MTPP", // Les Cayes -> Toussaint Louverture / Port-au-Prince
};

async function fetchMetar(station: string) {
  const response = await fetch(
    `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(station)}&format=json`,
    {
      headers: {
        "User-Agent": "PF24-Scope/0.1 (weather integration)",
      },
      next: { revalidate: 60 },
    }
  );

  if (response.status === 204) return { raw: null, data: null };
  if (!response.ok) throw new Error(`Proveedor METAR respondió ${response.status}`);

  const data = (await response.json()) as Array<Record<string, unknown>>;
  const first = data[0] ?? null;
  const raw =
    typeof first?.rawOb === "string"
      ? first.rawOb
      : typeof first?.raw_text === "string"
        ? first.raw_text
        : null;

  return { raw, data: first };
}

export async function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station")?.trim().toUpperCase();

  if (!station || !/^[A-Z0-9]{4}$/.test(station)) {
    return NextResponse.json({ error: "ICAO inválido" }, { status: 400 });
  }

  try {
    const primary = await fetchMetar(station);
    if (primary.raw) {
      return NextResponse.json({
        station,
        sourceStation: station,
        fallback: false,
        raw: primary.raw,
        data: primary.data,
      });
    }

    const fallbackStation = METAR_FALLBACKS[station];
    if (fallbackStation) {
      const fallback = await fetchMetar(fallbackStation);
      if (fallback.raw) {
        return NextResponse.json({
          station,
          sourceStation: fallbackStation,
          fallback: true,
          raw: fallback.raw,
          data: fallback.data,
        });
      }
    }

    return NextResponse.json({
      station,
      sourceStation: station,
      fallback: false,
      raw: null,
      data: null,
    });
  } catch (error) {
    console.error("PF24 Scope METAR error:", error);
    return NextResponse.json({ error: "No se pudo consultar METAR" }, { status: 502 });
  }
}
