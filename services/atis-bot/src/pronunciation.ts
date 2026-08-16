const NATO_ES: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};

const NATO_EN: Record<string, string> = {
  ...NATO_ES,
  A: "Alpha",
};

const DIGIT_ES: Record<string, string> = {
  "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
  "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve",
};

const DIGIT_EN: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
};

const RUNWAY_SIDE_ES: Record<string, string> = { L: "izquierda", R: "derecha", C: "centro" };
const RUNWAY_SIDE_EN: Record<string, string> = { L: "left", R: "right", C: "center" };

const AIRPORTS: Record<string, {
  es: string;
  en: string;
  transitionAltitude?: number;
  transitionLevel?: string;
}> = {
  MDPC: {
    es: "Punta Cana Internacional",
    en: "Punta Cana International",
    transitionAltitude: 3000,
    transitionLevel: "040",
  },
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

type Language = "es" | "en";

type ParsedMetar = {
  day?: string;
  time?: string;
  windDirection?: string;
  windSpeed?: string;
  windGust?: string;
  visibility?: string;
  clouds: Array<{ cover: string; feet?: number }>;
  temperature?: string;
  dewPoint?: string;
  qnh?: string;
  altimeter?: string;
};

function digits(value: string, language: Language) {
  const map = language === "es" ? DIGIT_ES : DIGIT_EN;
  return value.split("").map((d) => map[d] ?? d).join(" ");
}

function infoWord(letter: string, language: Language) {
  const map = language === "es" ? NATO_ES : NATO_EN;
  return map[letter.toUpperCase()] ?? letter;
}

function spellIcao(value: string, language: Language) {
  const map = language === "es" ? NATO_ES : NATO_EN;
  return value.toUpperCase().split("").map((c) => map[c] ?? c).join(" ");
}

function runway(value: string, language: Language) {
  const normalized = value.trim().toUpperCase();
  const number = normalized.replace(/[^0-9]/g, "");
  const side = normalized.match(/[LRC]$/)?.[0];
  const sideWord = side
    ? (language === "es" ? RUNWAY_SIDE_ES : RUNWAY_SIDE_EN)[side] ?? ""
    : "";
  return `${digits(number, language)}${sideWord ? ` ${sideWord}` : ""}`;
}

function approach(value: string | null | undefined) {
  if (!value) return "";
  return value
    .toUpperCase()
    .replace(/ILS/g, "I L S")
    .replace(/RNP/g, "R N P")
    .replace(/VISUAL/g, "visual");
}

function normalizeSignedTwoDigits(value: string | undefined, language: Language) {
  if (!value) return undefined;
  const negative = value.startsWith("M");
  const raw = value.replace(/^M/, "");
  const spoken = digits(raw, language);
  if (!negative) return spoken;
  return language === "es" ? `menos ${spoken}` : `minus ${spoken}`;
}

function numberWordsEs(value: number): string {
  if (value === 0) return "cero";
  if (value === 100) return "cien";
  if (value < 100) {
    const units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const teens: Record<number, string> = {
      10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
      16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
      20: "veinte", 21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
      25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
    };
    if (teens[value]) return teens[value];
    if (value < 10) return units[value];
    const tensWords = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    const tens = Math.floor(value / 10);
    const unit = value % 10;
    return unit ? `${tensWords[tens]} y ${units[unit]}` : tensWords[tens];
  }
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const rest = value % 100;
    const head = hundreds === 1 ? "ciento" : ["", "", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"][hundreds];
    return rest ? `${head} ${numberWordsEs(rest)}` : head;
  }
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1000);
    const rest = value % 1000;
    const head = thousands === 1 ? "mil" : `${numberWordsEs(thousands)} mil`;
    return rest ? `${head} ${numberWordsEs(rest)}` : head;
  }
  return String(value);
}

function numberWordsEn(value: number): string {
  if (value === 0) return "zero";
  if (value < 20) {
    return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"][value];
  }
  if (value < 100) {
    const tensWords = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const tens = Math.floor(value / 10);
    const unit = value % 10;
    return unit ? `${tensWords[tens]} ${numberWordsEn(unit)}` : tensWords[tens];
  }
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const rest = value % 100;
    return rest ? `${numberWordsEn(hundreds)} hundred ${numberWordsEn(rest)}` : `${numberWordsEn(hundreds)} hundred`;
  }
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1000);
    const rest = value % 1000;
    return rest ? `${numberWordsEn(thousands)} thousand ${numberWordsEn(rest)}` : `${numberWordsEn(thousands)} thousand`;
  }
  return String(value);
}

