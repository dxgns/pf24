"use server";

import { auth } from "@/auth";
import { getPilotRankFromRoles, nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import {
  assumeAcademyInstructionRequest,
  submitAcademyInstructionRequest,
  type AcademyTrack,
} from "@/lib/academyInstructionQueue";
import { revalidatePath } from "next/cache";

const PILOT_INSTRUCTOR_ROLE_ID = "1427450639507656846";
const ATC_INSTRUCTOR_ROLE_ID = "1427450636508725449";

function readTrack(value: FormDataEntryValue | null): AcademyTrack {
  if (value === "pilot" || value === "atc") return value;
  throw new Error("Área de instrucción inválida");
}

function readRequired(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} inválido`);
  return text;
}

function sessionDiscordId(session: Awaited<ReturnType<typeof auth>>) {
  const id = session?.user?.discordId?.trim();
  if (id) return id;
  return session?.user?.email?.trim() || session?.user?.name?.trim() || "unknown";
}

function validateApplicantTarget(
  track: AcademyTrack,
  targetRole: string,
  session: NonNullable<Awaited<ReturnType<typeof auth>>>,
) {
  if (track === "pilot") {
    if (getPilotRankFromRoles(session.user?.permissions?.roles) === "NONE") {
      throw new Error("No tienes acceso a la Academia de Piloto");
    }
    if (targetRole !== "PE" && targetRole !== "PPL") {
      throw new Error("Licencia de Piloto inválida");
    }
    return;
  }

  const currentRank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  const expected = nextAtcRank(currentRank);
  if (!expected || targetRole !== expected) {
    throw new Error("Rango ATC de postulación inválido");
  }
}

export async function submitAcademyEvaluation(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Debes iniciar sesión");

  const track = readTrack(formData.get("track"));
  const targetRole = readRequired(formData.get("targetRole"), "Rol");
  validateApplicantTarget(track, targetRole, session);

  await submitAcademyInstructionRequest({
    track,
    targetRole,
    applicantDiscordId: sessionDiscordId(session),
    applicantName: session.user?.name?.trim() || session.user?.robloxUsername?.trim() || "Usuario PF24",
    applicantEmail: session.user?.email ?? null,
    applicantRobloxUsername: session.user?.robloxUsername ?? null,
  });

  if (track === "pilot") {
    revalidatePath("/academia/piloto/instrucciones");
    revalidatePath("/academia/piloto/contenido");
    revalidatePath("/academia/piloto/ppl/contenido");
  } else {
    revalidatePath("/academia/atc/instrucciones");
    revalidatePath("/academia/atc/contenido");
  }
}

export async function assumeAcademyInstruction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Debes iniciar sesión");

  const track = readTrack(formData.get("track"));
  const requestId = readRequired(formData.get("requestId"), "Solicitud");
  const instructorRole = track === "pilot" ? PILOT_INSTRUCTOR_ROLE_ID : ATC_INSTRUCTOR_ROLE_ID;
  const roles = session.user?.permissions?.roles ?? [];
  if (!roles.includes(instructorRole)) {
    throw new Error("No tienes permiso para asumir instrucciones en esta área");
  }

  await assumeAcademyInstructionRequest({
    track,
    requestId,
    instructorDiscordId: sessionDiscordId(session),
    instructorName: session.user?.name?.trim() || "Instructor PF24",
  });

  revalidatePath(track === "pilot" ? "/academia/piloto/instrucciones" : "/academia/atc/instrucciones");
}
