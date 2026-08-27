"use client";

import PFPilotAutopilotProcedures from "@/components/PFPilotAutopilotProcedures";
import PFPilotGuidanceDirectorV2 from "@/components/PFPilotGuidanceDirectorV2";

type PilotPlan = {
  id: string;
  created_by?: string | null;
  [key: string]: unknown;
};

export default function PFPilotGuidanceDirector({ plan }: { plan: PilotPlan | null }) {
  if (!plan) return <PFPilotGuidanceDirectorV2 plan={null} />;

  return (
    <>
      <style>{`
        .pf24-autopilot-composite > .pf24-guidance-host {
          display: contents !important;
        }
        .pf24-autopilot-composite > .pf24-guidance-host > div {
          display: contents !important;
        }
        .pf24-autopilot-composite > .pf24-guidance-host > div > :nth-child(2) {
          display: none !important;
        }
      `}</style>
      <div className="pf24-autopilot-composite mt-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="pf24-guidance-host">
          <PFPilotGuidanceDirectorV2 plan={plan} />
        </div>
        <PFPilotAutopilotProcedures plan={plan} pilotId={plan.created_by} />
      </div>
    </>
  );
}
