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

      if (account?.access_token && discordId) {
        if (robloxIdentity) {
          await saveStoredRobloxIdentity(discordId, robloxIdentity);
        } else {
          robloxIdentity = await loadStoredRobloxIdentity(discordId);
        }
      }

      if (robloxIdentity) {
        token.robloxUserId = robloxIdentity.userId;
        token.robloxUsername = robloxIdentity.username;
        token.robloxDisplayName = robloxIdentity.displayName;
      }

      if (token.discordAccessToken) {
        try {
          const response = await fetch(
            `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
            {
              headers: {
                Authorization: `Bearer ${token.discordAccessToken}`,
              },
            }
          );

          if (response.ok) {
            const member = await response.json();
            const roles = member.roles ?? [];

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
          } else {
            console.error("No se pudieron obtener roles Discord:", response.status);
          }
        } catch (error) {
          console.error("Discord role fetch/login log error:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.discordRoles = token.discordRoles as string[];
      session.user.permissions = token.permissions as ReturnType<
        typeof getPermissionsFromRoles
      >;
      session.user.robloxUserId = token.robloxUserId as string | undefined;
      session.user.robloxUsername = token.robloxUsername as string | undefined;
      session.user.robloxDisplayName = token.robloxDisplayName as string | undefined;

      return session;
    },
  },
});
