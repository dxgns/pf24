import {
  isAcademyEvaluationUnlocked,
  parseSeenAcademyModules,
} from "@/lib/academy/moduleProgress";

export const PPL_MODULES = [
  "INTRODUCCIÓN A LA LICENCIA PPL",
  "NAVEGACIÓN VFR DE TRAVESÍA",
  "PLANIFICACIÓN Y GESTIÓN DEL VUELO",
  "CONDICIONES METEOROLÓGICAS Y TOMA DE DECISIONES",
  "ATZ, SERVICIOS ATC Y CARTAS",
  "FUNDAMENTOS DEL VUELO IFR",
  "REFERENCIAS DE NAVEGACIÓN Y RNAV",
  "SALIDAS, LLEGADAS Y APROXIMACIONES",
  "APROXIMACIÓN ESTABILIZADA Y FRUSTRADA",
  "COMUNICACIONES Y FRASEOLOGÍA AVANZADA",
  "SITUACIONES ANORMALES Y SEGURIDAD OPERACIONAL",
  "EVALUACIÓN Y HABILITACIÓN",
] as const;

export const PPL_EVALUATION_MODULE = PPL_MODULES.length;
export const PPL_PROGRESS_COOKIE = "pf24_pilot_academy_seen_PPL_v2";

export function parseSeenPplModules(value?: string) {
  return parseSeenAcademyModules(value, PPL_EVALUATION_MODULE);
}

export function isPplEvaluationUnlocked(seenModules: Set<number>) {
  return isAcademyEvaluationUnlocked(seenModules, PPL_EVALUATION_MODULE);
}
