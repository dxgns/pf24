"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import {
  SCOPE_SERVER_EVENT,
  SWEATBOX_SNAPSHOT_EVENT,
  readScopeServerMode,
  readSweatboxRoom,
  type SweatboxSessionDetail,
  type SweatboxSnapshot,
} from "@/lib/scope/sweatbox";

type Props = {
  canInstruct: boolean;
};

function initialSession(): SweatboxSessionDetail {
  const mode = readScopeServerMode();
  return {
    connected: false,
    mode,
    room: readSweatboxRoom(),
    instructor: false,
  };
}

function createRelayClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default function SweatboxRealtimeRelay({ canInstruct }: Props) {
  const [session, setSession] = useState<SweatboxSessionDetail>(() => initialSession());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setSession({
        ...detail,
        instructor: detail.mode === "SWEATBOX_INSTRUCTOR" && detail.instructor && canInstruct,
      });
    };

    window.addEventListener(SCOPE_SERVER_EVENT, onSession);
    return () => window.removeEventListener(SCOPE_SERVER_EVENT, onSession);
  }, [canInstruct]);

  useEffect(() => {
    if (!session.connected || session.mode === "AUTOMATIC" || !session.room) return;

    const client = createRelayClient();
    if (!client) return;
    clientRef.current = client;

    const instructor = session.mode === "SWEATBOX_INSTRUCTOR" && session.instructor && canInstruct;
    const channel = client.channel(`pf24-sweatbox-${session.room}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "snapshot" }, ({ payload }) => {
      if (instructor) return;
      const snapshot = payload as SweatboxSnapshot;
      if (!snapshot || snapshot.room !== session.room || !Array.isArray(snapshot.traffic)) return;

      // The main Sweatbox runtime receives the same server broadcast on its own
      // client. Re-dispatching it locally also keeps room-local consumers such as
      // the Sector List in sync without touching the live-network data sources.
      window.dispatchEvent(new CustomEvent(SWEATBOX_SNAPSHOT_EVENT, { detail: snapshot }));
    });

    void channel.subscribe();

    const onLocalSnapshot = (event: Event) => {
      if (!instructor) return;
      const snapshot = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (!snapshot || snapshot.room !== session.room || !Array.isArray(snapshot.traffic)) return;
      void channel.send({ type: "broadcast", event: "snapshot", payload: snapshot });
    };

    if (instructor) window.addEventListener(SWEATBOX_SNAPSHOT_EVENT, onLocalSnapshot);

    return () => {
      if (instructor) window.removeEventListener(SWEATBOX_SNAPSHOT_EVENT, onLocalSnapshot);
      channelRef.current = null;
      clientRef.current = null;
      void client.removeChannel(channel);
    };
  }, [session.connected, session.mode, session.room, session.instructor, canInstruct]);

  return null;
}
