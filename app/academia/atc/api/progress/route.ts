import { auth } from "@/auth";
import { nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import {
  atcProgressCookieName,
  getAtcEvaluationModule,
} from "@/lib/academy/atcS1Modules";
import {
  ACADEMY_PROGRESS_COOKIE_MAX_AGE,
  isAcademyEvaluationUnlocked,
  parseSeenAcademyModules,
  serializeSeenAcademyModules,
} from "@/lib/academy/moduleProgress";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const currentRank = (session.user?.permissions?.atcRank ?? "NONE") as AtcRank;
  if (currentRank === "NONE") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const targetRank = nextAtcRank(currentRank);
  if (!targetRank) {
    return NextResponse.json({ ok: false, error: "no_next_rank" }, { status: 409 });
  }

  let body: { moduleNumber?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const evaluationModule = getAtcEvaluationModule(targetRank);
  const moduleNumber = Number(body.moduleNumber);
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber >= evaluationModule) {
    return NextResponse.json({ ok: false, error: "invalid_module" }, { status: 400 });
  }

  const cookieName = atcProgressCookieName(targetRank);
  const cookieStore = await cookies();
  const seenModules = parseSeenAcademyModules(
    cookieStore.get(cookieName)?.value,
    evaluationModule,
  );
  const changed = !seenModules.has(moduleNumber);

  if (changed) {
    seenModules.add(moduleNumber);
    cookieStore.set(
      cookieName,
      serializeSeenAcademyModules(seenModules, evaluationModule),
      {
        httpOnly: true,
        maxAge: ACADEMY_PROGRESS_COOKIE_MAX_AGE,
        path: "/academia/atc",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      changed,
      seenModules: Array.from(seenModules).sort((a, b) => a - b),
      evaluationUnlocked: isAcademyEvaluationUnlocked(seenModules, evaluationModule),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
