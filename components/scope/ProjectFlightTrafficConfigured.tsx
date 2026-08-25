"use client";

import { useEffect, useRef, useState } from "react";
import ProjectFlightTrafficV6 from "@/components/scope/ProjectFlightTrafficV6";
import GroundHeadingVectorFix from "@/components/scope/GroundHeadingVectorFix";
import { installTrafficCalibrationShim } from "@/components/scope/TrafficCalibrationShim";
import { installProjectFlightLiveUpdateShim } from "@/components/scope/ProjectFlightLiveUpdateShim";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  serverId: string;
};

type FeedStatusDetail = { connected?: boolean };

const PROJECT_FLIGHT_FEED_EVENT = "pf24-project-flight-feed-status";
const FEED_STALE_MS = 2500;
const WATCHDOG_INTERVAL_MS = 500;

export default function ProjectFlightTrafficConfigured({ initialPlans, serverId }: Props) {
  // Complete snapshots are calibrated first. The live-update shim then hydrates
  // Project Flight's position-only delta packets with the identity learned from
  // those snapshots, allowing ProjectFlightTrafficV6 to consume both formats.
  installTrafficCalibrationShim();
  installProjectFlightLiveUpdateShim();

  const [feedGeneration, setFeedGeneration] = useState(0);
  const lastHealthyUpdateRef = useRef(0);
  const consecutiveHealthyEventsRef = useRef(0);
  const hasReceivedTrafficRef = useRef(false);

  useEffect(() => {
    const resetHeartbeat = () => {
      lastHealthyUpdateRef.current = 0;
      consecutiveHealthyEventsRef.current = 0;
      hasReceivedTrafficRef.current = false;
    };

    const onFeedStatus = (event: Event) => {
      const connected = Boolean((event as CustomEvent<FeedStatusDetail>).detail?.connected);
      if (!connected) {
        resetHeartbeat();
        return;
      }

      const now = performance.now();
      lastHealthyUpdateRef.current = now;
      consecutiveHealthyEventsRef.current += 1;

      // ProjectFlightTrafficV6 emits one healthy event when the socket opens and
      // another for every successfully decoded traffic message. Requiring the
      // second event prevents an empty server from being reconnected forever.
      if (consecutiveHealthyEventsRef.current >= 2) hasReceivedTrafficRef.current = true;
    };

    window.addEventListener(PROJECT_FLIGHT_FEED_EVENT, onFeedStatus);

    const watchdog = window.setInterval(() => {
      if (!hasReceivedTrafficRef.current || !lastHealthyUpdateRef.current) return;
      if (performance.now() - lastHealthyUpdateRef.current <= FEED_STALE_MS) return;

      // A Project Flight socket can remain OPEN after its live updates have
      // stalled. Remount only the traffic feed so a fresh snapshot/stream is
      // obtained without refreshing or resetting the rest of the Scope.
      resetHeartbeat();
      setFeedGeneration((current) => current + 1);
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      window.removeEventListener(PROJECT_FLIGHT_FEED_EVENT, onFeedStatus);
      window.clearInterval(watchdog);
    };
  }, []);

  return <>
    <ProjectFlightTrafficV6
      key={`${serverId}-${feedGeneration}`}
      initialPlans={initialPlans}
      serverId={serverId}
    />
    <GroundHeadingVectorFix />
  </>;
}
