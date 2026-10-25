"use client";

import { completeAcademyInstruction } from "@/app/actions/academyInstruction";
import type { AcademyTrack } from "@/lib/academyInstructionQueue";
import { useState } from "react";
import { useFormStatus } from "react-dom";

function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Finalizando…" : "Sí, finalizar"}
    </button>
  );
}

export default function InstructionCompleteButton({
  track,
  requestId,
  applicantName,
  targetRole,
}: {
  track: AcademyTrack;
  requestId: string;
  applicantName: string;
  targetRole: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-semibold text-emerald-300 transition hover:bg-emerald-400 hover:text-slate-950"
      >
        Finalizar
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`complete-instruction-${requestId}`}
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#081225] p-6 text-left shadow-2xl">
            <p className="mono text-xs uppercase tracking-[0.2em] text-amber-300">Confirmación requerida</p>
            <h3 id={`complete-instruction-${requestId}`} className="mt-3 text-2xl font-extrabold text-white">
              ¿Finalizar esta instrucción?
            </h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Vas a finalizar la instrucción de <span className="font-bold text-white">{applicantName}</span> para <span className="font-bold text-sky-300">{targetRole}</span>.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              La solicitud dejará de aparecer en “En instrucción” y quedará archivada como completada.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Cancelar
              </button>
              <form action={completeAcademyInstruction}>
                <input type="hidden" name="track" value={track} />
                <input type="hidden" name="requestId" value={requestId} />
                <ConfirmButton />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
