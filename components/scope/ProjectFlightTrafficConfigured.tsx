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
// Project Flight occasionally pauses its traffic stream without closing the
// WebSocket. Two and a half seconds was too aggressive and could turn normal
// jitter into a self-inflicted reconnect. Give the feed enough time to recover
// naturally, then remount only the traffic source if it truly stays stale.
const FEED_STALE_MS = 12000;
const WATCHDOG_INTERVAL_MS = 1000;

export default function ProjectFlightTrafficConfigured({ initialPlans, serverId }: Props) {
  // Complete snapshots are calibrated first. The live-update shim then hydrates
  // Project Flight's position-only delta packets with the identity learned from
  // those snapshots, allowing ProjectFlightTrafficV6 to consume both formats.
  installTrafficCalibrationShim();
  installProjectFlightLiveUpdateShim();

  const [feedGeneration, setFeedGeneration] = useState(0);
  const lastHealthyUpdateRef = useRef(0);
  const consecutiveHealthyEventsRef = useRef(0);
  // Do not forget that this browser session has already received real traffic.
  // If a later reconnect opens successfully but never produces another decoded
  // packet, the old implementation reset this flag and the watchdog could never
  // recover again without a full page refresh.
  const everReceivedTrafficRef = useRef(false);

  useEffect(() => {
    const resetCurrentHeartbeat = () => {
      lastHealthyUpdateRef.current = 0;
      consecutiveHealthyEventsRef.current = 0;
    };

    const onFeedStatus = (event: Event) => {
      const connected = Boolean((event as CustomEvent<FeedStatusDetail>).detail?.connected);
      if (!connected) {
        resetCurrentHeartbeat();
        return;
      }

      const now = performance.now();
      lastHealthyUpdateRef.current = now;
      consecutiveHealthyEventsRef.current += 1;

      // ProjectFlightTrafficV6 emits one healthy event when the socket opens and
      // another for every successfully decoded traffic message. Once at least one
      // real traffic message has been seen, remember that fact across reconnects.
      if (consecutiveHealthyEventsRef.current >= 2) everReceivedTrafficRef.current = true;
    };

    window.addEventListener(PROJECT_FLIGHT_FEED_EVENT, onFeedStatus);

    const watchdog = window.setInterval(() => {
      if (!everReceivedTrafficRef.current || !lastHealthyUpdateRef.current) return;
      if (performance.now() - lastHealthyUpdateRef.current <= FEED_STALE_MS) return;

      // A Project Flight socket can remain OPEN after its live updates have
      // stalled. Remount only the traffic feed so a fresh stream is requested,
      // while retaining the fact that this session previously had live traffic.
      resetCurrentHeartbeat();
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