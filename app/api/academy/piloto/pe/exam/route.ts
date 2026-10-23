import { auth } from "@/auth";
import { findActiveAcademyInstructionRequest, submitAcademyInstructionRequest } from "@/lib/academyInstructionQueue";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import {
  PE_EXAM_PASSING_SCORE,
  PE_EXAM_TOTAL_SCORE,
  gradePeExam,
  hasAllPeExamAnswers,
  type PeExamAnswers,
} from "@/lib/academy/peExamQuestions";
import {
  getPeExamLockUntil,
  getPeExamState,
  isPeExamLocked,
  savePeExamState,
} from "@/lib/academy/peExamStorage";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sessionDiscordId(session: Session) {
  const id = session.user?.discordId?.trim();
  if (id) return id;
  return session.user?.email?.trim() || session.user?.name?.trim() || "unknown";
}

function applicantName(session: Session) {
  return session.user?.name?.trim() || session.user?.robloxUsername?.trim() || "Usuario PF24";
}

function hasPilotAccess(session: Session) {
  return getPilotRankFromRoles(session.user?.permissions?.roles) !== "NONE";
}

async function ensurePassedApplicantIsQueued(session: Session, discordId: string) {
  try {
    return await submitAcademyInstructionRequest({
      track: "pilot",
      targetRole: "PE",
      applicantDiscordId: discordId,
      applicantName: applicantName(session),
      applicantEmail: session.user?.email ?? null,
      applicantRobloxUsername: session.user?.robloxUsername ?? null,
    });
  } catch (error) {
    console.error("PF24 PE exam queue sync error:", error);
    return findActiveAcademyInstructionRequest("pilot", "PE", discordId).catch(() => null);
  }
}

function statusPayload(state: Awaited<ReturnType<typeof getPeExamState>>, queueStatus?: string | null) {
  return {
    attempts: state.attempts,
    lastScore: state.lastScore,
    lockedUntil: state.lockedUntil,
    passedAt: state.passedAt,
    cancelledAt: state.cancelledAt,
    queueStatus: queueStatus ?? null,
    passingScore: PE_EXAM_PASSING_SCORE,
    totalScore: PE_EXAM_TOTAL_SCORE,
    locked: isPeExamLocked(state),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  if (!hasPilotAccess(session)) return NextResponse.json({ error: "No tienes acceso a la Academia de Piloto" }, { status: 403 });

  const discordId = sessionDiscordId(session);
  const state = await getPeExamState(discordId);
  let queueStatus: string | null = null;

  if (state.passedAt) {
    const queued = await ensurePassedApplicantIsQueued(session, discordId);
    queueStatus = queued?.status ?? null;
  } else {
    const queued = await findActiveAcademyInstructionRequest("pilot", "PE", discordId).catch(() => null);
    queueStatus = queued?.status ?? null;
  }

  return NextResponse.json(statusPayload(state, queueStatus));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  if (!hasPilotAccess(session)) return NextResponse.json({ error: "No tienes acceso a la Academia de Piloto" }, { status: 403 });

  const discordId = sessionDiscordId(session);
  const current = await getPeExamState(discordId);

  if (current.passedAt) {
    const queued = await ensurePassedApplicantIsQueued(session, discordId);
    return NextResponse.json({
      ...statusPayload(current, queued?.status ?? null),
      passed: true,
      score: current.lastScore,
      message: "El examen PE ya fue aprobado.",
    });
  }

  if (current.cancelledAt || current.attempts >= 4) {
    return NextResponse.json({
      ...statusPayload(current),
      passed: false,
      cancelled: true,
      message: "Licencia cancelada. Solicitar vía ticket reincorporación",
    }, { status: 423 });
  }

  if (isPeExamLocked(current)) {
    return NextResponse.json({
      ...statusPayload(current),
      passed: false,
      message: "El examen PE se encuentra temporalmente bloqueado.",
    }, { status: 423 });
  }

  const body = await request.json().catch(() => null) as { answers?: PeExamAnswers } | null;
  const answers = body?.answers;
  if (!answers || typeof answers !== "object" || !hasAllPeExamAnswers(answers)) {
    return NextResponse.json({ error: "Todas las preguntas son obligatorias." }, { status: 400 });
  }

  const result = gradePeExam(answers);
  const now = new Date();
  const attempt = current.attempts + 1;
  const history = [
    ...current.history,
    {
      attempt,
      score: result.score,
      submittedAt: now.toISOString(),
      passed: result.passed,
    },
  ];

  if (result.passed) {
    const passedState = await savePeExamState({
      ...current,
      attempts: attempt,
      lastScore: result.score,
      lockedUntil: null,
      passedAt: now.toISOString(),
      cancelledAt: null,
      updatedAt: now.toISOString(),
      history,
    });

    const queued = await ensurePassedApplicantIsQueued(session, discordId);
    return NextResponse.json({
      ...statusPayload(passedState, queued?.status ?? null),
      passed: true,
      score: result.score,
      message: "Examen aprobado. Fuiste agregado automáticamente a la lista de instrucciones pendientes.",
    });
  }

  const cancelled = attempt >= 4;
  const failedState = await savePeExamState({
    ...current,
    attempts: attempt,
    lastScore: result.score,
    lockedUntil: cancelled ? null : getPeExamLockUntil(attempt, now.getTime()),
    passedAt: null,
    cancelledAt: cancelled ? now.toISOString() : null,
    updatedAt: now.toISOString(),
    history,
  });

  return NextResponse.json({
    ...statusPayload(failedState),
    passed: false,
    score: result.score,
    cancelled,
    message: cancelled
      ? "Licencia cancelada. Solicitar vía ticket reincorporación"
      : `Examen desaprobado. Próximo intento disponible después del bloqueo de ${attempt} semana${attempt === 1 ? "" : "s"}.`,
  });
}
