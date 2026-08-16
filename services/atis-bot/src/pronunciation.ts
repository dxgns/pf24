const NATO_ES: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};

const NATO_EN: Record<string, string> = { ...NATO_ES, A: "Alpha" };

const DIGIT_ES: Record<string, string> = {
  "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
  "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve",
};

const DIGIT_EN: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
};

const AIRPORTS: Record<string, { es: string; en: string; transitionAltitude?: number; transitionLevel?: string }> = {
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
};

function digits(value: string, language: Language) {
  const map = language === "es" ? DIGIT_ES : DIGIT_EN;
  return value.split("").map((d) => map[d] ?? d).join(" ");
}

function infoWord(letter: string, language: Language) {
  const map = language === "es" ? NATO_ES : NATO_EN;
  return map[letter.toUpperCase()] ?? letter;
}

function airportName(icao: string, language: Language) {
  const profile = AIRPORTS[icao.toUpperCase()];
  if (profile) return language === "es" ? profile.es : profile.en;
  const map = language === "es" ? NATO_ES : NATO_EN;
  return icao.toUpperCase().split("").map((c) => map[c] ?? c).join(" ");
}

function normalizeRunway(raw: string) {
  const value = raw.toUpperCase().trim();
  const match = value.match(/(?:^|\s)(\d{1,2})([LRC]?)(?=\s|$)/);
  if (!match) {
    const compact = value.match(/(\d{1,2})([LRC]?)/);
    return compact ? `${compact[1].padStart(2, "0")}${compact[2] ?? ""}` : value;
  }
  return `${match[1].padStart(2, "0")}${match[2] ?? ""}`;
}

function runwaySpeech(raw: string, language: Language) {
  const value = normalizeRunway(raw);
  const match = value.match(/^(\d{2})([LRC]?)$/);
  if (!match) return value;
  const sideEs: Record<string, string> = { L: "izquierda", R: "derecha", C: "centro" };
  const sideEn: Record<string, string> = { L: "left", R: "right", C: "center" };
  const side = match[2]
    ? ` ${(language === "es" ? sideEs : sideEn)[match[2]]}`
    : "";
  return `${digits(match[1], language)}${side}`;
}

function approachSpeech(value: string | null | undefined) {
  return (value ?? "")
    .toUpperCase()
    .replace(/RNP/g, "R N P")
    .replace(/ILS/g, "I L S")
    .replace(/VISUAL/g, "visual")
    .trim();
}

function parseMetar(input: string): ParsedMetar {
  const result: ParsedMetar = { clouds: [] };
  const tokens = input.toUpperCase().trim().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const t = token.match(/^(\d{2})(\d{2})(\d{2})Z$/);
    if (t) {
      result.day = t[1];
      result.time = `${t[2]}${t[3]}`;
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

    const cloud = token.match(/^(FEW|SCT|BKN|OVC)(\d{3})/);
    if (cloud) {
      result.clouds.push({ cover: cloud[1], feet: Number(cloud[2]) * 100 });
      continue;
    }

    const temp = token.match(/^(M?\d{2})\/(M?\d{2})$/);
    if (temp) {
      result.temperature = temp[1];
      result.dewPoint = temp[2];
      continue;
    }

    const qnh = token.match(/^Q(\d{4})$/);
    if (qnh) result.qnh = qnh[1];
  }

  return result;
}

