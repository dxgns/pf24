import { DISCORD_ROLES } from "@/lib/discordRoles";

export type WebPermissions = {
  roles: string[];
  canAccessPilot: boolean;
  canAccessATC: boolean;
  canPublishATIS: boolean;
  canUseContactMe: boolean;
  canAssumeTraffic: boolean;
  canEditTraffic: boolean;
  canAccessAdmin: boolean;
  atcRank: "NONE" | "S0" | "S1" | "S2" | "S3" | "C1" | "C3" | "CI";
};

export function getPermissionsFromRoles(roles: string[]): WebPermissions {
  const has = (roleId: string) => roles.includes(roleId);

  const isPilot = has(DISCORD_ROLES.PILOT);
  const isATC = has(DISCORD_ROLES.ATC);
  const isStaff = has(DISCORD_ROLES.STAFF_ADMIN);

  const atcRank =
    has(DISCORD_ROLES.CI) ? "CI" :
    has(DISCORD_ROLES.C3) ? "C3" :
    has(DISCORD_ROLES.C1) ? "C1" :
    has(DISCORD_ROLES.S3) ? "S3" :
    has(DISCORD_ROLES.S2) ? "S2" :
    has(DISCORD_ROLES.S1) ? "S1" :
    has(DISCORD_ROLES.S0) ? "S0" :
    "NONE";

  const hasATCRank = atcRank !== "NONE";

  return {
    roles,
    canAccessPilot: isPilot || isATC || isStaff,
    canAccessATC: isATC || hasATCRank || isStaff,
    canPublishATIS: isATC || hasATCRank || isStaff,
    canUseContactMe: isATC || hasATCRank || isStaff,
    canAssumeTraffic: isATC || hasATCRank || isStaff,
    canEditTraffic: isATC || hasATCRank || isStaff,
    canAccessAdmin: isStaff,
    atcRank,
  };
}