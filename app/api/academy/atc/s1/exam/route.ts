import { auth } from "@/auth";
import { findActiveAcademyInstructionRequest, submitAcademyInstructionRequest } from "@/lib/academyInstructionQueue";
import { nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import {
  ATC_S1_EXAM_PASSING_SCORE,
  ATC_S1_EXAM_TOTAL_SCORE,
  gradeAtcS1Exam,
  hasAllAtcS1ExamAnswers,
  type AtcS1ExamAnswers,
} from "@/lib/academy/atcS1ExamQuestions";
import {
  getAtcS1ExamLockUntil,
  getAtcS1ExamState,
  isAtcS1ExamLocked,
  saveAtcS1ExamState,
} from "@/lib/academy/atcS1ExamStorage";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ATC_S1_EXAM_DURATION_MS = 20 * 60 * 1000;

function sessionDiscordId(session: Session) {
  const id = session.user?.discordId?.trim();
  if (id) return id;
  return session.user?.email?.trim() || session.user?.name?.trim() || "unknown";
}

function applicantName(session: Session) {
  return session.user?.name?.trim() || session.user?.robloxUsername?.trim() || "Usuario PF24";
}

function hasS1ExamAccess(session: Session) {
  const currentRank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  return nextAtcRank(currentRank) === "S1";
}

async function ensurePassedApplicantIsQueued(session: Session, discordId: string) {
  try {
    return await submitAcademyInstructionRequest({
      track: "atc",
      targetRole: "S1",
      applicantDiscordId: discordId,
      applicantName: applicantName(session),
      applicantEmail: session.user?.email ?? null,
      applicantRobloxUsername: session.user?.robloxUsername ?? null,
    });
  } catch (error) {
    console.error("PF24 S1 exam queue sync error:", error);
    return findActiveAcademyInstructionRequest("atc", "S1", discordId).catch(() => null);
  }
}

function statusPayload(state: Awaited<ReturnType<typeof getAtcS1ExamState>>, queueStatus?: string | null) {
  const startedAt = state.activeStartedAt;
  const startMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const deadlineAt = Number.isFinite(startMs)
    ? new Date(startMs + ATC_S1_EXAM_DURATION_MS).toISOString()
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
    passingScore: ATC_S1_EXAM_PASSING_SCORE,
    totalScore: ATC_S1_EXAM_TOTAL_SCORE,
    durationMinutes: ATC_S1_EXAM_DURATION_MS / 60_000,
    locked: isAtcS1ExamLocked(state),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  if (!hasS1ExamAccess(session)) return NextResponse.json({ error: "No tienes acceso a la evaluación S1" }, { status: 403 });

  const discordId = sessionDiscordId(session);
  const state = await getAtcS1ExamState(discordId);
  let queueStatus: string | null = null;

  if (state.passedAt) {
    const queued = await ensurePassedApplicantIsQueued(session, discordId);
    queueStatus = queued?.status ?? null;
  } else {
    const queued = await findActiveAcademyInstructionRequest("atc", "S1", discordId).catch(() => null);
    queueStatus = queued?.status ?? null;
  }

  return NextResponse.json(statusPayload(state, queueStatus));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  if (!hasS1ExamAccess(session)) return NextResponse.json({ error: "No tienes acceso a la evaluación S1" }, { status: 403 });

  const discordId = sessionDiscordId(session);
  const current = await getAtcS1ExamState(discordId);
  const body = await request.json().catch(() => null) as {
    action?: "start" | "submit";
    answers?: AtcS1ExamAnswers;
  } | null;

  if (current.passedAt) {
    const queued = await ensurePassedApplicantIsQueued(session, discordId);
    return NextResponse.json({
      ...statusPayload(current, queued?.status ?? null),
      passed: true,
      score: current.lastScore,
      message: "El examen S1 ya fue aprobado.",
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

  if (isAtcS1ExamLocked(current)) {
    return NextResponse.json({
      ...statusPayload(current),
      passed: false,
      message: "El examen S1 se encuentra temporalmente bloqueado.",
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
    const startedState = await saveAtcS1ExamState({
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
  const deadlineMs = startedMs + ATC_S1_EXAM_DURATION_MS;
  const timedOut = now.getTime() >= deadlineMs;
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

  if (!timedOut && !hasAllAtcS1ExamAnswers(answers)) {
    return NextResponse.json({ error: "Todas las preguntas son obligatorias antes de enviar manualmente." }, { status: 400 });
  }

  const result = gradeAtcS1Exam(answers);
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
    const passedState = await saveAtcS1ExamState({
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
        ? "Tiempo finalizado. El examen fue enviado automáticamente y resultó aprobado. Fuiste agregado a instrucciones pendientes para S1."
        : "Examen S1 aprobado. Fuiste agregado automáticamente a la lista de instrucciones pendientes.",
    });
  }

  const cancelled = attempt >= 4;
  const failedState = await saveAtcS1ExamState({
    ...current,
    attempts: attempt,
    lastScore: result.score,
    lockedUntil: cancelled ? null : getAtcS1ExamLockUntil(attempt, now.getTime()),
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
        ? `Tiempo finalizado. El examen fue enviado automáticamente con ${result.score}/${ATC_S1_EXAM_TOTAL_SCORE}. Próximo intento disponible después del bloqueo de ${attempt} semana${attempt === 1 ? "" : "s"}.`
        : `Examen desaprobado. Próximo intento disponible después del bloqueo de ${attempt} semana${attempt === 1 ? "" : "s"}.`,
  });
}
