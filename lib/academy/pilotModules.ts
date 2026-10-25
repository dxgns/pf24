import {
  isAcademyEvaluationUnlocked,
  parseSeenAcademyModules,
} from "@/lib/academy/moduleProgress";

export const PE_MODULES = [
  "INTRODUCCIÓN A LA LICENCIA PE",
  "INFORMACIÓN METEOROLÓGICA Y Q-CODES",
  "ALTIMETRÍA BÁSICA",
  "CARTAS DE RODAJE Y OPERACIONES EN SUPERFICIE",
  "DIFERENCIAS ENTRE VFR E IFR",
  "CIRCUITO DE TRÁNSITO AERONÁUTICO",
  "PLAN DE VUELO",
  "LUCES DE AERONAVE",
  "MANEJO DE ESCENARIOS IMPREVISTOS",
  "FRASEOLOGÍA Y COMUNICACIONES",
  "EVALUACIÓN Y HABILITACIÓN",
] as const;

export const PILOT_EVALUATION_MODULE = PE_MODULES.length;
export const PILOT_PROGRESS_COOKIE = "pf24_pilot_academy_seen_PE_v2";

export function parseSeenPilotModules(value?: string) {
  return parseSeenAcademyModules(value, PILOT_EVALUATION_MODULE);
}

export function isPilotEvaluationUnlocked(seenModules: Set<number>) {
  return isAcademyEvaluationUnlocked(seenModules, PILOT_EVALUATION_MODULE);
}
