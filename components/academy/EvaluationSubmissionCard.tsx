import { submitAcademyEvaluation } from "@/app/actions/academyInstruction";
import {
  findActiveAcademyInstructionRequest,
  type AcademyTrack,
} from "@/lib/academyInstructionQueue";

export default async function EvaluationSubmissionCard({
  track,
  targetRole,
  applicantDiscordId,
}: {
  track: AcademyTrack;
  targetRole: string;
  applicantDiscordId: string;
}) {
  let existing = null;

  try {
    existing = await findActiveAcademyInstructionRequest(track, targetRole, applicantDiscordId);
  } catch (error) {
    console.error("PF24 evaluation submission status error:", error);
  }

  if (existing?.status === "instruction") {
    return (
      <div className="panel mt-6 rounded-3xl border border-emerald-400/20 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-emerald-300/70">Evaluación enviada</p>
        <h2 className="mt-3 text-xl font-extrabold text-white">En proceso de instrucción</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Tu evaluación para <span className="font-bold text-emerald-300">{targetRole}</span> ya fue asumida por {existing.instructorName ?? "un instructor"}.
        </p>
      </div>
    );
  }

  if (existing?.status === "pending") {
    return (
      <div className="panel mt-6 rounded-3xl border border-sky-400/20 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Evaluación enviada</p>
        <h2 className="mt-3 text-xl font-extrabold text-white">Esperando instructor</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Tu postulación a <span className="font-bold text-sky-300">{targetRole}</span> ya está en la cola de instrucciones. No necesitas volver a enviarla.
        </p>
      </div>
    );
  }

  return (
    <div className="panel mt-6 rounded-3xl border border-sky-400/20 p-6">
      <p className="mono text-xs uppercase tracking-[0.2em] text-sky-300/70">Finalizar evaluación</p>
      <h2 className="mt-3 text-xl font-extrabold text-white">Enviar a instrucciones</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Cuando hayas completado tu evaluación, envíala para entrar a la lista de espera de un instructor. La postulación registrada será para <span className="font-bold text-sky-300">{targetRole}</span>.
      </p>
      <form action={submitAcademyEvaluation} className="mt-5">
        <input type="hidden" name="track" value={track} />
        <input type="hidden" name="targetRole" value={targetRole} />
        <button
          type="submit"
          className="rounded-xl bg-sky-400 px-5 py-2.5 font-bold text-slate-950 transition hover:bg-sky-300"
        >
          Enviar evaluación
        </button>
      </form>
    </div>
  );
}
