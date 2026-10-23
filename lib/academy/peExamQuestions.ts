export type PeExamQuestion = {
  id: string;
  prompt: string;
  type: "single" | "multiple";
  options: { value: string; label: string }[];
  correctAnswers: string[];
  points: 1;
};

export type PeExamSection = {
  title: string;
  description: string;
  questionIds: string[];
};

export const PE_EXAM_PASSING_SCORE = 16;
export const PE_EXAM_TOTAL_SCORE = 20;

export const PE_EXAM_QUESTIONS: PeExamQuestion[] = [
  {
    id: "q1",
    prompt: "¿Qué permite realizar la Licencia de Piloto Estudiante (PE)?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Vuelos IFR de instrucción con meteorología adversa" },
      { value: "b", label: "Vuelos locales bajo reglas VFR y condiciones visuales" },
      { value: "c", label: "Vuelos internacionales con plan de vuelo IFR" },
      { value: "d", label: "Vuelos sin control ATC" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q2",
    prompt: "Durante el circuito de tránsito, el piloto debe reportar:",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Al despegar y aterrizar" },
      { value: "b", label: "Cada 10 minutos." },
      { value: "c", label: "Cuando el ATC lo indique" },
      { value: "d", label: "En final" },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q3",
    prompt: "El QNH representa:",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "La presión estándar de 1013 hPa" },
      { value: "b", label: "La altitud del avión sobre el terreno (AGL)" },
      { value: "c", label: "La presión aerostatica de una estacion" },
      { value: "d", label: "La presión atmosférica de una estación y reducida al nivel medio del mar" },
    ],
    correctAnswers: ["d"],
  },
  {
    id: "q4",
    prompt: "¿Qué acción corresponde antes de arrancar motores?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Encender luces de posición (NAV)" },
      { value: "b", label: "Encender luces de aterrizaje" },
      { value: "c", label: "Encender la luz BEACON" },
      { value: "d", label: "Solicitar autorización de rodaje" },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q5",
    prompt: "El METAR informa visibilidad, nubes, temperatura y presión atmosférica.",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Verdadero" },
      { value: "b", label: "Falso" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q6",
    prompt: "¿Cuál de las siguientes luces debe permanecer encendida durante todo el vuelo, desde la puerta de salida hasta la de llegada?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "NAV" },
      { value: "b", label: "STROBE" },
      { value: "c", label: "BEACON" },
      { value: "d", label: "TAXI" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q7",
    prompt: "Si el ATIS indica pista activa 27 y QNH 1015, el piloto debe:",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Ajustar el altímetro a 1013 y despegar por pista 09" },
      { value: "b", label: "Ajustar altímetro a 1015 y prepararse para pista 27" },
      { value: "c", label: "Volar en QNE y despegar por pista 27" },
      { value: "d", label: "Esperar nuevo ATIS antes de ajustar QNH" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q8",
    prompt: "El piloto se encuentra en plataforma y desea iniciar rodaje. ¿Qué debe decir?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "MDST Torre, pido pushback." },
      { value: "b", label: "Torre, LV-AZC, listos a rodar." },
      { value: "c", label: "Torre, LV-AZC, listos para taxi." },
      { value: "d", label: "Control, LV-AZC solicitamos despegue y rodaje." },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q9",
    prompt: "Seleccione las luces que se deben encender durante el rodaje nocturno:",
    type: "multiple",
    points: 1,
    options: [
      { value: "a", label: "TAXI" },
      { value: "b", label: "LOGO" },
      { value: "c", label: "BEACON" },
      { value: "d", label: "STROBE" },
      { value: "e", label: "LANDING" },
    ],
    correctAnswers: ["a", "b", "c"],
  },
  {
    id: "q10",
    prompt: "¿Qué significa que un circuito se realice “por izquierda”?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Que la pista solo se usa hacia el norte" },
      { value: "b", label: "Que la torre se encuentra del lado izquierdo" },
      { value: "c", label: "Que el piloto debe girar siempre hacia la izquierda en cada tramo" },
      { value: "d", label: "Que el circuito es exclusivo para aeronaves de gran tamaño" },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q11",
    prompt: "¿Qué elemento indica la posición de la aeronave de noche?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Luces LOGO" },
      { value: "b", label: "Luces NAV" },
      { value: "c", label: "Luces LANDING" },
      { value: "d", label: "Luces TAXI" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q12",
    prompt: "Esta en final pista 27 y observa otra aeronave aún en la pista. ¿Qué debería comunicar?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Continuar en final sin avisar" },
      { value: "b", label: "Torre, LV-AZC, tráfico en pista, realizando frustrada" },
      { value: "c", label: "Torre, LV-AZC, tráfico en pista" },
      { value: "d", label: "Torre, LV-AZC, cambiamos de pista" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q13",
    prompt: "En PF24, ¿Cuándo se utiliza el campo ‘Ruta’ con la sigla LCL?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "En vuelos VFR locales o circuitos de tránsito" },
      { value: "b", label: "En vuelos IFR entre aeropuertos" },
      { value: "c", label: "En vuelos IFR locales o circuitos de tránsito" },
      { value: "d", label: "En vuelos de mantenimiento" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q14",
    prompt: "No es necesario repetir toda la información que nos indica ATC",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Verdadero" },
      { value: "b", label: "Falso" },
    ],
    correctAnswers: ["b"],
  },
  {
    id: "q15",
    prompt: "¿Cuáles de las siguientes son comunicaciones correctas durante todo el proceso de un circuito visual?",
    type: "multiple",
    points: 1,
    options: [
      { value: "a", label: "Torre, CC-AZC, viento en cola izquierda." },
      { value: "b", label: "Torre, CC-AZC, virando base." },
      { value: "c", label: "CC-AZC, final pista 27." },
      { value: "d", label: "CC-AZC, en el aire." },
    ],
    correctAnswers: ["a", "b", "c", "d"],
  },
  {
    id: "q16",
    prompt: "¿Cuál es la función del altímetro?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Indicar la velocidad vertical" },
      { value: "b", label: "Indicar la altimetría" },
      { value: "c", label: "Indicar la altitud según presión atmosférica" },
      { value: "d", label: "Medir la temperatura y presión exterior" },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q17",
    prompt: "Si por alguna razón usted se detiene en su proceso de rodaje, debe apagar las luces TAXI",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Verdadero" },
      { value: "b", label: "Falso" },
    ],
    correctAnswers: ["a"],
  },
  {
    id: "q18",
    prompt: "Marque la información correcta según el siguiente METAR: 23012KT 9999 FEW030 17/10 Q1015.",
    type: "multiple",
    points: 1,
    options: [
      { value: "a", label: "Fecha 23 hora UTC 0012." },
      { value: "b", label: "Temperatura 10 punto de roció 17" },
      { value: "c", label: "Nubes a 030" },
      { value: "d", label: "QNH9999" },
      { value: "e", label: "Vientos 230° 12 nudos." },
      { value: "f", label: "Nubes FEW030" },
      { value: "g", label: "Visibilidad mayor a 9999 kilómetros." },
      { value: "h", label: "QNH1015" },
      { value: "i", label: "Nubes FEW a 230" },
      { value: "j", label: "Nubes 9999" },
      { value: "k", label: "Temperatura 17 punto de roció 10" },
      { value: "l", label: "Visibilidad mayor a 10 kilómetros." },
    ],
    correctAnswers: ["c", "e", "f", "h", "k", "l"],
  },
  {
    id: "q19",
    prompt: "¿Qué significa el termino RA en un METAR?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "Granizo" },
      { value: "b", label: "Tormenta" },
      { value: "c", label: "Lluvia" },
      { value: "d", label: "Neblina" },
    ],
    correctAnswers: ["c"],
  },
  {
    id: "q20",
    prompt: "¿Cuál de las siguientes afirmaciones describe correctamente la diferencia entre vuelo VFR e IFR?",
    type: "single",
    points: 1,
    options: [
      { value: "a", label: "En VFR se vuela por instrumentos y en IFR por referencias visuales" },
      { value: "b", label: "En VFR el piloto mantiene referencia visual con el terreno; en IFR vuela guiado por instrumentos" },
      { value: "c", label: "En IFR no se necesita plan de vuelo; en VFR siempre se requiere" },
      { value: "d", label: "Ambos tipos de vuelo utilizan exclusivamente navegación por GPS" },
    ],
    correctAnswers: ["c"],
  },
];

