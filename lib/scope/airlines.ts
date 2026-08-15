export type AirlineCallsign = {
  name: string;
  icao: string;
  telephony: string;
  aliases?: string[];
};

// Catálogo entregado para Project Flight. Las entradas sin código/callsign definido
// se omiten deliberadamente para no inventar una normalización.
export const AIRLINE_CALLSIGNS: AirlineCallsign[] = [
  // Africa
  { name: "Air Mauritius", icao: "MAU", telephony: "AIR MAURITIUS" },
  { name: "Air Senegal", icao: "SNG", telephony: "SENEGAL AIR" },
  { name: "Air Tanzania", icao: "ATC", telephony: "TANZANIA" },
  { name: "Arik", icao: "ARA", telephony: "ARIK AIR" },
  { name: "EgyptAir", icao: "MSR", telephony: "EGYPTAIR" },
  { name: "Ethiopian Airlines", icao: "ETH", telephony: "ETHIOPIAN" },
  { name: "Jambojet", icao: "JJO", telephony: "JAMBO" },
  { name: "Kulula.com", icao: "KUL", telephony: "KULULA" },
  { name: "Mango Airlines", icao: "MNO", telephony: "BOANGO" },
  { name: "Royal Air Maroc", icao: "RAM", telephony: "ROYALAIR MAROC", aliases: ["ROYAL AIR MAROC"] },
  { name: "South African Airways", icao: "SAA", telephony: "SPRINGBOK" },
  { name: "TAAG Angola Airlines", icao: "DTA", telephony: "ANGOLA" },
  { name: "Tassili Airlines", icao: "DAH", telephony: "TASSILI" },

  // Asia
  { name: "Aero Mongolia", icao: "MNG", telephony: "AERO MONGOLIA" },
  { name: "Air Asia", icao: "AXM", telephony: "REDCAP" },
  { name: "Air Astana", icao: "KZR", telephony: "ASTANA" },
  { name: "Air China", icao: "CCA", telephony: "AIR CHINA" },
  { name: "Air India", icao: "AIC", telephony: "AIRINDIA", aliases: ["AIR INDIA"] },
  { name: "Air Manas", icao: "MBB", telephony: "AIR MANAS" },
  { name: "All Nippon Airways", icao: "ANA", telephony: "ALL NIPPON" },
  { name: "Asiana Airlines", icao: "AAR", telephony: "ASIANA" },
  { name: "Biman Bangladesh Airlines", icao: "BBC", telephony: "BANGLADESH" },
  { name: "Cathay Pacific", icao: "CPA", telephony: "CATHAY" },
  { name: "Cebu Pacific", icao: "CEB", telephony: "CEBU" },
  { name: "China Airlines", icao: "CAL", telephony: "DYNASTY" },
  { name: "China Eastern Airlines", icao: "CES", telephony: "CHINA EASTERN" },
  { name: "China Southern Airlines", icao: "CSN", telephony: "CHINA SOUTHERN" },
  { name: "Corendon Airlines", icao: "CAI", telephony: "CORENDON" },
  { name: "El Al", icao: "ELY", telephony: "EL AL", aliases: ["ELAL"] },
  { name: "Emirates", icao: "UAE", telephony: "EMIRATES" },
  { name: "Etihad Airways", icao: "ETD", telephony: "ETIHAD" },
  { name: "EVA Air", icao: "EVA", telephony: "EVA" },
  { name: "FlyErbil", icao: "ERB", telephony: "FLYERBIL", aliases: ["FLY ERBIL"] },
  { name: "Garuda Indonesia", icao: "GIA", telephony: "GARUDA" },
  { name: "Gulf Air", icao: "GFA", telephony: "GULF AIR" },
  { name: "Hainan Airlines", icao: "CHH", telephony: "HAINAN" },
  { name: "Iran Air", icao: "IRA", telephony: "IRAN AIR" },
  { name: "Iraqi Airways", icao: "IAQ", telephony: "IRAQI" },
  { name: "Japan Air Commuter", icao: "JAC", telephony: "COMMUTER" },
  { name: "Japan Airlines", icao: "JAL", telephony: "JAPANAIR", aliases: ["JAPAN AIR"] },
  { name: "Jeju Air", icao: "JJA", telephony: "JEJU AIR" },
  { name: "Juneyao Air", icao: "JNA", telephony: "JUNEYAO" },
  { name: "Korean Air", icao: "KAL", telephony: "KOREANAIR", aliases: ["KOREAN AIR"] },
  { name: "Kuwait Airways", icao: "KAC", telephony: "KUWAIT" },
  { name: "Malaysia Airlines", icao: "MAS", telephony: "MALAYSIAN" },
  { name: "MIAT Mongolian Airlines", icao: "MGL", telephony: "MONGOL AIR" },
  { name: "Middle East Airlines", icao: "MEA", telephony: "CEDAR JET" },
  { name: "Nok Air", icao: "NOK", telephony: "NOK AIR" },
  { name: "Oman Air", icao: "OMA", telephony: "OMAN AIR" },
  { name: "Pakistan International Airlines", icao: "PIA", telephony: "PAKISTAN" },
  { name: "PAL Express", icao: "GAP", telephony: "AIRPHIL" },
  { name: "Pegasus Airlines", icao: "PGT", telephony: "SUNTURK" },
  { name: "Philippine Airlines", icao: "PAL", telephony: "PHILIPPINE", aliases: ["PHILIPPINES"] },
  { name: "Qatar Airways", icao: "QTR", telephony: "QATARI" },
  { name: "Qazaq Air", icao: "QZQ", telephony: "QAZAQ AIR" },
  { name: "Riyadh Air", icao: "RXD", telephony: "RIYADH" },
  { name: "Royal Jordanian", icao: "RJA", telephony: "JORDANIAN" },
  { name: "Saudi Arabian Airlines", icao: "SVA", telephony: "SAUDIA" },
  { name: "Scoot", icao: "SCO", telephony: "SCOOTER" },
  { name: "Singapore Airlines", icao: "SIA", telephony: "SINGAPORE" },
  { name: "SpiceJet", icao: "SEJ", telephony: "SPICEJET" },
  { name: "Starlux Airlines", icao: "SJX", telephony: "STARLUX" },
  { name: "Thai Airways", icao: "THA", telephony: "THAI" },
  { name: "Thai Lion Air", icao: "LNI", telephony: "LION THAI" },
  { name: "Turkish Airlines", icao: "THY", telephony: "TURKISH" },
  { name: "Turkmenistan Airlines", icao: "TUA", telephony: "TURKMENISTAN" },
  { name: "US-Bangla Airlines", icao: "UBG", telephony: "US-BANGLA" },
  { name: "Vietnam Airlines", icao: "HVN", telephony: "VIETNAM" },
  { name: "Vistara", icao: "VTI", telephony: "VISTARA" },
  { name: "Xiamen Air", icao: "CXA", telephony: "XIA MEN", aliases: ["XIAMEN"] },

  // Europe
  { name: "Aegean Airlines", icao: "AEE", telephony: "AEGEAN" },
  { name: "Aeroflot", icao: "AFL", telephony: "AEROFLOT" },
  { name: "Aer Lingus", icao: "EIN", telephony: "SHAMROCK" },
  { name: "Air Albania", icao: "ABN", telephony: "AIR ALBANIA" },
  { name: "Air Austral", icao: "ESR", telephony: "AUSTRAL" },
  { name: "AirBaltic", icao: "BTI", telephony: "AIRBALTIC", aliases: ["AIR BALTIC"] },
  { name: "Air Berlin", icao: "BER", telephony: "AIR BERLIN" },
  { name: "Air Europa", icao: "AEA", telephony: "EUROPA" },
  { name: "Air France", icao: "AFR", telephony: "AIRFRANS", aliases: ["AIR FRANCE"] },
  { name: "Air Serbia", icao: "ASL", telephony: "AIR SERBIA" },
  { name: "AirUK", icao: "UKA", telephony: "AIR UK" },
  { name: "Alitalia", icao: "AZA", telephony: "ALITALIA" },
  { name: "Austrian Airlines", icao: "AUA", telephony: "AUSTRIAN" },
  { name: "Azerbaijan Airlines", icao: "AHY", telephony: "AZAL" },
  { name: "Azur Air", icao: "KTK", telephony: "KATEK" },
  { name: "Blue1", icao: "BLF", telephony: "BLUE FIN" },
  { name: "British Airways", icao: "BAW", telephony: "SPEEDBIRD" },
  { name: "British Midland International", icao: "BMI", telephony: "MIDLAND" },
  { name: "CityBird", icao: "BIR", telephony: "CITYBIRD" },
  { name: "Condor", icao: "CFG", telephony: "CONDOR" },
  { name: "Croatia Airlines", icao: "CTN", telephony: "CROATIA" },
  { name: "easyJet", icao: "EZY", telephony: "EASY" },
  { name: "Edelweiss", icao: "EDW", telephony: "EDELWEISS" },
  { name: "ETF Airways", icao: "ETF", telephony: "LIONESS" },
  { name: "Eurowings", icao: "EWG", telephony: "EUROWINGS" },
  { name: "Finnair", icao: "FIN", telephony: "FINNAIR" },
  { name: "FlyBosnia", icao: "FBI", telephony: "FLYBOSNIA", aliases: ["FLY BOSNIA"] },
  { name: "Frenchbee", icao: "FBU", telephony: "FRENCH BEE", aliases: ["FRENCHBEE"] },
  { name: "Germania", icao: "GMI", telephony: "GERMANIA" },
  { name: "Helvetic Airways", icao: "OAW", telephony: "HELVETIC" },
  { name: "Iberia", icao: "IBE", telephony: "IBERIA" },
  { name: "Iceland Air", icao: "ICE", telephony: "ICEAIR", aliases: ["ICELAND AIR"] },
  { name: "ITA Airways", icao: "ITY", telephony: "ITARROW" },
  { name: "Jet2.com", icao: "EXS", telephony: "CHANNEX" },
  { name: "JetAirFly", icao: "JAF", telephony: "BEAUTY" },
  { name: "KLM", icao: "KLM", telephony: "KLM" },
  { name: "La Compagnie", icao: "DJT", telephony: "DREAMJET" },
  { name: "LOT Polish Airlines", icao: "LOT", telephony: "LOT" },
  { name: "LTU International", icao: "LTU", telephony: "LTU" },
  { name: "Lufthansa", icao: "DLH", telephony: "LUFTHANSA" },
  { name: "Luxair", icao: "LGL", telephony: "LUXAIR" },
  { name: "MALÉV", icao: "MAH", telephony: "MALEV" },
  { name: "Neos", icao: "NOS", telephony: "NEOS" },
  { name: "Norse Atlantic Airways", icao: "NBT", telephony: "NORSE" },
  { name: "Norwegian Air Shuttle", icao: "NAX", telephony: "NORSHUTTLE" },
  { name: "Olympic Airlines", icao: "OAL", telephony: "OLYMPIC" },
  { name: "PGA Portugalia Airlines", icao: "PGA", telephony: "PORTUGALIA" },
  { name: "Quantum Air", icao: "QNT", telephony: "QUANTUM" },
  { name: "Ryanair", icao: "RYR", telephony: "RYANAIR" },
  { name: "S7 Airlines", icao: "SBI", telephony: "SIBERIAN" },
  { name: "Sabena", icao: "SBN", telephony: "SABENA" },
  { name: "SATA Internacional", icao: "SAT", telephony: "SATA" },
  { name: "Scandinavian Airlines", icao: "SAS", telephony: "SCANDINAVIAN" },
  { name: "Spanair", icao: "JKK", telephony: "SPANAIR" },
  { name: "SWISS", icao: "SWR", telephony: "SWISS" },
  { name: "TAP Air Portugal", icao: "TAP", telephony: "AIR PORTUGAL" },
  { name: "TAROM", icao: "ROT", telephony: "TAROM" },
  { name: "TUI Airways", icao: "TOM", telephony: "TOMJET" },
  { name: "Ukraine International Airlines", icao: "AUI", telephony: "UKRAINE INTERNATIONAL" },
  { name: "Virgin Atlantic", icao: "VIR", telephony: "VIRGIN" },
  { name: "Volotea", icao: "VOE", telephony: "VOLOTEA" },
  { name: "Vueling", icao: "VLG", telephony: "VUELING" },
  { name: "West Atlantic Airlines", icao: "SWN", telephony: "SWEDEX" },
  { name: "Widerøe", icao: "WIF", telephony: "WIDEROE" },
  { name: "Wizz Air", icao: "WZZ", telephony: "WIZZAIR", aliases: ["WIZZ AIR"] },
  { name: "World2Fly", icao: "WFL", telephony: "BLUE WORLD" },
  { name: "Wow Air", icao: "WOW", telephony: "WOW AIR" },

  // North America
  { name: "Aeroméxico", icao: "AMX", telephony: "AEROMEXICO" },
  { name: "Air Canada", icao: "ACA", telephony: "AIR CANADA" },
  { name: "Air Caraïbes", icao: "CAY", telephony: "AIRCARAIRES", aliases: ["AIR CARAIRES", "AIR CARAIBES"] },
  { name: "Air Greenland", icao: "GRL", telephony: "GREENLAND" },
  { name: "Air Panama", icao: "PNV", telephony: "AIR PANAMA" },
  { name: "AirTran Airways", icao: "TRS", telephony: "CRITTER" },
  { name: "Air Transat", icao: "TSC", telephony: "TRANSAT" },
  { name: "Air Transport International", icao: "ATI", telephony: "AIR TRANSPORT" },
  { name: "Alaska Airlines", icao: "ASA", telephony: "ALASKA" },
  { name: "Allegiant Air", icao: "AAY", telephony: "ALLEGIANT" },
  { name: "American Airlines", icao: "AAL", telephony: "AMERICAN" },
  { name: "Breeze Airways", icao: "NZM", telephony: "BREEZE" },
  { name: "Canadian North", icao: "MPE", telephony: "EMPRESS" },
  { name: "Chrono Aviation", icao: "NDL", telephony: "NEEDLE" },
  { name: "Copa Airlines", icao: "CMP", telephony: "COPA" },
  { name: "Delta Air Lines", icao: "DAL", telephony: "DELTA" },
  { name: "Eastern Airlines", icao: "EAL", telephony: "EASTERN" },
  { name: "Flair Airlines", icao: "FLE", telephony: "FLAIR" },
  { name: "Frontier Airlines", icao: "FFT", telephony: "FRONTIER FLIGHT" },
  { name: "Hawaiian Airlines", icao: "HAL", telephony: "HAWAIIAN" },
  { name: "Inter-Canadian", icao: "ICA", telephony: "INTER-CANADIAN" },
  { name: "JetBlue", icao: "JBU", telephony: "JETBLUE" },
  { name: "Key Lime Air", icao: "KLA", telephony: "KEY LIME" },
  { name: "Mexicana", icao: "MXA", telephony: "MEXICANA" },
  { name: "National Airlines", icao: "NCR", telephony: "NATIONAL" },
  { name: "Northwest Airlines", icao: "NWA", telephony: "NORTHWEST" },
  { name: "OWG", icao: "NDL", telephony: "OFF WE GO" },
  { name: "Pacific Southwest Airlines", icao: "PSC", telephony: "BLUE STREAK" },
  { name: "Porter Airlines", icao: "POE", telephony: "PORTER" },
  { name: "Propair", icao: "PRO", telephony: "PROPAIR" },
  { name: "Sky Cana", icao: "CEY", telephony: "CENTURY" },
  { name: "Southwest Airlines", icao: "SWA", telephony: "SOUTHWEST" },
  { name: "Spirit Airlines", icao: "NKS", telephony: "SPIRIT WINGS" },
  { name: "Sunwing", icao: "SWG", telephony: "SUNWING" },
  { name: "Trans World Airlines", icao: "TWA", telephony: "TWA" },
  { name: "United Airlines", icao: "UAL", telephony: "UNITED" },
  { name: "US Airways", icao: "USA", telephony: "CACTUS" },
  { name: "WestJet", icao: "WJA", telephony: "WESTJET" },

  // Australia / Oceania
  { name: "Air New Zealand", icao: "ANZ", telephony: "NEW ZEALAND" },
  { name: "Air Niugini", icao: "ANG", telephony: "NIUGINI" },
  { name: "Air Tahiti Nui", icao: "THT", telephony: "TAHITI" },
  { name: "Air Vanuatu", icao: "AVN", telephony: "AIR VANUATU" },
  { name: "Alliance Airlines", icao: "FQZ", telephony: "ALLIANCE" },
  { name: "Fiji Airways", icao: "FJI", telephony: "FIJI" },
  { name: "JetStar", icao: "JST", telephony: "JETSTAR" },
  { name: "Link Airways", icao: "KAG", telephony: "LINK" },
  { name: "Qantas", icao: "QFA", telephony: "QANTAS" },
  { name: "Sharp Airlines", icao: "SHA", telephony: "SHARP" },
  { name: "Virgin Australia", icao: "VOZ", telephony: "VELOCITY" },
  { name: "Regional Express (REX)", icao: "RXA", telephony: "REX" },
  { name: "QantasLink", icao: "QFA", telephony: "QANTAS", aliases: ["QLINK"] },

  // South America
  { name: "Aeroperú", icao: "PLI", telephony: "AEROPERU" },
  { name: "Avianca", icao: "AVA", telephony: "AVIANCA" },
  { name: "Azul Linhas Aéreas Brasileiras", icao: "AZU", telephony: "AZUL" },
  { name: "GOL Linhas Aéreas", icao: "GLO", telephony: "GOL" },
  { name: "Itapemirim Transportes Aereos", icao: "IPN", telephony: "ITAPEMIRIM" },
  { name: "LAN Airlines", icao: "LAN", telephony: "LAN" },
  { name: "LATAM Airlines", icao: "LAN", telephony: "LATAM" },
  { name: "Star Perú", icao: "SPQ", telephony: "STAR PERU" },
  { name: "TAM Brasil", icao: "TAM", telephony: "TAM" },
  { name: "Varig", icao: "VRG", telephony: "VARIG" },

  // Cargo
  { name: "Air Hong Kong", icao: "AHK", telephony: "AIR HONG KONG" },
  { name: "World Cargo Airlines", icao: "WCM", telephony: "WORLD CARGO" },
  { name: "DHL", icao: "BCS", telephony: "WORLD EXPRESS" },
  { name: "Martinair", icao: "MPH", telephony: "MARTINAIR" },
  { name: "Monarch Airlines", icao: "MON", telephony: "MONARCH" },
  { name: "Zorex Air Transport", icao: "ZOR", telephony: "ZOREX" },
  { name: "Ameriflight", icao: "AMF", telephony: "AMERIFLIGHT" },
  { name: "Amerijet", icao: "AJT", telephony: "AMERIJET" },
  { name: "CargoJet", icao: "CJT", telephony: "CARGOJET" },
  { name: "FedEx Express", icao: "FDX", telephony: "FEDEX" },
  { name: "Perimeter Aviation Cargo", icao: "PAG", telephony: "PERIMETER" },
  { name: "Sky Lease Cargo", icao: "KYE", telephony: "SKYLEASE" },
  { name: "UPS Airlines", icao: "UPS", telephony: "UPS" },
  { name: "Western Global Airlines", icao: "WGN", telephony: "WESTERN GLOBAL" },
  { name: "Aerosucre", icao: "ASV", telephony: "AEROSUCRE" },
  { name: "TOLL", icao: "TOL", telephony: "TOLL" },

  // Military
  { name: "Royal Saudi Air Force", icao: "RSAF", telephony: "SAUDI AIR FORCE" },
  { name: "Austrian Air Force", icao: "ASF", telephony: "AUSTRIAN AIR FORCE" },
  { name: "German Air Force", icao: "GAF", telephony: "GERMAN AIR FORCE" },
  { name: "Italian Air Force", icao: "IAM", telephony: "ITALIAN AIR FORCE" },
  { name: "Royal Air Force (UK)", icao: "RRF", telephony: "RAF" },
  { name: "United States Air Force", icao: "RCH", telephony: "REACH", aliases: ["SNOOP"] },
  { name: "Royal Canadian Air Force", icao: "CFC", telephony: "CANFORCE" },
  { name: "Royal New Zealand Air Force", icao: "NZK", telephony: "KIWI" },
  { name: "Colombian Air Force", icao: "FAC", telephony: "FUERZA AEREA COLOMBIANA" },

  // Manufacturers
  { name: "Airbus", icao: "AIB", telephony: "AIRBUS" },
  { name: "Boeing", icao: "BOE", telephony: "BOEING" },
  { name: "Bombardier", icao: "BVR", telephony: "BOMBARDIER" },
  { name: "Cessna", icao: "CES", telephony: "CESSNA" },
];

function compactToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

type PrefixEntry = { prefix: string; airline: AirlineCallsign };

const PREFIXES: PrefixEntry[] = AIRLINE_CALLSIGNS.flatMap((airline) => {
  const values = new Set([airline.telephony, airline.name, ...(airline.aliases ?? [])]);
  return Array.from(values)
    .map((value) => compactToken(value))
    .filter((prefix) => prefix.length >= 3)
    .map((prefix) => ({ prefix, airline }));
}).sort((a, b) => b.prefix.length - a.prefix.length);

const ICAO_SET = new Set(AIRLINE_CALLSIGNS.map((airline) => airline.icao));
const PRIMARY_BY_ICAO = new Map<string, AirlineCallsign>();
for (const airline of AIRLINE_CALLSIGNS) {
  if (!PRIMARY_BY_ICAO.has(airline.icao)) PRIMARY_BY_ICAO.set(airline.icao, airline);
}

function matchingAirline(raw: string, expectedIcao?: string) {
  const compact = compactToken(raw);
  return PREFIXES.find(({ prefix, airline }) =>
    (!expectedIcao || airline.icao === expectedIcao) && compact.startsWith(prefix),
  )?.airline;
}

export function normalizeAirlineCallsign(raw: string) {
  const compact = compactToken(raw);
  if (!compact) return "";

  const direct = compact.match(/^([A-Z]{3,4})([A-Z0-9]+)$/);
  if (direct && ICAO_SET.has(direct[1])) return compact;

  const match = PREFIXES.find(({ prefix }) => compact.startsWith(prefix));
  if (!match) return compact;

  const suffix = compact.slice(match.prefix.length);
  return suffix ? `${match.airline.icao}${suffix}` : match.airline.icao;
}

export function spokenAirlineCallsign(shortCallsign: string, rawCallsign?: string) {
  const compact = compactToken(shortCallsign);
  const match = compact.match(/^([A-Z]{3,4})([A-Z0-9]+)$/);
  if (!match) return shortCallsign;

  const [, icao, suffix] = match;
  const fromRaw = rawCallsign ? matchingAirline(rawCallsign, icao) : undefined;
  const airline = fromRaw ?? PRIMARY_BY_ICAO.get(icao);
  return `${airline?.telephony ?? icao} ${suffix}`;
}
