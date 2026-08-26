import { DefaultSession } from "next-auth";
import { WebPermissions } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      discordRoles: string[];
      permissions: WebPermissions;
      robloxUserId?: string;
      robloxUsername?: string;
      robloxDisplayName?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordRoles?: string[];
    permissions?: WebPermissions;
    discordAccessToken?: string;
    discordId?: string;
    robloxUserId?: string;
    robloxUsername?: string;
    robloxDisplayName?: string;
  }
}
