import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { cookies } from "next/headers";
import { DISCORD_GUILD_ID } from "@/lib/discordRoles";
import { getPermissionsFromRoles } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ROBLOX_IDENTITY_COOKIE,
  decodeRobloxIdentity,
  type RobloxIdentity,
} from "@/lib/robloxIdentity";

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

type DiscordProfile = {
  id?: string;
  username?: string;
  global_name?: string;
};

function missingIdentityTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

async function fetchDiscordRoles(accessToken: unknown): Promise<string[] | null> {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) return null;

  try {
    const response = await fetch(
      `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("No se pudieron obtener roles Discord:", response.status);
      return null;
    }

    const member = await response.json() as { roles?: unknown };
    return Array.isArray(member.roles)
      ? member.roles.filter((role): role is string => typeof role === "string")
      : [];
  } catch (error) {
    console.error("Discord role fetch error:", error);
    return null;
  }
}

async function readLinkedRobloxCookie() {
  try {
    const cookieStore = await cookies();
    return decodeRobloxIdentity(cookieStore.get(ROBLOX_IDENTITY_COOKIE)?.value);
  } catch {
    return null;
  }
}

async function loadStoredRobloxIdentity(discordId: string): Promise<RobloxIdentity | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pf24_user_identities")
      .select("roblox_user_id,roblox_username,roblox_display_name,updated_at")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (error) {
      if (!missingIdentityTable(error)) {
        console.error("PF24 Roblox identity load error:", error);
      }
      return null;
    }

    if (!data?.roblox_user_id || !data?.roblox_username) return null;
    return {
      userId: String(data.roblox_user_id),
      username: String(data.roblox_username),
      displayName: String(data.roblox_display_name ?? data.roblox_username),
      linkedAt: data.updated_at ? new Date(data.updated_at).getTime() : 0,
    };
  } catch (error) {
    console.error("PF24 Roblox identity load exception:", error);
    return null;
  }
}

async function saveStoredRobloxIdentity(discordId: string, identity: RobloxIdentity) {
  try {
    const { error } = await getSupabaseAdmin()
      .from("pf24_user_identities")
      .upsert({
        discord_id: discordId,
        roblox_user_id: identity.userId,
        roblox_username: identity.username,
        roblox_display_name: identity.displayName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "discord_id" });

    if (error && !missingIdentityTable(error)) {
      console.error("PF24 Roblox identity save error:", error);
    }
  } catch (error) {
    console.error("PF24 Roblox identity save exception:", error);
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: AUTH_SECRET,
  trustHost: true,
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      authorization: {
        params: {
          scope: "identify email guilds.members.read",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      const discordProfile = profile as DiscordProfile | undefined;

      if (account?.access_token) {
        token.discordAccessToken = account.access_token;
        if (discordProfile?.id) token.discordId = discordProfile.id;
      }

      const discordId = String(token.discordId ?? discordProfile?.id ?? token.sub ?? "").trim();
      let robloxIdentity = await readLinkedRobloxCookie();

      // Roblox is the persistent identity used by PFPilot to find the pilot's
      // aircraft in Project Flight. Do not depend on a new Discord login to make
      // that identity available: recover it from the JWT or the identity table on
      // every session refresh when the cookie is not present.
      if (!robloxIdentity && token.robloxUserId && token.robloxUsername) {
        robloxIdentity = {
          userId: String(token.robloxUserId),
          username: String(token.robloxUsername),
          displayName: String(token.robloxDisplayName ?? token.robloxUsername),
          linkedAt: 0,
        };
      }

      if (!robloxIdentity && discordId) {
        robloxIdentity = await loadStoredRobloxIdentity(discordId);
      }

      if (robloxIdentity && discordId) {
        const identityChanged =
          String(token.robloxUserId ?? "") !== robloxIdentity.userId ||
          String(token.robloxUsername ?? "") !== robloxIdentity.username;
        if (account?.access_token || identityChanged) {
          await saveStoredRobloxIdentity(discordId, robloxIdentity);
        }
      }

      if (robloxIdentity) {
        token.robloxUserId = robloxIdentity.userId;
        token.robloxUsername = robloxIdentity.username;
        token.robloxDisplayName = robloxIdentity.displayName;
      }

      // Keep a role snapshot in the JWT for fallback, but do not rely on it as
      // the authoritative value after login. The session callback below performs
      // a no-cache Discord lookup every time a page resolves the session, so a
      // browser refresh immediately reflects roles added or removed in Discord.
      if (account?.access_token || !Array.isArray(token.discordRoles)) {
        const roles = await fetchDiscordRoles(token.discordAccessToken);
        if (roles) {
          token.discordRoles = roles;
          token.permissions = getPermissionsFromRoles(roles);

          if (account?.access_token) {
            await getSupabaseAdmin().from("login_logs").insert({
              discord_id: discordProfile?.id ?? token.discordId ?? token.sub ?? "unknown",
              username:
                discordProfile?.username ??
                token.name ??
                "Usuario desconocido",
              display_name:
                discordProfile?.global_name ??
                token.name ??
                discordProfile?.username ??
                "Usuario desconocido",
              roles,
            });
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      const cachedRoles = Array.isArray(token.discordRoles)
        ? token.discordRoles.filter((role): role is string => typeof role === "string")
        : [];
      const freshRoles = await fetchDiscordRoles(token.discordAccessToken);
      const roles = freshRoles ?? cachedRoles;

      session.user.discordRoles = roles;
      session.user.permissions = getPermissionsFromRoles(roles);
      session.user.robloxUserId = token.robloxUserId as string | undefined;
      session.user.robloxUsername = token.robloxUsername as string | undefined;
      session.user.robloxDisplayName = token.robloxDisplayName as string | undefined;

      return session;
    },
  },
});
