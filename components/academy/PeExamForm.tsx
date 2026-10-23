"use client";

import {
  PE_EXAM_PASSING_SCORE,
  PE_EXAM_QUESTIONS,
  PE_EXAM_TOTAL_SCORE,
  type PeExamAnswers,
  type PeExamQuestion,
} from "@/lib/academy/peExamQuestions";
import { useEffect, useRef, useState } from "react";

type ExamStatus = {
  attempts: number;
  lastScore: number | null;
  lockedUntil: string | null;
  passedAt: string | null;
  cancelledAt: string | null;
  startedAt: string | null;
  deadlineAt: string | null;
  reviewAnswers: PeExamAnswers | null;
  queueStatus: string | null;
  passingScore: number;
  totalScore: number;
  durationMinutes: number;
  locked: boolean;
  passed?: boolean;
  cancelled?: boolean;
  started?: boolean;
  timedOut?: boolean;
  score?: number | null;
  message?: string;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function hasAnswer(question: PeExamQuestion, answers: PeExamAnswers) {
  const value = answers[question.id];
  if (question.type === "multiple") return Array.isArray(value) && value.length > 0;
  return typeof value === "string" && value.length > 0;
}

function draftKey(startedAt: string) {
  return `pf24-pe-exam-draft:${startedAt}`;
}

export default function PeExamForm() {
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [answers, setAnswers] = useState<PeExamAnswers>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(20 * 60);
  const [draftReady, setDraftReady] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const timeoutSentRef = useRef(false);
  const answersRef = useRef<PeExamAnswers>({});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/academy/piloto/pe/exam", { cache: "no-store" });
        const data = await response.json() as ExamStatus;
        if (!response.ok) throw new Error(data.error || "No se pudo consultar el estado del examen.");
        if (!cancelled) setStatus(data);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo consultar el estado del examen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatus();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!status?.startedAt) {
      setDraftReady(true);
      return;
    }

    setDraftReady(false);
    try {
      const saved = window.localStorage.getItem(draftKey(status.startedAt));
      if (saved) {
        const parsed = JSON.parse(saved) as PeExamAnswers;
        if (parsed && typeof parsed === "object") setAnswers(parsed);
      }
    } catch {
      // Si el borrador local no es válido, el intento continúa con las respuestas disponibles.
    } finally {
      setDraftReady(true);
    }
  }, [status?.startedAt]);

  useEffect(() => {
    if (!status?.startedAt || !draftReady) return;
    try {
      window.localStorage.setItem(draftKey(status.startedAt), JSON.stringify(answers));
    } catch {
      // El examen puede continuar aunque el navegador no permita almacenamiento local.
    }
  }, [answers, draftReady, status?.startedAt]);

  useEffect(() => {
    timeoutSentRef.current = false;
  }, [status?.deadlineAt]);

  useEffect(() => {
    if (!status?.deadlineAt || !status.startedAt || status.passedAt || status.cancelledAt || status.locked || !draftReady) return;

    const deadline = Date.parse(status.deadlineAt);
    if (!Number.isFinite(deadline)) return;

    function tick() {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0 && !timeoutSentRef.current && !submitting) {
        timeoutSentRef.current = true;
        void submitExam(true, answersRef.current);
      }
    }

    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [draftReady, status?.cancelledAt, status?.deadlineAt, status?.locked, status?.passedAt, status?.startedAt, submitting]);

  function setSingleAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setError("");
  }

  function toggleMultipleAnswer(questionId: string, value: string) {
    setAnswers((current) => {
      const selected = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [questionId]: next };
    });
    setError("");
  }

  async function startExam() {
    if (starting) return;
    setStarting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/academy/piloto/pe/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await response.json() as ExamStatus;
      if (!response.ok) throw new Error(data.error || data.message || "No se pudo iniciar el examen.");
      setAnswers({});
      setStatus(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "No se pudo iniciar el examen.");
    } finally {
      setStarting(false);
    }
  }

  async function submitExam(autoSubmit = false, submittedAnswers = answers) {
    if (submitting) return;

    if (!autoSubmit) {
      const missing = PE_EXAM_QUESTIONS.find((question) => !hasAnswer(question, submittedAnswers));
      if (missing) {
        setError("Todas las preguntas son obligatorias antes de enviar manualmente.");
        document.getElementById(`pe-question-${missing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setMessage(autoSubmit ? "Tiempo finalizado. Enviando examen automáticamente…" : "");

    try {
      const response = await fetch("/api/academy/piloto/pe/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", answers: submittedAnswers }),
      });
      const data = await response.json() as ExamStatus;
      if (!response.ok && !data.cancelled && !data.locked) {
        throw new Error(data.error || data.message || "No se pudo enviar el examen.");
      }

      if (status?.startedAt) {
        try { window.localStorage.removeItem(draftKey(status.startedAt)); } catch { /* noop */ }
      }
      setStatus(data);
      setMessage(data.message ?? "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      timeoutSentRef.current = false;
      setError(submitError instanceof Error ? submitError.message : "No se pudo enviar el examen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="panel mt-6 rounded-3xl border border-sky-400/20 p-6">
        <p className="text-sm text-slate-400">Cargando examen PE…</p>
      </div>
    );
  }

  if (!status && error) {
    return (
      <div className="panel mt-6 rounded-3xl border border-red-400/20 p-6">
        <p className="font-semibold text-red-300">{error}</p>
      </div>
    );
  }

  if (status?.passedAt) {
    return (
      <section className="mt-6 space-y-5">
        <div className="panel rounded-3xl border border-emerald-400/25 p-6 md:p-8">
          <p className="mono text-xs uppercase tracking-[0.2em] text-emerald-300/70">Examen PE</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-extrabold text-white">Aprobado · {status.lastScore}/{status.totalScore}</h2>
            {status.reviewAnswers ? (
              <button
                type="button"
                onClick={() => setReviewOpen((current) => !current)}
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/15"
              >
                {reviewOpen ? "Ocultar revisión" : "Revisar examen"}
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {message || "Aprobaste el examen PE. Tu solicitud fue agregada automáticamente a la lista de instrucciones pendientes."}
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
            Estado de instrucción: <span className="font-bold text-emerald-300">{status.queueStatus === "instruction" ? "En instrucción" : "Pendiente de instructor"}</span>
          </div>
        </div>

        {reviewOpen && status.reviewAnswers ? (
          <div className="space-y-4">
            {PE_EXAM_QUESTIONS.map((question, index) => {
              const value = status.reviewAnswers?.[question.id];
              const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
              return (
                <div key={question.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-base font-semibold leading-7 text-white"><span className="mr-2 text-slate-500">{index + 1}.</span>{question.prompt}</h3>
                    <span className="shrink-0 text-xs text-slate-500">1 punto</span>
                  </div>
                  <div className="mt-5 space-y-2">
                    {question.options.map((option) => {
                      const isSelected = selected.includes(option.value);
                      const isCorrect = question.correctAnswers.includes(option.value);
                      return (
                        <div
                          key={option.value}
                          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                            isCorrect
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                              : isSelected
                                ? "border-red-400/30 bg-red-400/10 text-red-100"
                                : "border-white/5 bg-slate-950/20 text-slate-400"
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className="shrink-0 text-xs font-bold">
                            {isCorrect && isSelected ? "Tu respuesta · Correcta" : isCorrect ? "Correcta" : isSelected ? "Tu respuesta" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    );
  }

  if (status?.cancelledAt || status?.cancelled) {
    return (
      <section className="panel mt-6 rounded-3xl border border-red-400/25 p-6 md:p-8">
        <p className="mono text-xs uppercase tracking-[0.2em] text-red-300/70">Examen PE · 4 intentos fallidos</p>
        <h2 className="mt-3 text-2xl font-extrabold text-white">Licencia cancelada</h2>
        <p className="mt-3 text-base font-semibold text-red-200">Licencia cancelada. Solicitar vía ticket reincorporación</p>
        {status.lastScore !== null ? <p className="mt-3 text-sm text-slate-400">Última puntuación: {status.lastScore}/{status.totalScore}</p> : null}
      </section>
    );
  }

  if (status?.locked) {
    return (
      <section className="panel mt-6 rounded-3xl border border-amber-400/25 p-6 md:p-8">
        <p className="mono text-xs uppercase tracking-[0.2em] text-amber-300/70">Examen PE · intento {status.attempts} desaprobado</p>
        <h2 className="mt-3 text-2xl font-extrabold text-white">Examen temporalmente bloqueado</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {message || `Puntuación obtenida: ${status.lastScore}/${status.totalScore}.`}
        </p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
          Próximo intento disponible: <span className="font-bold text-amber-300">{formatDate(status.lockedUntil)}</span>
        </div>
      </section>
    );
  }

  const nextAttempt = (status?.attempts ?? 0) + 1;

  if (!status?.startedAt) {
    return (
      <section className="mt-6 space-y-5">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
          <div className="h-2 bg-sky-400" />
          <div className="p-6 md:p-8">
            <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Evaluación final · PE</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white">Antes de comenzar</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <p>El examen contiene <strong className="text-white">{PE_EXAM_TOTAL_SCORE} preguntas</strong>. Cada pregunta vale 1 punto y el mínimo para aprobar es <strong className="text-white">{PE_EXAM_PASSING_SCORE}/{PE_EXAM_TOTAL_SCORE}</strong>.</p>
              <p>El tiempo límite es de <strong className="text-white">20 minutos</strong>. El contador comienza al presionar <strong className="text-white">Iniciar examen</strong> y no se pausa aunque recargues la página.</p>
              <p>Cuando el contador llegue a <strong className="text-white">00:00</strong>, el examen se enviará automáticamente con las respuestas realizadas. Las preguntas que queden sin responder se contarán como incorrectas.</p>
              <p>Si desapruebas, el examen se bloqueará 1 semana después del primer intento, 2 semanas después del segundo y 3 semanas después del tercero. Un cuarto intento fallido cancela la licencia hasta solicitar reincorporación vía ticket.</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <span className="text-sm font-semibold text-slate-300">Intento {nextAttempt} de 4</span>
              <button
                type="button"
                onClick={startExam}
                disabled={starting}
                className="rounded-xl bg-sky-400 px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? "Iniciando…" : "Iniciar examen"}
              </button>
            </div>
            {error ? <p className="mt-4 text-sm font-semibold text-red-300">{error}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  const answeredCount = PE_EXAM_QUESTIONS.filter((question) => hasAnswer(question, answers)).length;
  const progress = (answeredCount / PE_EXAM_TOTAL_SCORE) * 100;

  return (
    <section className="mt-6 space-y-5">
      <div className="sticky top-4 z-20 overflow-hidden rounded-3xl border border-sky-400/25 bg-slate-950/95 shadow-2xl shadow-slate-950/50 backdrop-blur">
        <div className="h-2 bg-sky-400" />
        <div className="flex flex-wrap items-center justify-between gap-5 p-5 md:px-8">
          <div>
            <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Examen PE · intento {nextAttempt} de 4</p>
            <p className="mt-2 text-sm font-semibold text-slate-300">{answeredCount}/{PE_EXAM_TOTAL_SCORE} respondidas</p>
          </div>
          <div className="text-right">
            <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">Tiempo restante</p>
            <p className={`mt-1 font-mono text-3xl font-black tabular-nums ${secondsLeft <= 120 ? "text-red-300" : "text-white"}`}>{formatTimer(secondsLeft)}</p>
          </div>
          <div className="w-full h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {PE_EXAM_QUESTIONS.map((question, index) => {
        const currentValue = answers[question.id];
        return (
          <fieldset id={`pe-question-${question.id}`} key={question.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <legend className="pr-4 text-base font-semibold leading-7 text-white">
                <span className="mr-2 text-slate-500">{index + 1}.</span>{question.prompt} <span className="text-red-300">*</span>
              </legend>
              <span className="shrink-0 text-xs text-slate-500">1 punto</span>
            </div>
            {question.type === "multiple" ? <p className="mt-2 text-xs text-slate-500">Selecciona todas las opciones que correspondan.</p> : null}
            <div className="mt-5 space-y-3">
              {question.options.map((option) => {
                const checked = question.type === "multiple"
                  ? Array.isArray(currentValue) && currentValue.includes(option.value)
                  : currentValue === option.value;
                return (
                  <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-sm leading-6 text-slate-300 transition hover:bg-white/5">
                    <input
                      type={question.type === "multiple" ? "checkbox" : "radio"}
                      name={question.id}
                      value={option.value}
                      checked={checked}
                      onChange={() => question.type === "multiple"
                        ? toggleMultipleAnswer(question.id, option.value)
                        : setSingleAnswer(question.id, option.value)}
                      disabled={submitting}
                      className="mt-1 h-4 w-4 accent-sky-400"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-5 py-4 text-sm font-semibold text-red-200">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 px-5 py-4 text-sm font-semibold text-sky-200">{message}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
        <p className="text-sm text-slate-400">Revisa tus respuestas antes de enviar. Las preguntas con <span className="text-red-300">*</span> son obligatorias para el envío manual.</p>
        <button
          type="button"
          onClick={() => submitExam(false)}
          disabled={submitting}
          className="rounded-xl bg-sky-400 px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Enviar examen"}
        </button>
      </div>
    </section>
  );
}
