import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("flight_plans")
    .update({
      status: "FINISHED",
      sector_status: "PARKED",
      assumed_by: null,
      updated_at: new Date().toISOString(),
    })
    .neq("status", "FINISHED")
    .lt("updated_at", threeHoursAgo)
    .select("id, callsign");

  if (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    finished: data ?? [],
    count: data?.length ?? 0,
  });
}