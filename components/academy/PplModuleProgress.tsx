"use client";

import AcademyModuleProgress from "@/components/academy/AcademyModuleProgress";
import { PPL_EVALUATION_MODULE } from "@/lib/academy/pplModules";

export default function PplModuleProgress({ moduleNumber }: { moduleNumber: number }) {
  return (
    <AcademyModuleProgress
      endpoint="/academia/piloto/ppl/api/progress"
      moduleNumber={moduleNumber}
      evaluationModule={PPL_EVALUATION_MODULE}
    />
  );
}
