"use client";

import ProjectFlightTrafficV6 from "@/components/scope/ProjectFlightTrafficV6";
import GroundHeadingVectorFix from "@/components/scope/GroundHeadingVectorFix";
import { installTrafficCalibrationShim } from "@/components/scope/TrafficCalibrationShim";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  serverId: string;
};

export default function ProjectFlightTrafficConfigured({ initialPlans, serverId }: Props) {
  installTrafficCalibrationShim();

  return <>
    <ProjectFlightTrafficV6 initialPlans={initialPlans} serverId={serverId} />
    <GroundHeadingVectorFix />
  </>;
}
