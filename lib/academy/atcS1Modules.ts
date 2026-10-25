import { nextAtcRank, type AtcRank } from "@/lib/academyRanks";
import {
  isAcademyEvaluationUnlocked,
  parseSeenAcademyModules,
} from "@/lib/academy/moduleProgress";

export const ATC_S1_MODULES = [
  "INTRODUCCIÓN A LA POSICIÓN S1",
  "INFORMACIÓN METEOROLÓGICA Y Q-CODES",
  "PISTAS ACTIVAS Y SELECCIÓN OPERATIVA",
  "SUPERFICIE: RODAJE Y POSICIONES",
  "CARTAS AERONÁUTICAS Y PLANIFICACIÓN",
  "ALTIMETRÍA BÁSICA",
  "AUTORIZACIONES IFR / VFR",
  "SITUACIONES ESPECIALES BÁSICAS",
  "FRASEOLOGÍA Y COMUNICACIONES",
  "EVALUACIÓN Y HABILITACIÓN",
] as const;

export const ATC_S1_EVALUATION_MODULE = ATC_S1_MODULES.length;
export const ATC_DEFAULT_MODULE_COUNT = 10;

export function resolveAtcTrainingRank(rank: AtcRank, canReviewS1 = false): Exclude<AtcRank, "NONE"> | null {
  if (rank === "NONE") return null;
  const nextRank = nextAtcRank(rank);
  if (nextRank) return nextRank;
  return canReviewS1 ? "S1" : null;
}

export function atcProgressCookieName(rank: Exclude<AtcRank, "NONE">) {
  return `pf24_atc_academy_seen_${rank}`;
}

export function getAtcModuleTitles(rank: Exclude<AtcRank, "NONE">): readonly string[] {
  if (rank === "S1") return ATC_S1_MODULES;

  return Array.from({ length: ATC_DEFAULT_MODULE_COUNT }, (_, index) =>
    index === ATC_DEFAULT_MODULE_COUNT - 1
      ? `EVALUACIÓN ${rank}`
      : `MÓDULO ${index + 1}`,
  );
}

export function getAtcEvaluationModule(rank: Exclude<AtcRank, "NONE">) {
  return rank === "S1" ? ATC_S1_EVALUATION_MODULE : ATC_DEFAULT_MODULE_COUNT;
}

export function parseSeenAtcModules(value: string | undefined, rank: Exclude<AtcRank, "NONE">) {
  return parseSeenAcademyModules(value, getAtcEvaluationModule(rank));
}

export function isAtcEvaluationUnlocked(seenModules: Set<number>, rank: Exclude<AtcRank, "NONE">) {
  return isAcademyEvaluationUnlocked(seenModules, getAtcEvaluationModule(rank));
}
