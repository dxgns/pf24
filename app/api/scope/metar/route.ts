import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station")?.trim().toUpperCase();

  if (!station || !/^[A-Z0-9]{4}$/.test(station)) {
    return NextResponse.json({ error: "ICAO inválido" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(station)}&format=json`,
      {
        headers: {
          "User-Agent": "PF24-Scope/0.1 (weather integration)",
        },
        next: { revalidate: 60 },
      }
    );

    if (response.status === 204) {
      return NextResponse.json({ station, raw: null });
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Proveedor METAR respondió ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    const first = data[0];
    const raw =
      typeof first?.rawOb === "string"
        ? first.rawOb
        : typeof first?.raw_text === "string"
          ? first.raw_text
          : null;

    return NextResponse.json({ station, raw, data: first ?? null });
  } catch (error) {
    console.error("PF24 Scope METAR error:", error);
    return NextResponse.json({ error: "No se pudo consultar METAR" }, { status: 502 });
  }
}
