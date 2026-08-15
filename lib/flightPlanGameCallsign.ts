const GAME_CALLSIGN_PATTERN = /\[\[PF24_GAME_CALLSIGN:([A-Z0-9-]{2,12})\]\]\s*/i;

export function normalizeGameCallsign(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}

export function getGameCallsignFromNotes(notes: string | null | undefined) {
  const match = String(notes ?? "").match(GAME_CALLSIGN_PATTERN);
  return match?.[1] ? normalizeGameCallsign(match[1]) : "";
}

export function getVisibleFlightPlanNotes(notes: string | null | undefined) {
  return String(notes ?? "").replace(GAME_CALLSIGN_PATTERN, "").trimStart();
}

export function setGameCallsignInNotes(
  notes: string | null | undefined,
  gameCallsign: string,
) {
  const visibleNotes = getVisibleFlightPlanNotes(notes);
  const normalized = normalizeGameCallsign(gameCallsign);
  if (!normalized) return visibleNotes;
  return `[[PF24_GAME_CALLSIGN:${normalized}]]${visibleNotes ? `\n${visibleNotes}` : ""}`;
}

export function setVisibleFlightPlanNotes(
  notes: string | null | undefined,
  visibleNotes: string,
) {
  const gameCallsign = getGameCallsignFromNotes(notes);
  const clean = visibleNotes.trimStart();
  return gameCallsign
    ? `[[PF24_GAME_CALLSIGN:${gameCallsign}]]${clean ? `\n${clean}` : ""}`
    : clean;
}
