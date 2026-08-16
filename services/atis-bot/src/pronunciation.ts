const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};

const DIGIT_ES: Record<string, string> = {
  "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
  "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve",
};

const DIGIT_EN: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
};

export type AtisSpeechData = {
  airport_icao: string;
  info_letter: string;
  metar: string;
  approach_primary: string;
  approach_optional?: string | null;
  runway: string;
  extra_info?: string | null;
  remarks?: string | null;
};

function digits(value: string, language: "es" | "en") {
  const map = language === "es" ? DIGIT_ES : DIGIT_EN;
  return value.split("").map((d) => map[d] ?? d).join(" ");
}

function spellIcao(value: string) {
  return value.toUpperCase().split("").map((c) => NATO[c] ?? c).join(" ");
}

function runway(value: string, language: "es" | "en") {
  const normalized = value.trim().toUpperCase();
  const number = normalized.replace(/[^0-9]/g, "");
  const side = normalized.match(/[LRC]$/)?.[0];
  const sideWord = side
    ? language === "es"
      ? { L: "izquierda", R: "derecha", C: "centro" }[side]
      : { L: "left", R: "right", C: "center" }[side]
    : "";
  return `${digits(number, language)}${sideWord ? ` ${sideWord}` : ""}`;
}

function approach(value: string | null | undefined) {
  if (!value) return "";
  return value.toUpperCase().replace(/ILS/g, "I L S").replace(/RNP/g, "R N P");
}

function cleanFreeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function buildSpanishAtisSpeech(row: AtisSpeechData) {
  const optional = row.approach_optional
    ? `, o ${approach(row.approach_optional)}`
    : "";
  const extra = cleanFreeText(row.extra_info);
  const remarks = cleanFreeText(row.remarks);

  return [
    `${spellIcao(row.airport_icao)}, información ${NATO[row.info_letter] ?? row.info_letter}.`,
    `METAR: ${prepareMetar(row.metar, "es")}.`,
    `Aeronaves esperen aproximación ${approach(row.approach_primary)}${optional}, pista ${runway(row.runway, "es")}.`,
    "Transponder modo altitud en todas las calles de rodaje y pistas en uso.",
    `Notifique información ${NATO[row.info_letter] ?? row.info_letter} en contacto inicial.`,
    extra ? `Información adicional: ${extra}.` : "",
    remarks ? `Observaciones: ${remarks}.` : "",
  ].filter(Boolean).join(" ");
}

export function buildEnglishAtisSpeech(row: AtisSpeechData) {
  const optional = row.approach_optional
    ? `, or ${approach(row.approach_optional)}`
    : "";
  const extra = cleanFreeText(row.extra_info);
  const remarks = cleanFreeText(row.remarks);

  return [
    `${spellIcao(row.airport_icao)}, information ${NATO[row.info_letter] ?? row.info_letter}.`,
    `METAR: ${prepareMetar(row.metar, "en")}.`,
    `Aircraft expect ${approach(row.approach_primary)}${optional} approach, runway ${runway(row.runway, "en")}.`,
    "Transponder altitude mode on all taxiways and runways in use.",
    `Advise information ${NATO[row.info_letter] ?? row.info_letter} on initial contact.`,
    extra ? `Additional information: ${extra}.` : "",
    remarks ? `Remarks: ${remarks}.` : "",
  ].filter(Boolean).join(" ");
}

function prepareMetar(input: string, language: "es" | "en") {
  let text = input.toUpperCase();
  text = text.replace(/\bQNH\s*(\d{3,4})\b/g, (_, n: string) => `Q N H ${digits(n, language)}`);
  text = text.replace(/\b(\d{3})\/(\d{2})KT\b/g, (_, dir: string, speed: string) =>
    language === "es"
      ? `viento ${digits(dir, "es")} grados, ${digits(speed, "es")} nudos`
      : `wind ${digits(dir, "en")} degrees, ${digits(speed, "en")} knots`,
  );
  text = text.replace(/\b(\d{2,4})\b/g, (_, n: string) => digits(n, language));
  return text.replace(/\s+/g, " ").trim();
}
