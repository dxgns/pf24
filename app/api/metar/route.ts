import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get("icao")?.toUpperCase();

  if (!icao) {
    return NextResponse.json({ error: "ICAO requerido" }, { status: 400 });
  }

  const url = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "No se pudo obtener METAR" },
      { status: 500 }
    );
  }

  const data = await response.json();
  const raw = data?.[0]?.rawOb ?? data?.[0]?.raw_text ?? "";

  return NextResponse.json({
    icao,
    metar: raw || "METAR NO DISPONIBLE",
  });
}