"use client";

import { useEffect, useState } from "react";
import ProjectFlightTrafficV5 from "@/components/scope/ProjectFlightTrafficV5";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  serverId: string;
};

const PROJECT_FLIGHT_WS_PREFIX = "wss://v3api.project-flight.com/v3/traffic/server/ws/";

export default function ProjectFlightTrafficConfigured({ initialPlans, serverId }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const OriginalWebSocket = window.WebSocket;

    class PF24ConfiguredWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const rawUrl = typeof url === "string" ? url : url.toString();
        const resolvedUrl = rawUrl.startsWith(PROJECT_FLIGHT_WS_PREFIX)
          ? `${PROJECT_FLIGHT_WS_PREFIX}${serverId}`
          : rawUrl;

        if (protocols === undefined) {
          super(resolvedUrl);
        } else {
          super(resolvedUrl, protocols);
        }
      }
    }

    window.WebSocket = PF24ConfiguredWebSocket as typeof WebSocket;
    setReady(true);

    return () => {
      window.WebSocket = OriginalWebSocket;
    };
  }, [serverId]);

  if (!ready) return null;

  return <ProjectFlightTrafficV5 initialPlans={initialPlans} />;
}
