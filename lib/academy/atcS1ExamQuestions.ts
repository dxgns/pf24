export type AtcS1ExamQuestion = {
  id: string;
  prompt: string;
  type: "single" | "multiple";
  options: { value: string; label: string }[];
  correctAnswers: string[];
  points: 0 | 1;
  needsReferenceImage?: boolean;
};

export const ATC_S1_EXAM_PASSING_SCORE = 16;
export const ATC_S1_EXAM_TOTAL_SCORE = 20;

export const ATC_S1_EXAM_QUESTIONS: AtcS1ExamQuestion[] = [
  {
    id: "q1",
    prompt: "¿Qué es un METAR?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Un informe que indica la trayectoria de vuelo autorizada para cada aeronave." },
      { value: "b", label: "Un reporte meteorológico de rutina emitido regularmente desde un aeropuerto." },
      { value: "c", label: "Un mensaje de emergencia transmitido por una aeronave." },
      { value: "d", label: "Un tipo de plan de vuelo que se presenta antes de la salida." },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q2",
    prompt: "¿Cuál es la diferencia entre QNH y QNE?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "QNH es la presión estándar y QNE la presión local." },
      { value: "b", label: "QNH es la altitud sobre el nivel medio del mar, QNE es la altitud sobre el terreno." },
      { value: "c", label: "QNH es la presión local utilizada por debajo de la altitud de transición, QNE es la presión estándar (1013 hPa) usada por encima de la altitud de transición." },
      { value: "d", label: "QNH y QNE significan lo mismo, solo varía el idioma." },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q3",
    prompt: "Seleccione todos los elementos que se comunican en un ATIS.",
    type: "multiple",
    points: 1,
    options: [
      { value: "a", label: "QNH" },
      { value: "b", label: "Hora zulu" },
      { value: "c", label: "Número de identificación de ATIS" },
      { value: "d", label: "Pistas activas" },
      { value: "e", label: "Información sobre demoras ATC o slots específicos." },
      { value: "f", label: "Calles de rodaje activas" },
      { value: "g", label: "QNE" },
      { value: "h", label: "Número de stand o gate asignado." },
      { value: "i", label: "Procedimientos activos" },
      { value: "j", label: "Vientos" },
    ],
    correctAnswers: ["a", "b", "d", "i", "j"],
  },
  {
    id: "q4",
    prompt: "Si el viento es 230°/12KT, ¿qué pista sería la preferida en un aeropuerto con pistas 09/27?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "09" },
      { value: "b", label: "27" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q5",
    prompt: "Se despega con los vientos de cola.",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Verdadero" },
      { value: "b", label: "Falso" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q6",
    prompt: "¿Qué sucede si hay pistas paralelas y una se encuentra cerrada?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Se cancelan todas las operaciones hasta que se habilite nuevamente la pista." },
      { value: "b", label: "Las operaciones se desvían a otros aeropuertos obligatoriamente." },
      { value: "c", label: "Se utiliza la pista paralela restante para despegues y aterrizajes." },
      { value: "d", label: "Se despega igual desde la pista cerrada con autorización especial." },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q7",
    prompt: "¿Puede GND autorizar el cruce de una aeronave por una pista activa?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Sí, porque no hay ningún tráfico" },
      { value: "b", label: "No" },
      { value: "c", label: "Sí, pero con autorización previa de TWR" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q8",
    prompt: "Dé un ejemplo de cómo le darías instrucciones a un tráfico KLM3066 a rodar a la pista 09 por las calles de rodaje B, G, L.",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "KLM3066, ruede a pista cero nueve directo." },
      { value: "b", label: "KLM3066, autorizado a despegar pista cero nueve por Bravo, Golf y Lima." },
      { value: "c", label: "KLM3066, ruede a punto de espera pista cero nueve por Bravo, Golf y Lima, mantenga corto pista cero nueve." },
      { value: "d", label: "KLM3066, taxi Bravo Golf Lima runway cero nueve cleared for takeoff." },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q9",
    prompt: "¿Puede GND solicitarle a un tráfico en movimiento que mantenga posición sin dar un punto de referencia?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Sí" },
      { value: "b", label: "No" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q10",
    prompt: "Según la imagen anterior, ¿por dónde le daría instrucciones de rodar a la pista 01 a un B777?",
    type: "single",
    points: 1,
    needsReferenceImage: true,
    options: [
      { value: "a", label: "J – E – T – A2" },
      { value: "b", label: "J – D – C – A2 – 01" },
      { value: "c", label: "T – C – A1 – 01" },
      { value: "d", label: "J – E – NL" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q11",
    prompt: "Según la imagen anterior, ¿qué diferencia hay entre la calle de rodaje A1 y J?",
    type: "single",
    points: 1,
    needsReferenceImage: true,
    options: [
      { value: "a", label: "A1 es una calle interna de plataforma y J es de acceso a pista." },
      { value: "b", label: "A1 es una calle de acceso a pista, cercana a la cabecera 01, y J es una calle de plataforma frente a la terminal." },
      { value: "c", label: "J es una calle de acceso rápido a pista y A1 solo para estacionamiento." },
      { value: "d", label: "Ambas tienen la misma función, solo cambian de nombre." },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q12",
    prompt: "¿Para qué se utiliza el nivel de vuelo inicial?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Para indicar la altitud de crucero final del vuelo." },
      { value: "b", label: "Para determinar la altitud mínima de aproximación." },
      { value: "c", label: "Para indicar la altitud de transición." },
      { value: "d", label: "Para asegurar separación inicial con otros tráficos y ordenar las salidas antes de transferir al control superior." },
    ],
    correctAnswers: ["d"],
  },
  {
    id: "q13",
    prompt: "Al ascenso, ¿se utiliza el Transition Altitude (TA) o Transition Level (TL)?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "TA" },
      { value: "b", label: "TL" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q14",
    prompt: "¿Cuál es la diferencia entre reglas de vuelo VFR e IFR?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "VFR es solo para vuelos internacionales y IFR para nacionales." },
      { value: "b", label: "VFR depende de autorizaciones ATC estrictas, IFR no." },
      { value: "c", label: "VFR se basa en vuelo visual, IFR se basa en vuelo por instrumentos." },
      { value: "d", label: "IFR se basa en vuelo visual, VFR se basa en vuelo por instrumentos." },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q15",
    prompt: "En un vuelo desde Punta Cana hacia Gatwick, en un A330, ¿debería utilizar reglas VFR o IFR?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "VFR" },
      { value: "b", label: "IFR" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q16",
    prompt: "El transponder en un tránsito, ¿puede superar el número 7?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Sí" },
      { value: "b", label: "No" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q17",
    prompt: "Según la imagen anterior, ¿es correcto este plan de vuelo?",
    type: "single",
    points: 1,
    needsReferenceImage: true,
    options: [
      { value: "a", label: "Sí" },
      { value: "b", label: "No" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q18",
    prompt: "Según la imagen anterior, dé un ejemplo de cómo le autorizaría el plan de vuelo con la información respectiva.",
    type: "single",
    points: 1,
    needsReferenceImage: true,
    options: [
      { value: "a", label: "AVA4508 – EGKK – KATOK2T – 01 – 090 – 7562" },
      { value: "b", label: "AVA4508 – EGKK – KATO2T – 09 – 070 – 7562" },
      { value: "c", label: "AVA4508 – MDPC – VUSU1G – 09 – 070 – 7562" },
      { value: "d", label: "AVA4508 – EGKK – KATOK – 09 – 7000 – 7562" },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q19",
    prompt: "GND y TWR son los encargados de coordinarse internamente para cambiar las pistas activas debido a los vientos locales.",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Verdadero" },
      { value: "b", label: "Falso" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q20",
    prompt: "GND puede autorizar el despegue de una aeronave con permiso de TWR.",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Verdadero" },
      { value: "b", label: "Falso" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q21",
    prompt: "¿Acepta las reglas de PF24?",
    type: "single",
    points: 0,
    options: [
      { value: "a", label: "Sí" },
      { value: "b", label: "No" },
    ],
    correctAnswers: ["a"],
  },
];

export type AtcS1ExamAnswers = Record<string, string | string[]>;

function normalizeAnswer(answer: string | string[] | undefined) {
  if (Array.isArray(answer)) return [...answer].sort();
  if (typeof answer === "string" && answer) return [answer];
  return [];
}

export function gradeAtcS1Exam(answers: AtcS1ExamAnswers) {
  let score = 0;

  for (const question of ATC_S1_EXAM_QUESTIONS) {
    if (question.points === 0) continue;
    const received = normalizeAnswer(answers[question.id]);
    const expected = [...question.correctAnswers].sort();
    if (received.length === expected.length && received.every((value, index) => value === expected[index])) {
      score += question.points;
    }
  }

  return {
    score,
    total: ATC_S1_EXAM_TOTAL_SCORE,
    passed: score >= ATC_S1_EXAM_PASSING_SCORE,
  };
}

export function hasAllAtcS1ExamAnswers(answers: AtcS1ExamAnswers) {
  return ATC_S1_EXAM_QUESTIONS.every((question) => normalizeAnswer(answers[question.id]).length > 0);
}
