export const PE_MODULES = [
  "INFORMACIÓN METEOROLÓGICA Y Q-CODES",
  "ALTIMETRÍA BÁSICA",
  "CARTAS DE RODAJE Y OPERACIONES EN SUPERFICIE",
  "DIFERENCIAS ENTRE VFR E IFR",
  "CIRCUITO DE TRÁNSITO AERONÁUTICO",
  "PLAN DE VUELO VFR LOCAL",
  "LUCES DE AERONAVE",
  "MANEJO DE ESCENARIOS IMPREVISTOS",
  "FRASEOLOGÍA Y COMUNICACIONES",
  "EVALUACIÓN Y HABILITACIÓN",
] as const;

export const PILOT_EVALUATION_MODULE = PE_MODULES.length;
export const PILOT_PROGRESS_COOKIE = "pf24_pilot_academy_seen_PE";

export function parseSeenPilotModules(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0 && item <= PE_MODULES.length),
  );
}

export function isPilotEvaluationUnlocked(seenModules: Set<number>) {
  return Array.from({ length: PILOT_EVALUATION_MODULE - 1 }, (_, index) => index + 1)
    .every((moduleNumber) => seenModules.has(moduleNumber));
}
