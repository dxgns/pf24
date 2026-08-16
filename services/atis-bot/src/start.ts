const ATIS_AIRPORTS = [
  "MDPC",
  "MDST",
  "LCLK",
  "LCPH",
  "LEMH",
  "GCLP",
  "EGKK",
  "EGHI",
  "EFKT",
] as const;

function slot(number: number) {
  return String(number).padStart(2, "0");
}

for (const [index, airport] of ATIS_AIRPORTS.entries()) {
  const key = slot(index + 1);
  process.env[`ATIS_${key}_AIRPORT`] ??= airport;
}

// MDAB and LCRA do not have PF24 voice ATIS bots. Slots above 09 are disabled
// even if stale Railway variables remain from the previous 11-bot layout.
for (const number of [10, 11]) {
  const key = slot(number);
  delete process.env[`ATIS_${key}_TOKEN`];
  delete process.env[`ATIS_${key}_CHANNEL_ID`];
  delete process.env[`ATIS_${key}_AIRPORT`];
}

await import("./index.js");
