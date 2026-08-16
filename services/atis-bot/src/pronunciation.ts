const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};

const DIGIT: Record<string, string> = {
  "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
  "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve",
};

function digits(value: string) {
  return value.split("").map((d) => DIGIT[d] ?? d).join(" ");
}

function spellIcao(value: string) {
  return value.split("").map((c) => NATO[c] ?? DIGIT[c] ?? c).join(" ");
}

export function prepareAtisForSpeech(input: string) {
  let text = input.toUpperCase();

  text = text.replace(/\[([A-Z]{4})\]/g, (_, icao: string) => spellIcao(icao));
  text = text.replace(/\bINFO\s+([A-Z])\b/g, (_, letter: string) => `información ${NATO[letter] ?? letter}`);
  text = text.replace(/\bQNH\s*(\d{3,4})\b/g, (_, n: string) => `Q N H ${digits(n)}`);
  text = text.replace(/\bRWY\s*(\d{1,2}[LRC]?)\b/g, (_, rwy: string) => `pista ${digits(rwy.replace(/[^0-9]/g, ""))}${rwy.match(/[LRC]/)?.[0] ? ` ${spellIcao(rwy.slice(-1))}` : ""}`);
  text = text.replace(/\bPISTA\s+(\d{1,2}[LRC]?)\b/g, (_, rwy: string) => `pista ${digits(rwy.replace(/[^0-9]/g, ""))}${rwy.match(/[LRC]/)?.[0] ? ` ${spellIcao(rwy.slice(-1))}` : ""}`);
  text = text.replace(/\b(\d{3})\/(\d{2})KT\b/g, (_, dir: string, speed: string) => `viento ${digits(dir)} grados, ${digits(speed)} nudos`);
  text = text.replace(/\bILS\b/g, "I L S");
  text = text.replace(/\bRNP\b/g, "R N P");
  text = text.replace(/\bXPDR\b/g, "transponder");
  text = text.replace(/\bRMK\b/g, "observaciones");
  text = text.replace(/\b(\d{2,4})\b/g, (_, n: string) => digits(n));
  text = text.replace(/\.\.\./g, ". ");
  text = text.replace(/[()[\]]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
