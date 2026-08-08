export type ScopeFlightPlan = {
  id: string;
  callsign: string;
  aircraft_type: string;
  flight_rules: string;
  departure_icao: string;
  arrival_icao: string;
  route: string;
  flight_level: string;
  transponder: string;
  status: string;
  sector_status: string;
  notes: string | null;
  assumed_by: string | null;
  created_by: string | null;
};

export type SimAircraft = {
  id: string;
  callsign: string;
  aircraftType: string;
  altitude: number;
  targetAltitude: number;
  heading: number;
  targetHeading: number;
  groundSpeed: number;
  x: number;
  y: number;
  squawk: string;
  departure: string;
  arrival: string;
  selected?: boolean;
};

export type ScopeWindowKey =
  | "sector"
  | "taxi"
  | "holds"
  | "timer"
  | "metar"
  | "atis"
  | "atc";
