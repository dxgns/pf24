export const PPL_MODULES = [
  "OPERACIONES VFR AVANZADAS",
  "PLANIFICACIÓN Y GESTIÓN DE VUELO",
  "OPERACIONES IFR Y NAVEGACIÓN INSTRUMENTAL",
  "RADIOAYUDAS A LA NAVEGACIÓN",
  "PROCEDIMIENTOS DE APROXIMACIÓN Y ATERRIZAJE",
  "COMUNICACIONES IFR Y FRASEOLOGÍA AVANZADA",
  "SEGURIDAD OPERACIONAL Y FACTORES HUMANOS",
  "EVALUACIÓN Y HABILITACIÓN",
] as const;

export const PPL_EVALUATION_MODULE = PPL_MODULES.length;
export const PPL_PROGRESS_COOKIE = "pf24_pilot_academy_seen_PPL";

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
