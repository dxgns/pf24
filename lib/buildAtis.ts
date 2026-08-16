export function buildAtisText({
  airport,
  info,
  metar,
  approachPrimary,
  approachOptional,
  departureRunway,
  arrivalRunway,
  extraInfo,
  remarks,
}: {
  airport: string;
  info: string;
  metar: string;
  approachPrimary: string;
  approachOptional?: string;
  departureRunway: string;
  arrivalRunway: string;
  extraInfo?: string;
  remarks?: string;
}) {
  const optionalApproach = approachOptional ? ` O ${approachOptional}` : "";
  const extra = extraInfo ? ` ${extraInfo}` : "";
  const rmk = remarks ? ` RMK: ${remarks}` : "";

  return `[${airport}] ATIS INFO ${info}... (${metar})... AERONAVES ESPEREN APPR ${approachPrimary}${optionalApproach} SALIDAS PISTA ${departureRunway} LLEGADAS PISTA ${arrivalRunway} XPDR MODO ALT EN TODAS LAS CALLES DE RODAJE Y PISTAS EN USO... NOTIFIQUE INFO ${info} EN CONTACTO INICIAL${extra}${rmk}`;
}
