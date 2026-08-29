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

const PRESENCE_REFRESH_MS = 1000;

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

function validSnapshot(value: unknown, room: string): value is SweatboxSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SweatboxSnapshot>;
  return snapshot.version === 1 && snapshot.room === room && Array.isArray(snapshot.traffic);
}

function dispatchSnapshot(snapshot: SweatboxSnapshot) {
  window.dispatchEvent(new CustomEvent(SWEATBOX_SNAPSHOT_EVENT, { detail: snapshot }));
}

function newestPresenceSnapshot(channel: RealtimeChannel, room: string) {
  const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
  let newest: SweatboxSnapshot | null = null;

  for (const rows of Object.values(state)) {
    for (const row of rows ?? []) {
      if (String(row.role ?? "").toUpperCase() !== "INSTRUCTOR") continue;
      const candidate = row.snapshot;
      if (!validSnapshot(candidate, room)) continue;
      if (!newest || candidate.sentAt > newest.sentAt) newest = candidate;
    }
  }

  return newest;
}

export default function SweatboxRealtimeRelay({ canInstruct }: Props) {
  const [session, setSession] = useState<SweatboxSessionDetail>(() => initialSession());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const latestSnapshotRef = useRef<SweatboxSnapshot | null>(null);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setSession({
        ...detail,
        instructor: detail.mode === "SWEATBOX_INSTRUCTOR" && detail.instructor && canInstruct,
      });
      if (!detail.connected || detail.mode === "AUTOMATIC") latestSnapshotRef.current = null;
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
    const presenceKey = `${instructor ? "instructor" : "student"}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = client.channel(`pf24-sweatbox-${session.room}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: presenceKey },
      },
    });
    channelRef.current = channel;

    let subscribed = false;
    let lastPresenceRefresh = 0;

    const publishPresence = async (force = false) => {
      if (!instructor || !subscribed) return;
      const snapshot = latestSnapshotRef.current;
      if (!snapshot) return;
      const now = Date.now();
      if (!force && now - lastPresenceRefresh < PRESENCE_REFRESH_MS) return;
      lastPresenceRefresh = now;
      await channel.track({
        role: "INSTRUCTOR",
        room: session.room,
        updatedAt: now,
        snapshot,
      });
    };

    const sendLatest = async () => {
      if (!instructor || !subscribed) return;
      const snapshot = latestSnapshotRef.current;
      if (!snapshot) return;
      await channel.send({ type: "broadcast", event: "snapshot", payload: snapshot });
      await publishPresence();
    };

    channel
      .on("broadcast", { event: "snapshot" }, ({ payload }) => {
        if (instructor || !validSnapshot(payload, session.room)) return;
        latestSnapshotRef.current = payload;
        dispatchSnapshot(payload);
      })
      .on("broadcast", { event: "snapshot-request" }, () => {
        if (!instructor) return;
        void sendLatest();
      })
      .on("presence", { event: "sync" }, () => {
        if (instructor) return;
        const snapshot = newestPresenceSnapshot(channel, session.room);
        if (!snapshot) return;
        const current = latestSnapshotRef.current;
        if (current && current.sentAt >= snapshot.sentAt) return;
        latestSnapshotRef.current = snapshot;
        dispatchSnapshot(snapshot);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") {
          subscribed = false;
          return;
        }

        subscribed = true;
        if (instructor) {
          await channel.track({
            role: "INSTRUCTOR",
            room: session.room,
            updatedAt: Date.now(),
            snapshot: latestSnapshotRef.current,
          });
          await sendLatest();
          return;
        }

        await channel.track({
          role: "STUDENT",
          room: session.room,
          updatedAt: Date.now(),
        });
        await channel.send({
          type: "broadcast",
          event: "snapshot-request",
          payload: { room: session.room, requestedAt: Date.now() },
        });

        const snapshot = newestPresenceSnapshot(channel, session.room);
        if (snapshot) {
          latestSnapshotRef.current = snapshot;
          dispatchSnapshot(snapshot);
        }
      });

    const onLocalSnapshot = (event: Event) => {
      if (!instructor) return;
      const snapshot = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (!validSnapshot(snapshot, session.room)) return;
      latestSnapshotRef.current = snapshot;
      if (subscribed) void sendLatest();
    };

    if (instructor) window.addEventListener(SWEATBOX_SNAPSHOT_EVENT, onLocalSnapshot);

    const presenceTimer = instructor
      ? window.setInterval(() => void publishPresence(true), PRESENCE_REFRESH_MS)
      : null;

    return () => {
      if (instructor) window.removeEventListener(SWEATBOX_SNAPSHOT_EVENT, onLocalSnapshot);
      if (presenceTimer !== null) window.clearInterval(presenceTimer);
      subscribed = false;
      channelRef.current = null;
      clientRef.current = null;
      void client.removeChannel(channel);
    };
  }, [session.connected, session.mode, session.room, session.instructor, canInstruct]);

  return null;
}
