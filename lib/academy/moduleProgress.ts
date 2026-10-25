export const ACADEMY_PROGRESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function decodeProgressCookie(value?: string) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseSeenAcademyModules(value: string | undefined, evaluationModule: number) {
  return new Set(
    decodeProgressCookie(value)
      .split(",")
      .map((item) => Number(item))
      .filter(
        (item) =>
          Number.isInteger(item) &&
          item > 0 &&
          item < evaluationModule,
      ),
  );
}

export function isAcademyEvaluationUnlocked(seenModules: Set<number>, evaluationModule: number) {
  return Array.from({ length: evaluationModule - 1 }, (_, index) => index + 1)
    .every((moduleNumber) => seenModules.has(moduleNumber));
}

export function serializeSeenAcademyModules(seenModules: Set<number>, evaluationModule: number) {
  return Array.from(seenModules)
    .filter((moduleNumber) => moduleNumber > 0 && moduleNumber < evaluationModule)
    .sort((a, b) => a - b)
    .join(",");
}