function numberWordsEs(n: number): string {
  if (n === 100) return "cien";
  if (n < 30) {
    return ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve","veinte","veintiuno","veintidós","veintitrés","veinticuatro","veinticinco","veintiséis","veintisiete","veintiocho","veintinueve"][n];
  }
  if (n < 100) {
    const tens = ["","","","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${tens[t]} y ${numberWordsEs(u)}` : tens[t];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hw = h === 1 ? "ciento" : ["","","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"][h];
    return r ? `${hw} ${numberWordsEs(r)}` : hw;
  }
  if (n < 1_000_000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const head = th === 1 ? "mil" : `${numberWordsEs(th)} mil`;
    return r ? `${head} ${numberWordsEs(r)}` : head;
  }
  return String(n);
}

function numberWordsEn(n: number): string {
  if (n < 20) return ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"][n];
  if (n < 100) {
    const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${tens[t]} ${numberWordsEn(u)}` : tens[t];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r ? `${numberWordsEn(h)} hundred ${numberWordsEn(r)}` : `${numberWordsEn(h)} hundred`;
  }
  if (n < 1_000_000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    return r ? `${numberWordsEn(th)} thousand ${numberWordsEn(r)}` : `${numberWordsEn(th)} thousand`;
  }
  return String(n);
}

function numberWords(n: number, language: Language) {
  return language === "es" ? numberWordsEs(n) : numberWordsEn(n);
}

function signedDigits(value: string | undefined, language: Language) {
  if (!value) return "";
  const negative = value.startsWith("M");
  const raw = value.replace(/^M/, "");
  const spoken = digits(raw, language);
  if (!negative) return spoken;
  return `${language === "es" ? "menos" : "minus"} ${spoken}`;
}

function metarPhrases(parsed: ParsedMetar, language: Language) {
  const out: string[] = [];

  if (parsed.day && parsed.time) {
    out.push(`${digits(parsed.day, language)}, ${digits(parsed.time, language)} Zulu`);
  }

  if (parsed.windDirection && parsed.windSpeed) {
    const dir = parsed.windDirection === "VRB"
      ? "variable"
      : `${digits(parsed.windDirection, language)} ${language === "es" ? "grados" : "degrees"}`;
    let wind = language === "es"
      ? `vientos ${dir}, ${digits(parsed.windSpeed, language)} nudos`
      : `wind ${dir}, ${digits(parsed.windSpeed, language)} knots`;
    if (parsed.windGust) {
      wind += language === "es"
        ? `, rachas ${digits(parsed.windGust, language)} nudos`
        : `, gusting ${digits(parsed.windGust, language)} knots`;
    }
    out.push(wind);
  }

  if (parsed.visibility) {
    out.push(parsed.visibility === "9999"
      ? (language === "es" ? "visibilidad mayor a diez kilómetros" : "visibility greater than ten kilometers")
      : (language === "es" ? `visibilidad ${digits(parsed.visibility, language)} metros` : `visibility ${digits(parsed.visibility, language)} meters`));
  }

  const coversEs: Record<string, string> = { FEW: "nubes escasas", SCT: "nubes dispersas", BKN: "nubes rotas", OVC: "cielo cubierto" };
  const coversEn: Record<string, string> = { FEW: "few clouds", SCT: "scattered clouds", BKN: "broken clouds", OVC: "overcast" };
  for (const cloud of parsed.clouds) {
    const label = (language === "es" ? coversEs : coversEn)[cloud.cover] ?? cloud.cover;
    if (cloud.feet) {
      out.push(language === "es"
        ? `${label} a ${numberWords(cloud.feet, language)} pies`
        : `${label} at ${numberWords(cloud.feet, language)} feet`);
    }
  }

  if (parsed.temperature) out.push(language === "es" ? `temperatura ${signedDigits(parsed.temperature, language)}` : `temperature ${signedDigits(parsed.temperature, language)}`);
  if (parsed.dewPoint) out.push(language === "es" ? `punto de rocío ${signedDigits(parsed.dewPoint, language)}` : `dew point ${signedDigits(parsed.dewPoint, language)}`);
  if (parsed.qnh) out.push(`Q N H ${digits(parsed.qnh, language)}`);

  return out;
}

function transitionPhrase(icao: string, language: Language) {
  const profile = AIRPORTS[icao.toUpperCase()];
  if (!profile?.transitionAltitude || !profile.transitionLevel) return "";
  return language === "es"
    ? `Altitud de transición ${numberWords(profile.transitionAltitude, language)} pies. Nivel de transición ${digits(profile.transitionLevel, language)}`
    : `Transition altitude ${numberWords(profile.transitionAltitude, language)} feet. Transition level ${digits(profile.transitionLevel, language)}`;
}

export function buildSpanishAtisSpeech(row: AtisSpeechData) {
  const parsed = parseMetar(row.metar);
  const primary = approachSpeech(row.approach_primary);
  const optional = approachSpeech(row.approach_optional);
  const rwy = runwaySpeech(row.runway, "es");

  const phrases = [
    `${airportName(row.airport_icao, "es")} ATIS información ${infoWord(row.info_letter, "es")}`,
    ...metarPhrases(parsed, "es"),
    `Aeronaves esperen aproximación ${primary}`,
    optional ? `O visual` : "",
    `Salidas y llegadas, pista ${rwy}`,
    transitionPhrase(row.airport_icao, "es"),
    "X P D R. Modo altitude. En todas las calles de rodaje y pistas en uso",
    `Notifique información ${infoWord(row.info_letter, "es")} en contacto inicial`,
  ];

  return phrases.filter(Boolean).join(". ") + ".";
}

export function buildEnglishAtisSpeech(row: AtisSpeechData) {
  const parsed = parseMetar(row.metar);
  const primary = approachSpeech(row.approach_primary);
  const optional = approachSpeech(row.approach_optional);
  const rwy = runwaySpeech(row.runway, "en");

  const phrases = [
    `${airportName(row.airport_icao, "en")} ATIS information ${infoWord(row.info_letter, "en")}`,
    ...metarPhrases(parsed, "en"),
    `Aircraft expect ${primary} approach`,
    optional ? `Or visual` : "",
    `Departures and arrivals, runway ${rwy}`,
    transitionPhrase(row.airport_icao, "en"),
    "X P D R. Altitude mode. On all taxiways and runways in use",
    `Advise information ${infoWord(row.info_letter, "en")} on initial contact`,
  ];

  return phrases.filter(Boolean).join(". ") + ".";
}
