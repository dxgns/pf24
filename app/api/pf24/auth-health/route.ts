import { NextResponse } from "next/server";

function detect(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return name;
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = detect("AUTH_SECRET", "NEXTAUTH_SECRET");
  const discordId = detect(
    "AUTH_DISCORD_ID",
    "AUTH_DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_ID",
    "DISCORD_ID",
  );
  const discordSecret = detect(
    "AUTH_DISCORD_SECRET",
    "AUTH_DISCORD_CLIENT_SECRET",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_SECRET",
  );
  const supabaseUrl = detect("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRole = detect("SUPABASE_SERVICE_ROLE_KEY");

  const ok = Boolean(secret && discordId && discordSecret);

  return NextResponse.json(
    {
      ok,
      authSecret: Boolean(secret),
      authSecretSource: secret,
      discordClientId: Boolean(discordId),
      discordClientIdSource: discordId,
      discordClientSecret: Boolean(discordSecret),
      discordClientSecretSource: discordSecret,
      supabaseUrl: Boolean(supabaseUrl),
      supabaseServiceRole: Boolean(supabaseServiceRole),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
