"use client";

import { useEffect, useRef, useState } from "react";
import ProjectFlightTrafficV6 from "@/components/scope/ProjectFlightTrafficV6";
import GroundHeadingVectorFix from "@/components/scope/GroundHeadingVectorFix";
import ScopeSweatboxConnect from "@/components/scope/ScopeSweatboxConnect";
import ScopeSweatboxConsoleBridge from "@/components/scope/ScopeSweatboxConsoleBridge";
import ScopeSweatboxInstructorUiFixes from "@/components/scope/ScopeSweatboxInstructorUiFixes";
import ScopeSweatboxSectorIsolation from "@/components/scope/ScopeSweatboxSectorIsolation";
import SweatboxRealtimeRelay from "@/components/scope/SweatboxRealtimeRelay";
import SweatboxRuntime from "@/components/scope/SweatboxRuntime";
import { installTrafficCalibrationShim } from "@/components/scope/TrafficCalibrationShim";
import { installProjectFlightLiveUpdateShim } from "@/components/scope/ProjectFlightLiveUpdateShim";
import {
  SCOPE_SERVER_EVENT,
  SWEATBOX_INSTRUCTOR_ROLE_ID,
  readScopeServerMode,
  type ScopeServerMode,
  type SweatboxSessionDetail,
} from "@/lib/scope/sweatbox";
import type { ScopeFlightPlan } from "@/lib/scope/types";

type Props = {
  initialPlans: ScopeFlightPlan[];
  serverId: string;
  controllerName: string;
  roles: string[];
};

type FeedStatusDetail = { connected?: boolean };

const PROJECT_FLIGHT_FEED_EVENT = "pf24-project-flight-feed-status";
const FEED_STALE_MS = 12000;
const WATCHDOG_INTERVAL_MS = 1000;

export default function ProjectFlightTrafficConfigured({ initialPlans, serverId, controllerName, roles }: Props) {
  installTrafficCalibrationShim();
  installProjectFlightLiveUpdateShim();

  const [feedGeneration, setFeedGeneration] = useState(0);
  const [scopeServerMode, setScopeServerMode] = useState<ScopeServerMode>(() => readScopeServerMode());
  const lastHealthyUpdateRef = useRef(0);
  const consecutiveHealthyEventsRef = useRef(0);
  const everReceivedTrafficRef = useRef(false);
  const canInstruct = roles.includes(SWEATBOX_INSTRUCTOR_ROLE_ID);

  useEffect(() => {
    const onServer = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (detail?.mode) setScopeServerMode(detail.mode);
    };
    window.addEventListener(SCOPE_SERVER_EVENT, onServer);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onServer);
  }, []);

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
      if (consecutiveHealthyEventsRef.current >= 2) everReceivedTrafficRef.current = true;
    };

    window.addEventListener(PROJECT_FLIGHT_FEED_EVENT, onFeedStatus);

    const watchdog = window.setInterval(() => {
      if (scopeServerMode !== "AUTOMATIC") return;
      if (!everReceivedTrafficRef.current || !lastHealthyUpdateRef.current) return;
      if (performance.now() - lastHealthyUpdateRef.current <= FEED_STALE_MS) return;
      resetCurrentHeartbeat();
      setFeedGeneration((current) => current + 1);
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      window.removeEventListener(PROJECT_FLIGHT_FEED_EVENT, onFeedStatus);
      window.clearInterval(watchdog);
    };
  }, [scopeServerMode]);

  return <>
    <ScopeSweatboxConnect controllerName={controllerName} canInstruct={canInstruct} />
    <ScopeSweatboxConsoleBridge controllerName={controllerName} canInstruct={canInstruct} />
    <ScopeSweatboxInstructorUiFixes canInstruct={canInstruct} />
    <ScopeSweatboxSectorIsolation />
    <SweatboxRealtimeRelay canInstruct={canInstruct} />
    <SweatboxRuntime controllerName={controllerName} canInstruct={canInstruct} />
    {scopeServerMode === "AUTOMATIC" && <>
      <ProjectFlightTrafficV6
        key={`${serverId}-${feedGeneration}`}
        initialPlans={initialPlans}
        serverId={serverId}
      />
      <GroundHeadingVectorFix />
    </>}
  </>;
}