function numberWords(value: number, language: Language) {
  return language === "es" ? numberWordsEs(value) : numberWordsEn(value);
}

function parseMetar(input: string): ParsedMetar {
  const result: ParsedMetar = { clouds: [] };
  const tokens = input.toUpperCase().trim().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    if (/^[A-Z]{4}$/.test(token)) continue;
    if (token === "METAR" || token === "SPECI" || token === "AUTO" || token === "COR") continue;

    const time = token.match(/^(\d{2})(\d{2})(\d{2})Z$/);
    if (time) {
      result.day = time[1];
      result.time = `${time[2]}${time[3]}`;
      continue;
    }

    const wind = token.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/);
    if (wind) {
      result.windDirection = wind[1];
      result.windSpeed = wind[2];
      result.windGust = wind[3];
      continue;
    }

    if (/^\d{4}$/.test(token)) {
      result.visibility = token;
      continue;
    }

    const cloud = token.match(/^(FEW|SCT|BKN|OVC)(\d{3})(?:CB|TCU)?$/);
    if (cloud) {
      result.clouds.push({ cover: cloud[1], feet: Number(cloud[2]) * 100 });
      continue;
    }
    if (token === "SKC" || token === "CLR" || token === "NSC" || token === "NCD") {
      result.clouds.push({ cover: token });
      continue;
    }

    const temp = token.match(/^(M?\d{2})\/(M?\d{2})$/);
    if (temp) {
      result.temperature = temp[1];
      result.dewPoint = temp[2];
      continue;
    }

    const qnh = token.match(/^Q(\d{4})$/);
    if (qnh) {
      result.qnh = qnh[1];
      continue;
    }

    const altimeter = token.match(/^A(\d{4})$/);
    if (altimeter) {
      result.altimeter = altimeter[1];
    }
  }

  return result;
}

function cloudPhrase(cover: string, feet: number | undefined, language: Language) {
  if (["SKC", "CLR", "NSC", "NCD"].includes(cover)) {
    return language === "es" ? "cielo despejado" : "sky clear";
  }

  const esCover: Record<string, string> = {
    FEW: "nubes escasas",
    SCT: "nubes dispersas",
    BKN: "nubes rotas",
    OVC: "cielo cubierto",
  };
  const enCover: Record<string, string> = {
    FEW: "few clouds",
    SCT: "scattered clouds",
    BKN: "broken clouds",
    OVC: "overcast",
  };
  const label = language === "es" ? esCover[cover] : enCover[cover];
  if (!feet) return label ?? cover;
  return language === "es"
    ? `${label} a ${numberWords(feet, "es")} pies`
    : `${label} at ${numberWords(feet, "en")} feet`;
}

function metarPhrases(parsed: ParsedMetar, language: Language) {
  const phrases: string[] = [];

  if (parsed.day && parsed.time) {
    phrases.push(`${digits(parsed.day, language)}, ${digits(parsed.time, language)} Zulu`);
  }

  if (parsed.windDirection && parsed.windSpeed) {
    const direction = parsed.windDirection === "VRB"
      ? (language === "es" ? "variable" : "variable")
      : `${digits(parsed.windDirection, language)} ${language === "es" ? "grados" : "degrees"}`;
    let wind = language === "es"
      ? `vientos ${direction} ${digits(parsed.windSpeed, "es")} nudos`
      : `wind ${direction} ${digits(parsed.windSpeed, "en")} knots`;
    if (parsed.windGust) {
      wind += language === "es"
        ? `, rachas ${digits(parsed.windGust, "es")} nudos`
        : `, gusting ${digits(parsed.windGust, "en")} knots`;
    }
    phrases.push(wind);
  }

  if (parsed.visibility) {
    if (parsed.visibility === "9999") {
      phrases.push(language === "es"
        ? "visibilidad mayor a diez kilómetros"
        : "visibility greater than ten kilometers");
    } else {
      phrases.push(language === "es"
        ? `visibilidad ${digits(parsed.visibility, "es")} metros`
        : `visibility ${digits(parsed.visibility, "en")} meters`);
    }
  }

  for (const cloud of parsed.clouds) {
    phrases.push(cloudPhrase(cloud.cover, cloud.feet, language));
  }

  const temperature = normalizeSignedTwoDigits(parsed.temperature, language);
  if (temperature) {
    phrases.push(language === "es" ? `temperatura ${temperature}` : `temperature ${temperature}`);
  }

  const dewPoint = normalizeSignedTwoDigits(parsed.dewPoint, language);
  if (dewPoint) {
    phrases.push(language === "es" ? `punto de rocío ${dewPoint}` : `dew point ${dewPoint}`);
  }

  if (parsed.qnh) {
    phrases.push(`Q N H ${digits(parsed.qnh, language)}`);
  } else if (parsed.altimeter) {
    phrases.push(language === "es"
      ? `altímetro ${digits(parsed.altimeter, "es")}`
      : `altimeter ${digits(parsed.altimeter, "en")}`);
  }

  return phrases;
}

