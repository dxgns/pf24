import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { getGameCallsignFromNotes, normalizeGameCallsign } from "@/lib/flightPlanGameCallsign";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function planKeys(plan: { callsign?: string | null; notes?: string | null }) {
  const keys = new Set<string>();
  const shown = normalizeGameCallsign(String(plan.callsign ?? ""));
  const game = normalizeGameCallsign(getGameCallsignFromNotes(String(plan.notes ?? "")));
  if (shown) keys.add(shown);
  if (game) keys.add(game);
  return keys;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.permissions?.canAccessATC) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  let body: { planId?: unknown; callsign?: unknown };
  try {
    body = await request.json() as { planId?: unknown; callsign?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const callsign = normalizeGameCallsign(typeof body.callsign === "string" ? body.callsign : "");
  if (!planId || !callsign) {
    return NextResponse.json({ ok: false, error: "Faltan datos del tránsito." }, { status: 400 });
  }

  const { data: plan, error: lookupError } = await supabaseAdmin
    .from("flight_plans")
    .select("id,callsign,notes,status")
    .eq("id", planId)
    .maybeSingle();

  if (lookupError) {
    console.error("PF24 disconnected traffic plan lookup failed:", lookupError);
    return NextResponse.json({ ok: false, error: "No se pudo verificar el plan." }, { status: 500 });
  }

  if (!plan) return NextResponse.json({ ok: true, deleted: false, alreadyMissing: true });
  if (!planKeys(plan).has(callsign)) {
    return NextResponse.json({ ok: false, error: "El callsign ya no coincide con el plan." }, { status: 409 });
  }

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from("flight_plans")
    .delete()
    .eq("id", planId)
    .neq("status", "FINISHED")
    .select("id,callsign")
    .maybeSingle();

  if (deleteError) {
    console.error("PF24 disconnected traffic plan delete failed:", deleteError);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar el plan." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: Boolean(deleted), plan: deleted ?? null });
}
