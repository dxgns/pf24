import { DISCORD_ROLES } from "@/lib/discordRoles";

export type PilotRank = "NONE" | "PPL" | "CPL" | "ATPL";
export type AtcRank = "NONE" | "S0" | "S1" | "S2" | "S3" | "C1" | "C3" | "CI";

const PILOT_SEQUENCE: Exclude<PilotRank, "NONE">[] = ["PPL", "CPL", "ATPL"];
const ATC_SEQUENCE: Exclude<AtcRank, "NONE">[] = ["S0", "S1", "S2", "S3", "C1", "C3", "CI"];

export function getPilotRankFromRoles(roles: string[] | undefined): PilotRank {
  if (!roles?.includes(DISCORD_ROLES.PILOT)) return "NONE";

  // PF24 currently exposes one Discord pilot role. Until rank-specific pilot
  // role IDs are introduced, that role represents the current PPL stage.
  return "PPL";
}

export function nextPilotRank(rank: PilotRank): Exclude<PilotRank, "NONE"> | null {
  if (rank === "NONE") return null;
  const index = PILOT_SEQUENCE.indexOf(rank);
  return index >= 0 && index < PILOT_SEQUENCE.length - 1 ? PILOT_SEQUENCE[index + 1] : null;
}

export function nextAtcRank(rank: AtcRank): Exclude<AtcRank, "NONE"> | null {
  if (rank === "NONE") return null;
  const index = ATC_SEQUENCE.indexOf(rank);
  return index >= 0 && index < ATC_SEQUENCE.length - 1 ? ATC_SEQUENCE[index + 1] : null;
}
