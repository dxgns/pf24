export const SWEATBOX_INSTRUCTOR_ROLE_ID = "1427450636508725449";

export type ScopeServerMode = "AUTOMATIC" | "SWEATBOX" | "SWEATBOX_INSTRUCTOR";

export type SweatboxSessionDetail = {
  connected: boolean;
  mode: ScopeServerMode;
  room: string;
  instructor: boolean;
  controllerName?: string;
  callsign?: string;
};

export type SweatboxFlightPlan = {
  callsign: string;
  flightLevel: string;
  departure: string;
  cruiseSpeed: string;
  arrival: string;
  aircraft: string;
  alternate: string;
  fuelDuration: string;
  flightRules: string;
  registration: string;
  route: string;
  remarks: string;
};

export type SweatboxNavMode = "MANUAL" | "DIRECT" | "LAND" | "TAKEOFF" | "GO_AROUND";

export type SweatboxAircraft = {
  id: string;
  callsign: string;
  aircraftType: string;
  x: number;
  y: number;
  altitude: number;
  heading: number;
  speed: number;
  verticalRate: number;
  targetAltitude: number;
  targetHeading: number;
  targetSpeed: number;
  navMode: SweatboxNavMode;
  navTarget?: string | null;
  procedureAirport?: string | null;
  procedureCode?: string | null;
  runway?: string | null;
  flightPlan: SweatboxFlightPlan;
  assumedBy?: string | null;
  held?: boolean;
  lastContactBy?: string | null;
  lastContactAt?: number | null;
  freeText?: string;
};

export type SweatboxSnapshot = {
  version: 1;
  room: string;
  sentAt: number;
  traffic: SweatboxAircraft[];
  atis: Record<string, unknown>;
  sector: Record<string, unknown>;
};

export const SCOPE_SERVER_EVENT = "pf24-scope-server-change";
export const SWEATBOX_COMMAND_EVENT = "pf24-sweatbox-command";
export const SWEATBOX_SELECTION_EVENT = "pf24-sweatbox-selection";
export const SWEATBOX_ATIS_EVENT = "pf24-sweatbox-atis";
export const SWEATBOX_SECTOR_EVENT = "pf24-sweatbox-sector";
export const SWEATBOX_SNAPSHOT_EVENT = "pf24-sweatbox-snapshot";

export const SCOPE_SERVER_MODE_KEY = "pf24_scope_server_mode_v1";
export const SWEATBOX_ROOM_KEY = "pf24_sweatbox_room_v1";

export function normalizeSweatboxRoom(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

export function readScopeServerMode(): ScopeServerMode {
  if (typeof window === "undefined") return "AUTOMATIC";
  const value = window.localStorage.getItem(SCOPE_SERVER_MODE_KEY);
  return value === "SWEATBOX" || value === "SWEATBOX_INSTRUCTOR" ? value : "AUTOMATIC";
}

export function readSweatboxRoom() {
  if (typeof window === "undefined") return "";
  return normalizeSweatboxRoom(window.localStorage.getItem(SWEATBOX_ROOM_KEY));
}

export function scopeIsSweatbox() {
  return readScopeServerMode() !== "AUTOMATIC";
}

export function scopeIsSweatboxInstructor() {
  return readScopeServerMode() === "SWEATBOX_INSTRUCTOR";
}

export function defaultSweatboxFlightPlan(callsign: string): SweatboxFlightPlan {
  return {
    callsign,
    flightLevel: "000",
    departure: "MDPC",
    cruiseSpeed: "000",
    arrival: "MDST",
    aircraft: "A320",
    alternate: "MDPC",
    fuelDuration: "00.00",
    flightRules: "IFR",
    registration: "",
    route: "DCT",
    remarks: "SWEATBOX TRAINING",
  };
}
