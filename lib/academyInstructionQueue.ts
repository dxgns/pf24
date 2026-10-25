import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AcademyTrack = "pilot" | "atc";
export type AcademyInstructionStatus = "pending" | "instruction" | "completed";

export type AcademyInstructionRequest = {
  id: string;
  track: AcademyTrack;
  targetRole: string;
  applicantDiscordId: string;
  applicantName: string;
  applicantEmail?: string | null;
  applicantRobloxUsername?: string | null;
  submittedAt: string;
  status: AcademyInstructionStatus;
  instructorDiscordId?: string | null;
  instructorName?: string | null;
  assumedAt?: string | null;
  completedAt?: string | null;
  completedByDiscordId?: string | null;
  completedByName?: string | null;
};

const BUCKET = "academy-instruction-queue";
let bucketReady = false;

function folder(track: AcademyTrack, status: AcademyInstructionStatus) {
  return `${track}/${status}`;
}

function objectPath(track: AcademyTrack, status: AcademyInstructionStatus, id: string) {
  return `${folder(track, status)}/${id}.json`;
}

function jsonBody(value: unknown) {
  return new Blob([JSON.stringify(value)], { type: "application/json" });
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

async function readRequest(path: string): Promise<AcademyInstructionRequest | null> {
  await ensureBucket();
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) return null;

  try {
    const parsed = JSON.parse(await data.text()) as AcademyInstructionRequest;
    if (!parsed?.id || !parsed.track || !parsed.targetRole || !parsed.applicantDiscordId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function listFolder(track: AcademyTrack, status: AcademyInstructionStatus) {
  await ensureBucket();
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).list(folder(track, status), {
    limit: 500,
    sortBy: { column: "created_at", order: "asc" },
  });

  if (error) throw error;

  const requests = await Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map((item) => readRequest(`${folder(track, status)}/${item.name}`)),
  );

  return requests
    .filter((item): item is AcademyInstructionRequest => Boolean(item))
    .map((item) => ({ ...item, status }))
    .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
}

export async function listAcademyInstructionRequests(track: AcademyTrack) {
  const [pending, instruction] = await Promise.all([
    listFolder(track, "pending"),
    listFolder(track, "instruction"),
  ]);

  return { pending, instruction };
}

export async function findActiveAcademyInstructionRequest(
  track: AcademyTrack,
  targetRole: string,
  applicantDiscordId: string,
) {
  const { pending, instruction } = await listAcademyInstructionRequests(track);
  return [...pending, ...instruction].find(
    (request) =>
      request.targetRole === targetRole &&
      request.applicantDiscordId === applicantDiscordId,
  ) ?? null;
}

export async function submitAcademyInstructionRequest(input: {
  track: AcademyTrack;
  targetRole: string;
  applicantDiscordId: string;
  applicantName: string;
  applicantEmail?: string | null;
  applicantRobloxUsername?: string | null;
}) {
  const existing = await findActiveAcademyInstructionRequest(
    input.track,
    input.targetRole,
    input.applicantDiscordId,
  );
  if (existing) return existing;

  await ensureBucket();
  const id = crypto.randomUUID();
  const request: AcademyInstructionRequest = {
    id,
    track: input.track,
    targetRole: input.targetRole,
    applicantDiscordId: input.applicantDiscordId,
    applicantName: input.applicantName,
    applicantEmail: input.applicantEmail ?? null,
    applicantRobloxUsername: input.applicantRobloxUsername ?? null,
    submittedAt: new Date().toISOString(),
    status: "pending",
    instructorDiscordId: null,
    instructorName: null,
    assumedAt: null,
    completedAt: null,
    completedByDiscordId: null,
    completedByName: null,
  };

  const { error } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .upload(objectPath(input.track, "pending", id), jsonBody(request), {
      contentType: "application/json",
      upsert: false,
    });

  if (error) throw error;
  return request;
}

export async function assumeAcademyInstructionRequest(input: {
  track: AcademyTrack;
  requestId: string;
  instructorDiscordId: string;
  instructorName: string;
}) {
  await ensureBucket();
  const pendingPath = objectPath(input.track, "pending", input.requestId);
  const instructionPath = objectPath(input.track, "instruction", input.requestId);
  const request = await readRequest(pendingPath);
  if (!request || request.track !== input.track) {
    return readRequest(instructionPath);
  }

  const claimed: AcademyInstructionRequest = {
    ...request,
    status: "instruction",
    instructorDiscordId: input.instructorDiscordId,
    instructorName: input.instructorName,
    assumedAt: new Date().toISOString(),
  };

  // Crear primero el destino sin upsert hace que dos instructores no puedan
  // asumir el mismo alumno al mismo tiempo: solo una creación puede ganar.
  const { error: claimError } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .upload(instructionPath, jsonBody(claimed), {
      contentType: "application/json",
      upsert: false,
    });

  if (claimError) {
    const alreadyClaimed = await readRequest(instructionPath);
    if (alreadyClaimed) return alreadyClaimed;
    throw claimError;
  }

  await getSupabaseAdmin().storage.from(BUCKET).remove([pendingPath]);
  return claimed;
}

export async function completeAcademyInstructionRequest(input: {
  track: AcademyTrack;
  requestId: string;
  completedByDiscordId: string;
  completedByName: string;
}) {
  await ensureBucket();
  const instructionPath = objectPath(input.track, "instruction", input.requestId);
  const completedPath = objectPath(input.track, "completed", input.requestId);
  const request = await readRequest(instructionPath);

  if (!request || request.track !== input.track) {
    return readRequest(completedPath);
  }

  const completed: AcademyInstructionRequest = {
    ...request,
    status: "completed",
    completedAt: new Date().toISOString(),
    completedByDiscordId: input.completedByDiscordId,
    completedByName: input.completedByName,
  };

  const { error: archiveError } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .upload(completedPath, jsonBody(completed), {
      contentType: "application/json",
      upsert: false,
    });

  if (archiveError) {
    const alreadyCompleted = await readRequest(completedPath);
    if (!alreadyCompleted) throw archiveError;
    const { error: cleanupError } = await getSupabaseAdmin().storage.from(BUCKET).remove([instructionPath]);
    if (cleanupError) throw cleanupError;
    return alreadyCompleted;
  }

  const { error: removeError } = await getSupabaseAdmin().storage.from(BUCKET).remove([instructionPath]);
  if (removeError) throw removeError;
  return completed;
}

export function waitingDays(submittedAt: string, now = Date.now()) {
  const submitted = Date.parse(submittedAt);
  if (!Number.isFinite(submitted)) return 0;
  return Math.max(0, Math.floor((now - submitted) / 86_400_000));
}
