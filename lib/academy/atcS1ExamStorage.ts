import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AtcS1ExamStoredAnswers = Record<string, string | string[]>;

export type AtcS1ExamAttemptRecord = {
  attempt: number;
  score: number;
  submittedAt: string;
  passed: boolean;
  timedOut?: boolean;
};

export type AtcS1ExamState = {
  applicantDiscordId: string;
  attempts: number;
  lastScore: number | null;
  lockedUntil: string | null;
  passedAt: string | null;
  cancelledAt: string | null;
  activeStartedAt: string | null;
  passedAnswers: AtcS1ExamStoredAnswers | null;
  updatedAt: string;
  history: AtcS1ExamAttemptRecord[];
};

const BUCKET = "academy-exams";
let bucketReady = false;

function jsonBody(value: unknown) {
  return new Blob([JSON.stringify(value)], { type: "application/json" });
}

function objectPath(applicantDiscordId: string) {
  return `atc/S1/${encodeURIComponent(applicantDiscordId)}.json`;
}

async function ensureBucket() {
  if (bucketReady) return;

  const storage = getSupabaseAdmin().storage;
  const { data } = await storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 1024 * 1024,
      allowedMimeTypes: ["application/json"],
    });

    if (error && !/already exists/i.test(error.message)) throw error;
  }

  bucketReady = true;
}

export function emptyAtcS1ExamState(applicantDiscordId: string): AtcS1ExamState {
  return {
    applicantDiscordId,
    attempts: 0,
    lastScore: null,
    lockedUntil: null,
    passedAt: null,
    cancelledAt: null,
    activeStartedAt: null,
    passedAnswers: null,
    updatedAt: new Date(0).toISOString(),
    history: [],
  };
}

export async function getAtcS1ExamState(applicantDiscordId: string): Promise<AtcS1ExamState> {
  await ensureBucket();
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(objectPath(applicantDiscordId));
  if (error || !data) return emptyAtcS1ExamState(applicantDiscordId);

  try {
    const parsed = JSON.parse(await data.text()) as Partial<AtcS1ExamState>;
    return {
      applicantDiscordId,
      attempts: Number.isInteger(parsed.attempts) && (parsed.attempts ?? 0) >= 0 ? parsed.attempts! : 0,
      lastScore: typeof parsed.lastScore === "number" ? parsed.lastScore : null,
      lockedUntil: typeof parsed.lockedUntil === "string" ? parsed.lockedUntil : null,
      passedAt: typeof parsed.passedAt === "string" ? parsed.passedAt : null,
      cancelledAt: typeof parsed.cancelledAt === "string" ? parsed.cancelledAt : null,
      activeStartedAt: typeof parsed.activeStartedAt === "string" ? parsed.activeStartedAt : null,
      passedAnswers: parsed.passedAnswers && typeof parsed.passedAnswers === "object"
        ? parsed.passedAnswers as AtcS1ExamStoredAnswers
        : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      history: Array.isArray(parsed.history) ? parsed.history.filter(Boolean) as AtcS1ExamAttemptRecord[] : [],
    };
  } catch {
    return emptyAtcS1ExamState(applicantDiscordId);
  }
}

export async function saveAtcS1ExamState(state: AtcS1ExamState) {
  await ensureBucket();
  const { error } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .upload(objectPath(state.applicantDiscordId), jsonBody(state), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw error;
  return state;
}

export function getAtcS1ExamLockUntil(attemptNumber: number, now = Date.now()) {
  if (attemptNumber < 1 || attemptNumber > 3) return null;
  return new Date(now + attemptNumber * 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function isAtcS1ExamLocked(state: AtcS1ExamState, now = Date.now()) {
  if (!state.lockedUntil) return false;
  const unlockAt = Date.parse(state.lockedUntil);
  return Number.isFinite(unlockAt) && unlockAt > now;
}
