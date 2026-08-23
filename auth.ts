import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { DISCORD_GUILD_ID } from "@/lib/discordRoles";
import { getPermissionsFromRoles } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
      if (account?.access_token) {
        token.discordAccessToken = account.access_token;
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
              const discordProfile = profile as
                | {
                    id?: string;
                    username?: string;
                    global_name?: string;
                  }
                | undefined;

              await getSupabaseAdmin().from("login_logs").insert({
                discord_id: discordProfile?.id ?? token.sub ?? "unknown",
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

      return session;
    },
  },
});