export const PE_EXAM_SECTIONS: PeExamSection[] = [
  {
    title: "Fundamentos PE",
    description: "Licencia, circuito, meteorología y procedimientos previos al vuelo.",
    questionIds: ["q1", "q2", "q3", "q4", "q5"],
  },
  {
    title: "Operación en superficie",
    description: "Luces, ATIS, rodaje y circuito de tránsito.",
    questionIds: ["q6", "q7", "q8", "q9", "q10"],
  },
  {
    title: "Comunicaciones y operación visual",
    description: "Posición, fraseología, plan local y comunicaciones del circuito.",
    questionIds: ["q11", "q12", "q13", "q14", "q15"],
  },
  {
    title: "Altimetría, METAR y reglas de vuelo",
    description: "Altímetro, luces TAXI, lectura METAR y conceptos VFR/IFR.",
    questionIds: ["q16", "q17", "q18", "q19", "q20"],
  },
];

export type PeExamAnswers = Record<string, string | string[]>;

function normalizeAnswer(answer: string | string[] | undefined) {
  if (Array.isArray(answer)) return [...answer].sort();
  if (typeof answer === "string" && answer) return [answer];
  return [];
}

export function gradePeExam(answers: PeExamAnswers) {
  let score = 0;

  for (const question of PE_EXAM_QUESTIONS) {
    const received = normalizeAnswer(answers[question.id]);
    const expected = [...question.correctAnswers].sort();
    if (received.length === expected.length && received.every((value, index) => value === expected[index])) {
      score += question.points;
    }
  }

  return {
    score,
    total: PE_EXAM_TOTAL_SCORE,
    passed: score >= PE_EXAM_PASSING_SCORE,
  };
}

export function hasAllPeExamAnswers(answers: PeExamAnswers) {
  return PE_EXAM_QUESTIONS.every((question) => normalizeAnswer(answers[question.id]).length > 0);
}
