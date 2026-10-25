"use client";

import AcademyModuleProgress from "@/components/academy/AcademyModuleProgress";
import { PILOT_EVALUATION_MODULE } from "@/lib/academy/pilotModules";

export default function PilotModuleProgress({ moduleNumber }: { moduleNumber: number }) {
  return (
    <AcademyModuleProgress
      endpoint="/academia/piloto/api/progress"
      moduleNumber={moduleNumber}
      evaluationModule={PILOT_EVALUATION_MODULE}
    />
  );
}
