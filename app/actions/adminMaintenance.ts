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

async function logAdminAction({
  action,
  targetType,
  targetId,
  targetLabel,
}: {
  action: string;
  targetType: string;
  targetId?: string;
  targetLabel?: string;
}) {
  const session = await auth();

  await supabase.from("admin_logs").insert({
    admin_name: session?.user?.name ?? "Admin",
    admin_email: session?.user?.email ?? null,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    target_label: targetLabel ?? null,
  });
}

export async function adminEndAtcSession(
  sessionId: string,
  position: string
) {
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

  await supabase
    .from("atis_messages")
    .delete()
    .eq("created_by", position);

  await logAdminAction({
    action: "END_ATC_SESSION",
    targetType: "atc_session",
    targetId: sessionId,
    targetLabel: position,
  });

  revalidatePath("/admin");
  revalidatePath("/atc");
  revalidatePath("/piloto");
}

export async function adminFinishFlightPlan(flightPlanId: string) {
  await requireAdmin();

  const { data: flight } = await supabase
    .from("flight_plans")
    .select("callsign")
    .eq("id", flightPlanId)
    .single();

  await supabase
    .from("flight_plans")
    .update({
      status: "FINISHED",
      sector_status: "PARKED",
      assumed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", flightPlanId);

  await logAdminAction({
    action: "FINISH_FLIGHT_PLAN",
    targetType: "flight_plan",
    targetId: flightPlanId,
    targetLabel: flight?.callsign ?? flightPlanId,
  });

  revalidatePath("/admin");
  revalidatePath("/atc");
  revalidatePath("/piloto");
}

export async function adminDeleteAtis(atisId: string, label?: string) {
  await requireAdmin();

  await supabase
    .from("atis_messages")
    .delete()
    .eq("id", atisId);

  await logAdminAction({
    action: "DELETE_ATIS",
    targetType: "atis_message",
    targetId: atisId,
    targetLabel: label ?? atisId,
  });

  revalidatePath("/admin");
  revalidatePath("/atc");
  revalidatePath("/piloto");
}