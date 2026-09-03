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
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0 && item <= PPL_MODULES.length),
  );
}

export function isPplEvaluationUnlocked(seenModules: Set<number>) {
  return Array.from({ length: PPL_EVALUATION_MODULE - 1 }, (_, index) => index + 1)
    .every((moduleNumber) => seenModules.has(moduleNumber));
}
