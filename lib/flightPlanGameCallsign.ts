export type FlightPlanTransponderMode = "OFF" | "STBY" | "ON" | "ALT";

export type FlightPlanExtraFields = {
  alternate: string;
  cruiseSpeed: string;
  fuelDuration: string;
  registration: string;
};

type HiddenFlightPlanMetadata = FlightPlanExtraFields & {
  gameCallsign: string;
  transponderMode: FlightPlanTransponderMode | "";
  pilotTransponder: string;
};

const KNOWN_METADATA_PATTERN = /\[\[PF24_(?:GAME_CALLSIGN|XPDR_MODE|PILOT_XPDR|ALTERNATE|CRUISE_SPEED|FUEL_DURATION|REGISTRATION):[^\]\r\n]*\]\]\s*/gi;

function readMarker(notes: string | null | undefined, key: string) {
  const pattern = new RegExp(`\\[\\[PF24_${key}:([^\\]\\r\\n]*)\\]\\]`, "i");
  return String(notes ?? "").match(pattern)?.[1]?.trim() ?? "";
}

export function normalizeGameCallsign(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}

export function normalizeAirportIcao(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export function normalizeCruiseSpeed(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

export function normalizeFuelDuration(value: string) {
  return value.replace(/[^0-9.]/g, "").slice(0, 5);
}

export function normalizeAircraftRegistration(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 10);
}

export function normalizePilotTransponder(value: string) {
  return value.replace(/[^0-7]/g, "").slice(0, 4);
}

function readMetadata(notes: string | null | undefined): HiddenFlightPlanMetadata {
  const rawMode = readMarker(notes, "XPDR_MODE").toUpperCase();
  const transponderMode: FlightPlanTransponderMode | "" =
    rawMode === "OFF" || rawMode === "STBY" || rawMode === "ON" || rawMode === "ALT"
      ? rawMode
      : "";

  return {
    gameCallsign: normalizeGameCallsign(readMarker(notes, "GAME_CALLSIGN")),
    transponderMode,
    pilotTransponder: normalizePilotTransponder(readMarker(notes, "PILOT_XPDR")),
    alternate: normalizeAirportIcao(readMarker(notes, "ALTERNATE")),
    cruiseSpeed: normalizeCruiseSpeed(readMarker(notes, "CRUISE_SPEED")),
    fuelDuration: normalizeFuelDuration(readMarker(notes, "FUEL_DURATION")),
    registration: normalizeAircraftRegistration(readMarker(notes, "REGISTRATION")),
  };
}

function buildNotes(metadata: HiddenFlightPlanMetadata, visibleNotes: string) {
  const markers: string[] = [];
  if (metadata.gameCallsign) markers.push(`[[PF24_GAME_CALLSIGN:${metadata.gameCallsign}]]`);
  if (metadata.transponderMode) markers.push(`[[PF24_XPDR_MODE:${metadata.transponderMode}]]`);
  if (metadata.pilotTransponder) markers.push(`[[PF24_PILOT_XPDR:${metadata.pilotTransponder}]]`);
  if (metadata.alternate) markers.push(`[[PF24_ALTERNATE:${metadata.alternate}]]`);
  if (metadata.cruiseSpeed) markers.push(`[[PF24_CRUISE_SPEED:${metadata.cruiseSpeed}]]`);
  if (metadata.fuelDuration) markers.push(`[[PF24_FUEL_DURATION:${metadata.fuelDuration}]]`);
  if (metadata.registration) markers.push(`[[PF24_REGISTRATION:${metadata.registration}]]`);

  const cleanVisible = visibleNotes.trimStart();
  return [...markers, ...(cleanVisible ? [cleanVisible] : [])].join("\n");
}

export function getGameCallsignFromNotes(notes: string | null | undefined) {
  return readMetadata(notes).gameCallsign;
}

export function getTransponderModeFromNotes(
  notes: string | null | undefined,
): FlightPlanTransponderMode {
  return readMetadata(notes).transponderMode || "STBY";
}

export function getPilotTransponderFromNotes(notes: string | null | undefined) {
  return readMetadata(notes).pilotTransponder;
}

export function getFlightPlanExtraFieldsFromNotes(
  notes: string | null | undefined,
): FlightPlanExtraFields {
  const metadata = readMetadata(notes);
  return {
    alternate: metadata.alternate,
    cruiseSpeed: metadata.cruiseSpeed,
    fuelDuration: metadata.fuelDuration,
    registration: metadata.registration,
  };
}

export function getVisibleFlightPlanNotes(notes: string | null | undefined) {
  return String(notes ?? "").replace(KNOWN_METADATA_PATTERN, "").trimStart();
}

export function setFlightPlanMetadataInNotes(
  notes: string | null | undefined,
  patch: Partial<HiddenFlightPlanMetadata>,
) {
  const current = readMetadata(notes);
  const next: HiddenFlightPlanMetadata = {
    ...current,
    ...patch,
    gameCallsign:
      patch.gameCallsign === undefined
        ? current.gameCallsign
        : normalizeGameCallsign(patch.gameCallsign),
    pilotTransponder:
      patch.pilotTransponder === undefined
        ? current.pilotTransponder
        : normalizePilotTransponder(patch.pilotTransponder),
    alternate:
      patch.alternate === undefined
        ? current.alternate
        : normalizeAirportIcao(patch.alternate),
    cruiseSpeed:
      patch.cruiseSpeed === undefined
        ? current.cruiseSpeed
        : normalizeCruiseSpeed(patch.cruiseSpeed),
    fuelDuration:
      patch.fuelDuration === undefined
        ? current.fuelDuration
        : normalizeFuelDuration(patch.fuelDuration),
    registration:
      patch.registration === undefined
        ? current.registration
        : normalizeAircraftRegistration(patch.registration),
  };

  return buildNotes(next, getVisibleFlightPlanNotes(notes));
}

export function setGameCallsignInNotes(
  notes: string | null | undefined,
  gameCallsign: string,
) {
  return setFlightPlanMetadataInNotes(notes, { gameCallsign });
}

export function setTransponderModeInNotes(
  notes: string | null | undefined,
  transponderMode: FlightPlanTransponderMode,
) {
  return setFlightPlanMetadataInNotes(notes, { transponderMode });
}

export function setPilotTransponderInNotes(
  notes: string | null | undefined,
  pilotTransponder: string,
) {
  return setFlightPlanMetadataInNotes(notes, { pilotTransponder });
}

export function setPilotTransponderStateInNotes(
  notes: string | null | undefined,
  pilotTransponder: string,
  transponderMode: FlightPlanTransponderMode,
) {
  return setFlightPlanMetadataInNotes(notes, { pilotTransponder, transponderMode });
}

export function setFlightPlanExtraFieldsInNotes(
  notes: string | null | undefined,
  fields: FlightPlanExtraFields,
) {
  return setFlightPlanMetadataInNotes(notes, fields);
}

export function setVisibleFlightPlanNotes(
  notes: string | null | undefined,
  visibleNotes: string,
) {
  return buildNotes(readMetadata(notes), visibleNotes);
}
