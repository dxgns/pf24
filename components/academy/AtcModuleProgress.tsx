"use client";

import AcademyModuleProgress from "@/components/academy/AcademyModuleProgress";

export default function AtcModuleProgress({
  moduleNumber,
  evaluationModule,
}: {
  moduleNumber: number;
  evaluationModule: number;
}) {
  return (
    <AcademyModuleProgress
      endpoint="/academia/atc/api/progress"
      moduleNumber={moduleNumber}
      evaluationModule={evaluationModule}
    />
  );
}
