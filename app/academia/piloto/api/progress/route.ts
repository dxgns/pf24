import { auth } from "@/auth";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import {
  PILOT_EVALUATION_MODULE,
  PILOT_PROGRESS_COOKIE,
  isPilotEvaluationUnlocked,
  parseSeenPilotModules,
} from "@/lib/academy/pilotModules";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rank = getPilotRankFromRoles(session.user?.permissions?.roles);
  if (rank === "NONE") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { moduleNumber?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const moduleNumber = Number(body.moduleNumber);
  if (
    !Number.isInteger(moduleNumber) ||
    moduleNumber < 1 ||
    moduleNumber >= PILOT_EVALUATION_MODULE
  ) {
    return NextResponse.json({ ok: false, error: "invalid_module" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const seenModules = parseSeenPilotModules(cookieStore.get(PILOT_PROGRESS_COOKIE)?.value);
  const changed = !seenModules.has(moduleNumber);

  if (changed) {
    seenModules.add(moduleNumber);
    const value = Array.from(seenModules)
      .sort((a, b) => a - b)
      .join(",");

    cookieStore.set(PILOT_PROGRESS_COOKIE, value, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      path: "/academia/piloto",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      changed,
      seenModules: Array.from(seenModules).sort((a, b) => a - b),
      evaluationUnlocked: isPilotEvaluationUnlocked(seenModules),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
