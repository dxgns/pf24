import { NextRequest, NextResponse } from "next/server";
import {
  ROBLOX_IDENTITY_COOKIE,
  encodeRobloxIdentity,
  resolveRobloxIdentity,
} from "@/lib/robloxIdentity";

function safeCallbackUrl(value: FormDataEntryValue | null) {
  const candidate = String(value ?? "/dashboard").trim();
  return candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/dashboard";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("robloxUsername") ?? "");
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  try {
    const identity = await resolveRobloxIdentity(username);
    const encodedIdentity = await encodeRobloxIdentity(identity);
    const signInUrl = new URL("/api/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", callbackUrl);

    const response = NextResponse.redirect(signInUrl, 303);
    response.cookies.set(ROBLOX_IDENTITY_COOKIE, encodedIdentity, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error("PF24 Roblox link error:", error);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("robloxError", "1");
    return NextResponse.redirect(loginUrl, 303);
  }
}
