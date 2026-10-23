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

const PE_EXAM_DURATION_MS = 20 * 60 * 1000;

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
  const startedAt = state.activeStartedAt;
  const startMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const deadlineAt = Number.isFinite(startMs)
    ? new Date(startMs + PE_EXAM_DURATION_MS).toISOString()
    : null;

  return {
    attempts: state.attempts,
    lastScore: state.lastScore,
    lockedUntil: state.lockedUntil,
    passedAt: state.passedAt,
    cancelledAt: state.cancelledAt,
    startedAt,
    deadlineAt,
    reviewAnswers: state.passedAt ? state.passedAnswers : null,
    queueStatus: queueStatus ?? null,
    passingScore: PE_EXAM_PASSING_SCORE,
    totalScore: PE_EXAM_TOTAL_SCORE,
    durationMinutes: PE_EXAM_DURATION_MS / 60_000,
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
  const body = await request.json().catch(() => null) as {
    action?: "start" | "submit";
    answers?: PeExamAnswers;
  } | null;

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

  if (body?.action === "start") {
    if (current.activeStartedAt) {
      return NextResponse.json({
        ...statusPayload(current),
        started: true,
        message: "Examen en curso.",
      });
    }

    const now = new Date().toISOString();
    const startedState = await savePeExamState({
      ...current,
      activeStartedAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      ...statusPayload(startedState),
      started: true,
      message: "Examen iniciado.",
    });
  }

  if (!current.activeStartedAt) {
    return NextResponse.json({ error: "Primero debes iniciar el examen." }, { status: 409 });
  }

  const startedMs = Date.parse(current.activeStartedAt);
  if (!Number.isFinite(startedMs)) {
    return NextResponse.json({ error: "No se pudo validar el inicio del examen." }, { status: 409 });
  }

  const now = new Date();
  const deadlineMs = startedMs + PE_EXAM_DURATION_MS;
  const timedOut = now.getTime() >= deadlineMs;
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

  if (!timedOut && !hasAllPeExamAnswers(answers)) {
    return NextResponse.json({ error: "Todas las preguntas son obligatorias antes de enviar manualmente." }, { status: 400 });
  }

  const result = gradePeExam(answers);
  const attempt = current.attempts + 1;
  const history = [
    ...current.history,
    {
      attempt,
      score: result.score,
      submittedAt: now.toISOString(),
      passed: result.passed,
      timedOut,
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
      activeStartedAt: null,
      passedAnswers: answers,
      updatedAt: now.toISOString(),
      history,
    });

    const queued = await ensurePassedApplicantIsQueued(session, discordId);
    return NextResponse.json({
      ...statusPayload(passedState, queued?.status ?? null),
      passed: true,
      score: result.score,
      timedOut,
      message: timedOut
        ? "Tiempo finalizado. El examen fue enviado automáticamente y resultó aprobado. Fuiste agregado a instrucciones pendientes."
        : "Examen aprobado. Fuiste agregado automáticamente a la lista de instrucciones pendientes.",
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
    activeStartedAt: null,
    passedAnswers: null,
    updatedAt: now.toISOString(),
    history,
  });

  return NextResponse.json({
    ...statusPayload(failedState),
    passed: false,
    score: result.score,
    cancelled,
    timedOut,
    message: cancelled
      ? "Licencia cancelada. Solicitar vía ticket reincorporación"
      : timedOut
        ? `Tiempo finalizado. El examen fue enviado automáticamente con ${result.score}/${PE_EXAM_TOTAL_SCORE}. Próximo intento disponible después del bloqueo de ${attempt} semana${attempt === 1 ? "" : "s"}.`
        : `Examen desaprobado. Próximo intento disponible después del bloqueo de ${attempt} semana${attempt === 1 ? "" : "s"}.`,
  });
}
