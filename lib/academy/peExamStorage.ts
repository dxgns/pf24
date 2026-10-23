import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type PeExamAttemptRecord = {
  attempt: number;
  score: number;
  submittedAt: string;
  passed: boolean;
};

export type PeExamState = {
  applicantDiscordId: string;
  attempts: number;
  lastScore: number | null;
  lockedUntil: string | null;
  passedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  history: PeExamAttemptRecord[];
};

const BUCKET = "academy-exams";
let bucketReady = false;

function jsonBody(value: unknown) {
  return new Blob([JSON.stringify(value)], { type: "application/json" });
}

function objectPath(applicantDiscordId: string) {
  return `pilot/PE/${encodeURIComponent(applicantDiscordId)}.json`;
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

    if (error && !/already exists/i.test(error.message)) {
      throw error;
    }
  }

  bucketReady = true;
}

export function emptyPeExamState(applicantDiscordId: string): PeExamState {
  return {
    applicantDiscordId,
    attempts: 0,
    lastScore: null,
    lockedUntil: null,
    passedAt: null,
    cancelledAt: null,
    updatedAt: new Date(0).toISOString(),
    history: [],
  };
}

export async function getPeExamState(applicantDiscordId: string): Promise<PeExamState> {
  await ensureBucket();
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(objectPath(applicantDiscordId));
  if (error || !data) return emptyPeExamState(applicantDiscordId);

  try {
    const parsed = JSON.parse(await data.text()) as Partial<PeExamState>;
    return {
      applicantDiscordId,
      attempts: Number.isInteger(parsed.attempts) && (parsed.attempts ?? 0) >= 0 ? parsed.attempts! : 0,
      lastScore: typeof parsed.lastScore === "number" ? parsed.lastScore : null,
      lockedUntil: typeof parsed.lockedUntil === "string" ? parsed.lockedUntil : null,
      passedAt: typeof parsed.passedAt === "string" ? parsed.passedAt : null,
      cancelledAt: typeof parsed.cancelledAt === "string" ? parsed.cancelledAt : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      history: Array.isArray(parsed.history) ? parsed.history.filter(Boolean) as PeExamAttemptRecord[] : [],
    };
  } catch {
    return emptyPeExamState(applicantDiscordId);
  }
}

export async function savePeExamState(state: PeExamState) {
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

export function getPeExamLockUntil(attemptNumber: number, now = Date.now()) {
  if (attemptNumber < 1 || attemptNumber > 3) return null;
  return new Date(now + attemptNumber * 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function isPeExamLocked(state: PeExamState, now = Date.now()) {
  if (!state.lockedUntil) return false;
  const unlockAt = Date.parse(state.lockedUntil);
  return Number.isFinite(unlockAt) && unlockAt > now;
}
