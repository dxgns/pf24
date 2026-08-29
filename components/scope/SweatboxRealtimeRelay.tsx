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

const RECONNECT_DELAY_MS = 1500;
const STUDENT_REQUEST_INTERVAL_MS = 2500;
const STUDENT_STALE_MS = 3000;

function scopeUiConnected() {
  if (typeof document === "undefined") return false;
  const row = document.querySelector<HTMLElement>("main.fixed header > div:first-child");
  return Array.from(row?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []).some(
    (button) => button.textContent?.trim().toUpperCase() === "DISCONNECT",
  );
}

function initialSession(): SweatboxSessionDetail {
  const mode = readScopeServerMode();
  return {
    connected: scopeUiConnected(),
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

export default function SweatboxRealtimeRelay({ canInstruct }: Props) {
  const [session, setSession] = useState<SweatboxSessionDetail>(() => initialSession());
  const [retryGeneration, setRetryGeneration] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const latestSnapshotRef = useRef<SweatboxSnapshot | null>(null);
  const lastReceivedAtRef = useRef(0);

  useEffect(() => {
    const onSession = (event: Event) => {
      const detail = (event as CustomEvent<SweatboxSessionDetail>).detail;
      if (!detail) return;
      setSession({
        ...detail,
        instructor: detail.mode === "SWEATBOX_INSTRUCTOR" && detail.instructor && canInstruct,
      });
      if (!detail.connected || detail.mode === "AUTOMATIC") {
        latestSnapshotRef.current = null;
        lastReceivedAtRef.current = 0;
      }
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
    let disposed = false;
    let reconnectTimer: number | null = null;

    const queueReconnect = () => {
      if (disposed || reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!disposed) setRetryGeneration((value) => value + 1);
      }, RECONNECT_DELAY_MS);
    };

    const sendBroadcast = async (event: string, payload: unknown) => {
      if (!subscribed || disposed) return false;
      try {
        const result = await channel.send({ type: "broadcast", event, payload });
        if (result === "ok") return true;
      } catch {
        // Rejoin below. Realtime errors are recoverable for a training room.
      }
      queueReconnect();
      return false;
    };

    const sendLatest = async () => {
      if (!instructor) return;
      const snapshot = latestSnapshotRef.current;
      if (!snapshot) return;
      await sendBroadcast("snapshot", snapshot);
    };

    const requestSnapshot = async () => {
      if (instructor) return;
      await sendBroadcast("snapshot-request", {
        room: session.room,
        requestedAt: Date.now(),
      });
    };

    channel
      .on("broadcast", { event: "snapshot" }, ({ payload }) => {
        if (instructor || !validSnapshot(payload, session.room)) return;
        latestSnapshotRef.current = payload;
        lastReceivedAtRef.current = Date.now();
        dispatchSnapshot(payload);
      })
      .on("broadcast", { event: "snapshot-request" }, ({ payload }) => {
        if (!instructor) return;
        if (payload && typeof payload === "object") {
          const requestedRoom = String((payload as Record<string, unknown>).room ?? "");
          if (requestedRoom && requestedRoom !== session.room) return;
        }
        void sendLatest();
      })
      .subscribe(async (status) => {
        if (disposed) return;
        if (status !== "SUBSCRIBED") {
          subscribed = false;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") queueReconnect();
          return;
        }

        subscribed = true;
        try {
          // Presence is deliberately static. Supabase Presence is for low-frequency
          // membership state, not aircraft positions. Updating it with snapshots
          // can trigger the client presence rate limit and close the whole channel.
          await channel.track({
            role: instructor ? "INSTRUCTOR" : "STUDENT",
            room: session.room,
            updatedAt: Date.now(),
          });
        } catch {
          queueReconnect();
          return;
        }

        if (instructor) await sendLatest();
        else await requestSnapshot();
      });

    const onLocalSnapshot = (event: Event) => {
      if (!instructor) return;
      const snapshot = (event as CustomEvent<SweatboxSnapshot>).detail;
      if (!validSnapshot(snapshot, session.room)) return;
      latestSnapshotRef.current = snapshot;
      if (subscribed) void sendLatest();
    };

    if (instructor) window.addEventListener(SWEATBOX_SNAPSHOT_EVENT, onLocalSnapshot);

    const requestTimer = !instructor
      ? window.setInterval(() => {
          if (!subscribed) return;
          const last = lastReceivedAtRef.current;
          if (last && Date.now() - last < STUDENT_STALE_MS) return;
          void requestSnapshot();
        }, STUDENT_REQUEST_INTERVAL_MS)
      : null;

    return () => {
      disposed = true;
      if (instructor) window.removeEventListener(SWEATBOX_SNAPSHOT_EVENT, onLocalSnapshot);
      if (requestTimer !== null) window.clearInterval(requestTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      subscribed = false;
      channelRef.current = null;
      clientRef.current = null;
      void client.removeChannel(channel);
    };
  }, [session.connected, session.mode, session.room, session.instructor, canInstruct, retryGeneration]);

  return null;
}