function freeText(value: string | null | undefined, language: Language) {
  return (value ?? "")
    .replace(/\b\d+\b/g, (match) => digits(match, language))
    .replace(/\s+/g, " ")
    .trim();
}

function airportName(icao: string, language: Language) {
  const profile = AIRPORTS[icao.toUpperCase()];
  if (profile) return language === "es" ? profile.es : profile.en;
  return spellIcao(icao, language);
}

function transitionPhrase(icao: string, language: Language) {
  const profile = AIRPORTS[icao.toUpperCase()];
  if (!profile?.transitionAltitude || !profile.transitionLevel) return "";
  return language === "es"
    ? `altitud de transición ${numberWords(profile.transitionAltitude, "es")} pies, nivel de transición ${digits(profile.transitionLevel, "es")}`
    : `transition altitude ${numberWords(profile.transitionAltitude, "en")} feet, transition level ${digits(profile.transitionLevel, "en")}`;
}

export function buildSpanishAtisSpeech(row: AtisSpeechData) {
  const parsed = parseMetar(row.metar);
  const optional = row.approach_optional ? ` o ${approach(row.approach_optional)}` : "";
  const rwy = runway(row.runway, "es");
  const extra = freeText(row.extra_info, "es");
  const remarks = freeText(row.remarks, "es");

  return [
    `${airportName(row.airport_icao, "es")} ATIS información ${infoWord(row.info_letter, "es")}`,
    ...metarPhrases(parsed, "es"),
    `aeronaves esperen aproximación ${approach(row.approach_primary)}${optional}`,
    `salidas pista ${rwy}`,
    `llegadas pista ${rwy}`,
    transitionPhrase(row.airport_icao, "es"),
    "transponder modo altitude en todas las calles de rodaje y pistas en uso",
    extra ? `información adicional, ${extra}` : "",
    remarks ? `observaciones, ${remarks}` : "",
    `notifique información ${infoWord(row.info_letter, "es")} en contacto inicial`,
  ].filter(Boolean).join(". ") + ".";
}

export function buildEnglishAtisSpeech(row: AtisSpeechData) {
  const parsed = parseMetar(row.metar);
  const optional = row.approach_optional ? ` or ${approach(row.approach_optional)}` : "";
  const rwy = runway(row.runway, "en");
  const extra = freeText(row.extra_info, "en");
  const remarks = freeText(row.remarks, "en");

  return [
    `${airportName(row.airport_icao, "en")} ATIS information ${infoWord(row.info_letter, "en")}`,
    ...metarPhrases(parsed, "en"),
    `aircraft expect ${approach(row.approach_primary)}${optional} approach`,
    `departures runway ${rwy}`,
    `arrivals runway ${rwy}`,
    transitionPhrase(row.airport_icao, "en"),
    "transponder altitude mode on all taxiways and runways in use",
    extra ? `additional information, ${extra}` : "",
    remarks ? `remarks, ${remarks}` : "",
    `advise information ${infoWord(row.info_letter, "en")} on initial contact`,
  ].filter(Boolean).join(". ") + ".";
}
