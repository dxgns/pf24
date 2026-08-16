export function buildAtisText({
  airport,
  info,
  metar,
  approachPrimary,
  approachOptional,
  departureRunway,
  arrivalRunway,
  transitionAltitude,
  transitionLevel,
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
  transitionAltitude?: string;
  transitionLevel?: string;
  extraInfo?: string;
  remarks?: string;
}) {
  const optionalApproach = approachOptional ? ` O ${approachOptional}` : "";
  const transition = transitionAltitude && transitionLevel
    ? ` TRANS ALT ${transitionAltitude} TRANS LVL ${transitionLevel}`
    : "";
  const extra = extraInfo ? ` ${extraInfo}` : "";
  const rmk = remarks ? ` RMK: ${remarks}` : "";

  return `[${airport}] ATIS INFO ${info}... (${metar})... AERONAVES ESPEREN APPR ${approachPrimary}${optionalApproach} SALIDAS PISTA ${departureRunway} LLEGADAS PISTA ${arrivalRunway}${transition} XPDR MODO ALT EN TODAS LAS CALLES DE RODAJE Y PISTAS EN USO... NOTIFIQUE INFO ${info} EN CONTACTO INICIAL${extra}${rmk}`;
}
