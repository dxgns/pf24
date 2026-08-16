const NATO_ES: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};
const NATO_EN: Record<string, string> = { ...NATO_ES, A: "Alpha" };
const DIGIT_ES: Record<string, string> = { "0":"cero","1":"uno","2":"dos","3":"tres","4":"cuatro","5":"cinco","6":"seis","7":"siete","8":"ocho","9":"nueve" };
const DIGIT_EN: Record<string, string> = { "0":"zero","1":"one","2":"two","3":"three","4":"four","5":"five","6":"six","7":"seven","8":"eight","9":"nine" };

type AirportProfile = {
  es: string;
  en: string;
  transitionAltitude?: number;
};

const AIRPORTS: Record<string, AirportProfile> = {
  MDPC: { es: "Aeropuerto Internacional de Punta Cana", en: "Punta Cana International Airport", transitionAltitude: 3000 },
  MDST: { es: "Aeropuerto Internacional del Cibao", en: "Cibao International Airport", transitionAltitude: 3000 },
  MDAB: { es: "Aeropuerto de Arroyo Barril", en: "Arroyo Barril Airport" },
  LCLK: { es: "Aeropuerto Internacional de Lárnaca", en: "Larnaka International Airport", transitionAltitude: 8000 },
  LCPH: { es: "Aeropuerto Internacional de Pafos", en: "Pafos International Airport", transitionAltitude: 8000 },
  LCRA: { es: "RAF Akrotiri", en: "RAF Akrotiri" },
  EGKK: { es: "Aeropuerto de Londres Gatwick", en: "London Gatwick Airport", transitionAltitude: 6000 },
  EGHI: { es: "Aeropuerto de Southampton", en: "Southampton Airport", transitionAltitude: 6000 },
  LEMH: { es: "Aeropuerto de Menorca", en: "Menorca Airport", transitionAltitude: 6000 },
  GCLP: { es: "Aeropuerto de Gran Canaria", en: "Gran Canaria Airport", transitionAltitude: 6000 },
  EFKT: { es: "Aeropuerto de Kittilä", en: "Kittilä Airport", transitionAltitude: 5000 },
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
  day?: string; time?: string; windDirection?: string; windSpeed?: string; windGust?: string;
  windVariableFrom?: string; windVariableTo?: string;
  cavok?: boolean;
  visibility?: string; clouds: Array<{ cover: string; feet?: number }>;
  temperature?: string; dewPoint?: string; qnh?: string;
};

function digits(value: string, language: Language) {
  const map = language === "es" ? DIGIT_ES : DIGIT_EN;
  return value.split("").map((d) => map[d] ?? d).join(", ");
}
function infoWord(letter: string, language: Language) {
  const map = language === "es" ? NATO_ES : NATO_EN;
  return map[letter.toUpperCase()] ?? letter;
}
function airportName(icao: string, language: Language) {
  const p = AIRPORTS[icao.toUpperCase()];
  if (p) return language === "es" ? p.es : p.en;
  const map = language === "es" ? NATO_ES : NATO_EN;
  return icao.toUpperCase().split("").map((c) => map[c] ?? c).join(" ");
}

function normalizeSingleRunway(raw: string) {
  const value = raw.toUpperCase().trim();
  const m = value.match(/(\d{1,2})([LRC]?)/);
  return m ? `${m[1].padStart(2, "0")}${m[2] ?? ""}` : value;
}

function splitRunways(raw: string) {
  const value = raw.toUpperCase().trim();
  const dep = value.match(/DEP\s+(\d{1,2}[LRC]?)/)?.[1];
  const arr = value.match(/ARR\s+(\d{1,2}[LRC]?)/)?.[1];
  if (dep || arr) {
    const departure = normalizeSingleRunway(dep ?? arr ?? value);
    const arrival = normalizeSingleRunway(arr ?? dep ?? value);
    return { departure, arrival };
  }

  const one = normalizeSingleRunway(value);
  return { departure: one, arrival: one };
}

function runwaySpeech(raw: string, language: Language) {
  const value = normalizeSingleRunway(raw);
  const m = value.match(/^(\d{2})([LRC]?)$/);
  if (!m) return value;
  const sideEs: Record<string,string> = { L:"izquierda", R:"derecha", C:"centro" };
  const sideEn: Record<string,string> = { L:"left", R:"right", C:"center" };
  const side = m[2] ? ` ${(language === "es" ? sideEs : sideEn)[m[2]]}` : "";
  return `${digits(m[1], language)}${side}`;
}

function approachSpeech(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/RNP/g,"R N P").replace(/ILS/g,"I L S").replace(/VISUAL/g,"visual").trim();
}

