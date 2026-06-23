export function getDefaultTransponder(flightRules: string) {
  return flightRules === "VFR" || flightRules === "ZFR" ? "7000" : "2000";
}