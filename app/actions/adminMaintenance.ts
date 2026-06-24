"use server";

import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.permissions?.canAccessAdmin) {
    throw new Error("Acceso restringido");
  }

  return session;
}

export async function adminEndAtcSession(sessionId: string, position: string) {
  await requireAdmin();

  await supabase
    .from("atc_sessions")
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await supabase
    .from("flight_plans")
    .update({
      assumed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("assumed_by", position)
    .neq("status", "FINISHED");

  revalidatePath("/admin");
  revalidatePath("/atc");
}

export async function adminFinishFlightPlan(flightPlanId: string) {
  await requireAdmin();

  await supabase
    .from("flight_plans")
    .update({
      status: "FINISHED",
      sector_status: "PARKED",
      assumed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", flightPlanId);

  revalidatePath("/admin");
  revalidatePath("/atc");
  revalidatePath("/piloto");
}