function parseMetar(input: string): ParsedMetar {
  const out: ParsedMetar = { clouds: [] };
  for (const token of input.toUpperCase().trim().split(/\s+/).filter(Boolean)) {
    const t = token.match(/^(\d{2})(\d{2})(\d{2})Z$/);
    if (t) { out.day=t[1]; out.time=`${t[2]}${t[3]}`; continue; }
    const w = token.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/);
    if (w) { out.windDirection=w[1]; out.windSpeed=w[2]; out.windGust=w[3]; continue; }
    const variableWind = token.match(/^(\d{3})V(\d{3})$/);
    if (variableWind) { out.windVariableFrom=variableWind[1]; out.windVariableTo=variableWind[2]; continue; }
    if (token === "CAVOK") { out.cavok = true; continue; }
    if (/^\d{4}$/.test(token)) { out.visibility=token; continue; }
    const c = token.match(/^(FEW|SCT|BKN|OVC)(\d{3})/);
    if (c) { out.clouds.push({ cover:c[1], feet:Number(c[2])*100 }); continue; }
    const temp = token.match(/^(M?\d{2})\/(M?\d{2})$/);
    if (temp) { out.temperature=temp[1]; out.dewPoint=temp[2]; continue; }
    const q = token.match(/^Q(\d{4})$/);
    if (q) out.qnh=q[1];
  }
  return out;
}

