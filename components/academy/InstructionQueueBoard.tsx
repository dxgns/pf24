import { assumeAcademyInstruction } from "@/app/actions/academyInstruction";
import {
  waitingDays,
  type AcademyInstructionRequest,
  type AcademyTrack,
} from "@/lib/academyInstructionQueue";

function daysLabel(value: number) {
  return `${value} ${value === 1 ? "día" : "días"}`;
}

function Applicant({ request }: { request: AcademyInstructionRequest }) {
  return (
    <div>
      <p className="font-semibold text-white">{request.applicantName}</p>
      {request.applicantRobloxUsername && request.applicantRobloxUsername !== request.applicantName ? (
        <p className="mono mt-1 text-xs text-slate-500">{request.applicantRobloxUsername}</p>
      ) : null}
    </div>
  );
}

export default function InstructionQueueBoard({
  track,
  pending,
  instruction,
}: {
  track: AcademyTrack;
  pending: AcademyInstructionRequest[];
  instruction: AcademyInstructionRequest[];
}) {
  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel rounded-2xl p-5">
          <p className="mono text-xs uppercase tracking-[0.2em] text-slate-500">Esperando instructor</p>
          <p className="mt-2 text-3xl font-extrabold text-sky-300">{pending.length}</p>
        </div>
        <div className="panel rounded-2xl p-5">
          <p className="mono text-xs uppercase tracking-[0.2em] text-slate-500">En instrucción</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-300">{instruction.length}</p>
        </div>
      </div>

      <section className="panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mono text-xs uppercase tracking-[0.22em] text-sky-300/70">Cola de evaluaciones</p>
            <h2 className="mt-2 text-2xl font-extrabold">Pendientes de instructor</h2>
          </div>
          <p className="text-sm text-slate-500">Ordenados por mayor tiempo de espera.</p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Tiempo en espera</th>
                <th className="px-4 py-3 font-semibold">Rol al que postula</th>
                <th className="px-4 py-3 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pending.length ? (
                pending.map((request) => (
                  <tr key={request.id} className="border-t border-white/10 bg-slate-950/25">
                    <td className="px-4 py-4"><Applicant request={request} /></td>
                    <td className="px-4 py-4 mono text-slate-300">{daysLabel(waitingDays(request.submittedAt, now))}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-1.5 font-bold text-sky-300">{request.targetRole}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <form action={assumeAcademyInstruction}>
                        <input type="hidden" name="track" value={track} />
                        <input type="hidden" name="requestId" value={request.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-2 font-semibold text-sky-300 transition hover:bg-sky-400 hover:text-slate-950"
                        >
                          Asumir
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No hay evaluaciones esperando instructor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel rounded-3xl p-6 md:p-8">
        <div>
          <p className="mono text-xs uppercase tracking-[0.22em] text-emerald-300/70">Seguimiento</p>
          <h2 className="mt-2 text-2xl font-extrabold">Usuarios en proceso de instrucción</h2>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Instructor</th>
                <th className="px-4 py-3 font-semibold">En instrucción</th>
              </tr>
            </thead>
            <tbody>
              {instruction.length ? (
                instruction.map((request) => (
                  <tr key={request.id} className="border-t border-white/10 bg-slate-950/25">
                    <td className="px-4 py-4"><Applicant request={request} /></td>
                    <td className="px-4 py-4 font-bold text-sky-300">{request.targetRole}</td>
                    <td className="px-4 py-4 text-slate-300">{request.instructorName ?? "Instructor asignado"}</td>
                    <td className="px-4 py-4 mono text-slate-400">
                      {daysLabel(waitingDays(request.assumedAt ?? request.submittedAt, now))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No hay usuarios en instrucción actualmente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
