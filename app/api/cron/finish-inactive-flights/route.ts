import { NextResponse } from "next/server";

export async function GET() {
  // Flight-plan age is not a reliable indication that a pilot disconnected.
  // A long flight may legitimately go hours without an administrative update,
  // so automatic cleanup is handled by the Project Flight presence flow instead.
  return NextResponse.json({
    ok: true,
    finished: [],
    count: 0,
    disabled: true,
    reason: "Flight plans are no longer finished based only on updated_at age.",
  });
}