function numberWordsEs(n: number): string {
  if (n === 100) return "cien";
  if (n < 30) return ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve","veinte","veintiuno","veintidós","veintitrés","veinticuatro","veinticinco","veintiséis","veintisiete","veintiocho","veintinueve"][n];
  if (n < 100) { const t=["","","","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"]; const a=Math.floor(n/10), b=n%10; return b?`${t[a]} y ${numberWordsEs(b)}`:t[a]; }
  if (n < 1000) { const a=Math.floor(n/100), b=n%100; const h=a===1?"ciento":["","","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"][a]; return b?`${h} ${numberWordsEs(b)}`:h; }
  if (n < 1_000_000) { const a=Math.floor(n/1000), b=n%1000; const h=a===1?"mil":`${numberWordsEs(a)} mil`; return b?`${h} ${numberWordsEs(b)}`:h; }
  return String(n);
}
function numberWordsEn(n: number): string {
  if (n < 20) return ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"][n];
  if (n < 100) { const t=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"]; const a=Math.floor(n/10), b=n%10; return b?`${t[a]} ${numberWordsEn(b)}`:t[a]; }
  if (n < 1000) { const a=Math.floor(n/100), b=n%100; return b?`${numberWordsEn(a)} hundred ${numberWordsEn(b)}`:`${numberWordsEn(a)} hundred`; }
  if (n < 1_000_000) { const a=Math.floor(n/1000), b=n%1000; return b?`${numberWordsEn(a)} thousand ${numberWordsEn(b)}`:`${numberWordsEn(a)} thousand`; }
  return String(n);
}
function numberWords(n:number, language:Language) { return language === "es" ? numberWordsEs(n) : numberWordsEn(n); }
function signedDigits(value:string|undefined, language:Language) {
  if (!value) return "";
  const negative=value.startsWith("M"), raw=value.replace(/^M/,"");
  return `${negative ? (language === "es" ? "menos, " : "minus, ") : ""}${digits(raw,language)}`;
}

function metarPhrases(parsed: ParsedMetar, language: Language) {
  const out:string[]=[];
  if (parsed.day && parsed.time) out.push(`${digits(parsed.day,language)}, ${digits(parsed.time,language)} Zulu`);
  if (parsed.windDirection && parsed.windSpeed) {
    const dir=parsed.windDirection==="VRB"?"variable":`${digits(parsed.windDirection,language)}, ${language==="es"?"grados":"degrees"}`;
    let wind=language==="es"?`viento, ${dir}, ${digits(parsed.windSpeed,language)}, nudos`:`wind, ${dir}, ${digits(parsed.windSpeed,language)}, knots`;
    if (parsed.windGust) wind += language==="es"?`, rachas, ${digits(parsed.windGust,language)}, nudos`:` , gusting, ${digits(parsed.windGust,language)}, knots`;
    if (parsed.windVariableFrom && parsed.windVariableTo) {
      wind += language === "es"
        ? `, variable entre, ${digits(parsed.windVariableFrom,language)}, y, ${digits(parsed.windVariableTo,language)}, grados`
        : `, variable between, ${digits(parsed.windVariableFrom,language)}, and, ${digits(parsed.windVariableTo,language)}, degrees`;
    }
    out.push(wind);
  }
  if (parsed.cavok) {
    out.push(language === "es" ? "C A V O K" : "CAVOK");
  } else {
    if (parsed.visibility) out.push(parsed.visibility==="9999"?(language==="es"?"visibilidad mayor a diez kilómetros":"visibility greater than ten kilometers"):(language==="es"?`visibilidad, ${digits(parsed.visibility,language)}, metros`:`visibility, ${digits(parsed.visibility,language)}, meters`));
    const coversEs:Record<string,string>={FEW:"nubes escasas",SCT:"nubes dispersas",BKN:"nubes rotas",OVC:"cielo cubierto"};
    const coversEn:Record<string,string>={FEW:"few clouds",SCT:"scattered clouds",BKN:"broken clouds",OVC:"overcast"};
    for (const cloud of parsed.clouds) if (cloud.feet) {
      const label=(language==="es"?coversEs:coversEn)[cloud.cover]??cloud.cover;
      out.push(language==="es"?`${label} a ${numberWords(cloud.feet,language)} pies`:`${label} at ${numberWords(cloud.feet,language)} feet`);
    }
  }
  if (parsed.temperature) out.push(language==="es"?`temperatura, ${signedDigits(parsed.temperature,language)}, grados`:`temperature, ${signedDigits(parsed.temperature,language)}, degrees`);
  if (parsed.dewPoint) out.push(language==="es"?`punto de rocío, ${signedDigits(parsed.dewPoint,language)}, grados`:`dew point, ${signedDigits(parsed.dewPoint,language)}, degrees`);
  if (parsed.qnh) out.push(`Q N H, ${digits(parsed.qnh,language)}`);
  return out;
}

function calculateTransitionLevel(transitionAltitude: number, qnh?: string) {
  const qnhValue = Number(qnh ?? "1013");
  const pressureOffsetFeet = (qnhValue - 1013.25) * 27;
  const minimumPressureAltitude = transitionAltitude + 1000 - pressureOffsetFeet;
  const flightLevel = Math.max(10, Math.ceil(minimumPressureAltitude / 1000) * 10);
  return String(flightLevel).padStart(3, "0");
}

function transitionPhrase(icao:string, parsed:ParsedMetar, language:Language) {
  const p=AIRPORTS[icao.toUpperCase()];
  if (!p?.transitionAltitude) return "";
  const transitionLevel = calculateTransitionLevel(p.transitionAltitude, parsed.qnh);
  return language==="es"
    ? `Altitud de transición ${numberWords(p.transitionAltitude,language)} pies. Nivel de transición, ${digits(transitionLevel,language)}`
    : `Transition altitude ${numberWords(p.transitionAltitude,language)} feet. Transition level, ${digits(transitionLevel,language)}`;
}

function remarksPhrase(value: string | null | undefined, language: Language) {
  const remarks = (value ?? "").trim();
  if (!remarks) return "";
  return language === "es" ? `Observaciones. ${remarks}` : `Remarks. ${remarks}`;
}

export function buildSpanishAtisSpeech(row: AtisSpeechData) {
  const parsed=parseMetar(row.metar), primary=approachSpeech(row.approach_primary), optional=approachSpeech(row.approach_optional);
  const runways=splitRunways(row.runway);
  const dep=runwaySpeech(runways.departure,"es"), arr=runwaySpeech(runways.arrival,"es");
  return [
    `${airportName(row.airport_icao,"es")} ATIS información ${infoWord(row.info_letter,"es")}`,
    ...metarPhrases(parsed,"es"),
    `Aeronaves esperen aproximación ${primary}`,
    optional ? `O ${optional}` : "",
    `Salidas pista, ${dep}`,
    `Llegadas pista, ${arr}`,
    transitionPhrase(row.airport_icao,parsed,"es"),
    "X P D R. Modo altitude. En todas las calles de rodaje y pistas en uso",
    remarksPhrase(row.remarks,"es"),
    `Notifique información ${infoWord(row.info_letter,"es")} en contacto inicial`,
  ].filter(Boolean).join(". ")+".";
}

export function buildEnglishAtisSpeech(row: AtisSpeechData, translatedRemarks?: string | null) {
  const parsed=parseMetar(row.metar), primary=approachSpeech(row.approach_primary), optional=approachSpeech(row.approach_optional);
  const runways=splitRunways(row.runway);
  const dep=runwaySpeech(runways.departure,"en"), arr=runwaySpeech(runways.arrival,"en");
  return [
    `${airportName(row.airport_icao,"en")} ATIS information ${infoWord(row.info_letter,"en")}`,
    ...metarPhrases(parsed,"en"),
    `Aircraft expect ${primary} approach`,
    optional ? `Or ${optional}` : "",
    `Departures runway, ${dep}`,
    `Arrivals runway, ${arr}`,
    transitionPhrase(row.airport_icao,parsed,"en"),
    "X P D R. Altitude mode. On all taxiways and runways in use",
    remarksPhrase(translatedRemarks !== undefined ? translatedRemarks : row.remarks,"en"),
    `Advise information ${infoWord(row.info_letter,"en")} on initial contact`,
  ].filter(Boolean).join(". ")+".";
}