"use client";

import ProjectFlightTrafficV6 from "@/components/scope/ProjectFlightTrafficV6";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  serverId: string;
};

export default function ProjectFlightTrafficConfigured({ initialPlans, serverId }: Props) {
  return <ProjectFlightTrafficV6 initialPlans={initialPlans} serverId={serverId} />;
}
