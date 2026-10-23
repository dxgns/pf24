"use client";

import {
  PE_EXAM_PASSING_SCORE,
  PE_EXAM_QUESTIONS,
  PE_EXAM_SECTIONS,
  PE_EXAM_TOTAL_SCORE,
  type PeExamAnswers,
  type PeExamQuestion,
} from "@/lib/academy/peExamQuestions";
import { useEffect, useMemo, useState } from "react";

type ExamStatus = {
  attempts: number;
  lastScore: number | null;
  lockedUntil: string | null;
  passedAt: string | null;
  cancelledAt: string | null;
  queueStatus: string | null;
  passingScore: number;
  totalScore: number;
  locked: boolean;
  passed?: boolean;
  cancelled?: boolean;
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

function hasAnswer(question: PeExamQuestion, answers: PeExamAnswers) {
  const value = answers[question.id];
  if (question.type === "multiple") return Array.isArray(value) && value.length > 0;
  return typeof value === "string" && value.length > 0;
}

export default function PeExamForm() {
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [answers, setAnswers] = useState<PeExamAnswers>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const questionMap = useMemo(
    () => new Map(PE_EXAM_QUESTIONS.map((question) => [question.id, question])),
    [],
  );

  const section = PE_EXAM_SECTIONS[sectionIndex];
  const sectionQuestions = section.questionIds
    .map((id) => questionMap.get(id))
    .filter((question): question is PeExamQuestion => Boolean(question));

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

  function validateSection() {
    const missing = sectionQuestions.find((question) => !hasAnswer(question, answers));
    if (missing) {
      setError("Todas las preguntas de esta sección son obligatorias.");
      document.getElementById(`pe-question-${missing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function nextSection() {
    if (!validateSection()) return;
    setSectionIndex((current) => Math.min(current + 1, PE_EXAM_SECTIONS.length - 1));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousSection() {
    setSectionIndex((current) => Math.max(current - 1, 0));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitExam() {
    if (!validateSection() || submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/academy/piloto/pe/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await response.json() as ExamStatus;
      if (!response.ok && !data.cancelled && !data.locked) {
        throw new Error(data.error || data.message || "No se pudo enviar el examen.");
      }
      setStatus(data);
      setMessage(data.message ?? "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
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
      <section className="panel mt-6 rounded-3xl border border-emerald-400/25 p-6 md:p-8">
        <p className="mono text-xs uppercase tracking-[0.2em] text-emerald-300/70">Examen PE</p>
        <h2 className="mt-3 text-2xl font-extrabold text-white">Aprobado · {status.lastScore}/{status.totalScore}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {message || "Aprobaste el examen PE. Tu solicitud fue agregada automáticamente a la lista de instrucciones pendientes."}
        </p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
          Estado de instrucción: <span className="font-bold text-emerald-300">{status.queueStatus === "instruction" ? "En instrucción" : "Pendiente de instructor"}</span>
        </div>
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
  const progress = ((sectionIndex + 1) / PE_EXAM_SECTIONS.length) * 100;

  return (
    <section className="mt-6 space-y-5">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="h-2 bg-sky-400" />
        <div className="p-6 md:p-8">
          <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Evaluación final · PE</p>
          <h2 className="mt-3 text-3xl font-extrabold text-white">Examen de Piloto Estudiante</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
            Responde las {PE_EXAM_TOTAL_SCORE} preguntas. Cada pregunta vale 1 punto. El mínimo para aprobar es {PE_EXAM_PASSING_SCORE}/{PE_EXAM_TOTAL_SCORE}.
          </p>
          <p className="mt-4 text-sm font-semibold text-red-300">* Indica que la pregunta es obligatoria</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5">Intento {nextAttempt} de 4</span>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5">Sección {sectionIndex + 1} de {PE_EXAM_SECTIONS.length}</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-sky-400/20 bg-slate-900/70 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.18em] text-sky-300/70">Sección {sectionIndex + 1} de {PE_EXAM_SECTIONS.length}</p>
            <h3 className="mt-2 text-2xl font-extrabold text-white">{section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{section.description}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-slate-400">5 preguntas</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {sectionQuestions.map((question) => {
        const globalIndex = PE_EXAM_QUESTIONS.findIndex((item) => item.id === question.id) + 1;
        const currentValue = answers[question.id];

        return (
          <fieldset id={`pe-question-${question.id}`} key={question.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <legend className="pr-4 text-base font-semibold leading-7 text-white">
                <span className="mr-2 text-slate-500">{globalIndex}.</span>{question.prompt} <span className="text-red-300">*</span>
              </legend>
              <span className="shrink-0 text-xs text-slate-500">1 punto</span>
            </div>
            {question.type === "multiple" ? (
              <p className="mt-2 text-xs text-slate-500">Selecciona todas las opciones que correspondan.</p>
            ) : null}
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
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-5 py-4 text-sm font-semibold text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
        <button
          type="button"
          onClick={previousSection}
          disabled={sectionIndex === 0 || submitting}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-300 transition hover:border-sky-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Atrás
        </button>

        {sectionIndex < PE_EXAM_SECTIONS.length - 1 ? (
          <button
            type="button"
            onClick={nextSection}
            disabled={submitting}
            className="rounded-xl bg-sky-400 px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            onClick={submitExam}
            disabled={submitting}
            className="rounded-xl bg-sky-400 px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Enviar"}
          </button>
        )}
      </div>
    </section>
  );
}
