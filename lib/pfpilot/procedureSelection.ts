export type PFPilotProcedureSelection = {
  sid: string;
  star: string;
  approach: string;
};

const MARKER = "[PF24_PROCEDURES]";
const EMPTY_SELECTION: PFPilotProcedureSelection = {
  sid: "",
  star: "",
  approach: "",
};

function cleanToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function getPFPilotProcedureSelection(notes: unknown): PFPilotProcedureSelection {
  const text = String(notes ?? "");
  const line = text
    .split(/\r?\n/)
    .find((item) => item.trim().toUpperCase().startsWith(MARKER));
  if (!line) return { ...EMPTY_SELECTION };

  const fields = line
    .slice(line.toUpperCase().indexOf(MARKER) + MARKER.length)
    .split(";")
    .reduce<Record<string, string>>((acc, item) => {
      const [rawKey, ...rawValue] = item.split("=");
      const key = String(rawKey ?? "").trim().toUpperCase();
      if (!key) return acc;
      acc[key] = cleanToken(rawValue.join("="));
      return acc;
    }, {});

  return {
    sid: fields.SID ?? "",
    star: fields.STAR ?? "",
    approach: fields.APPR ?? "",
  };
}

export function setPFPilotProcedureSelectionInNotes(
  notes: unknown,
  selection: PFPilotProcedureSelection,
) {
  const retained = String(notes ?? "")
    .split(/\r?\n/)
    .filter((item) => !item.trim().toUpperCase().startsWith(MARKER))
    .join("\n")
    .trimEnd();

  const normalized = {
    sid: cleanToken(selection.sid),
    star: cleanToken(selection.star),
    approach: cleanToken(selection.approach),
  };
  const hasSelection = normalized.sid || normalized.star || normalized.approach;
  if (!hasSelection) return retained || null;

  const metadata = `${MARKER} SID=${normalized.sid};STAR=${normalized.star};APPR=${normalized.approach}`;
  return retained ? `${retained}\n${metadata}` : metadata;
}

export function routeWithPFPilotProcedureSelection(route: unknown, notes: unknown) {
  const selection = getPFPilotProcedureSelection(notes);
  return [route, selection.sid, selection.star, selection.approach]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
