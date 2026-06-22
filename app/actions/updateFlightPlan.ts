"use server";

import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function updateFlightPlan(formData: FormData) {
  const session = await auth();

  const id = String(formData.get("id"));
  const transponder = String(formData.get("transponder"));
  const status = String(formData.get("status"));
  const sectorStatus = String(formData.get("sectorStatus"));
  const assumedBy = String(formData.get("assumedBy") ?? "");

  const { data: oldPlan, error: oldError } = await supabase
    .from("flight_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (oldError || !oldPlan) {
    throw new Error("No se encontró el plan de vuelo");
  }

  const changes = [
    ["transponder", oldPlan.transponder, transponder],
    ["status", oldPlan.status, status],
    ["sector_status", oldPlan.sector_status, sectorStatus],
    ["assumed_by", oldPlan.assumed_by, assumedBy],
  ].filter(([, oldValue, newValue]) => oldValue !== newValue);

  const { error } = await supabase
    .from("flight_plans")
    .update({
      transponder,
      status,
      sector_status: sectorStatus,
      assumed_by: assumedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("No se pudo actualizar el plan de vuelo");
  }

  if (changes.length > 0) {
    await supabase.from("audit_logs").insert(
      changes.map(([field, oldValue, newValue]) => ({
        flight_plan_id: id,
        changed_by: session?.user?.name ?? "ATC",
        field_name: field,
        old_value: oldValue ?? "",
        new_value: newValue ?? "",
      }))
    );
  }

  revalidatePath("/atc");
}

export async function assumeFlightPlan(formData: FormData) {
  const session = await auth();
  const id = String(formData.get("id"));

  const { error } = await supabase
    .from("flight_plans")
    .update({
      assumed_by: session?.user?.name ?? "ATC",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo asumir el vuelo");
  }

  revalidatePath("/atc");
}