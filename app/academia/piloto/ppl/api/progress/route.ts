import { auth } from "@/auth";
import { getPilotRankFromRoles } from "@/lib/academyRanks";
import {
  PPL_EVALUATION_MODULE,
  PPL_PROGRESS_COOKIE,
} from "@/lib/academy/pplModules";
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
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber >= PPL_EVALUATION_MODULE) {
    return NextResponse.json({ ok: false, error: "invalid_module" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const seenModules = parseSeenAcademyModules(
    cookieStore.get(PPL_PROGRESS_COOKIE)?.value,
    PPL_EVALUATION_MODULE,
  );
  const changed = !seenModules.has(moduleNumber);

  if (changed) {
    seenModules.add(moduleNumber);
    cookieStore.set(
      PPL_PROGRESS_COOKIE,
      serializeSeenAcademyModules(seenModules, PPL_EVALUATION_MODULE),
      {
        httpOnly: true,
        maxAge: ACADEMY_PROGRESS_COOKIE_MAX_AGE,
        path: "/academia/piloto",
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
      evaluationUnlocked: isAcademyEvaluationUnlocked(seenModules, PPL_EVALUATION_MODULE),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
