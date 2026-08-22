"use client";

import { useCallback, useEffect, useRef } from "react";

type IncomingKind = "incoming-transfer" | "incoming-request";
type VisualState = Record<string, { kind: IncomingKind; from: string; to: string }>;
type VisualEventDetail = { states?: VisualState };

const VISUAL_EVENT = "pf24-traffic-handover-state";

function stateSignature(key: string, state: VisualState[string]) {
  return `${state.kind}:${key}:${state.from}:${state.to}`;
}

function scheduleTone(context: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export default function ScopeHandoverAudioAlerts() {
  const audioRef = useRef<AudioContext | null>(null);
  const visibleRef = useRef(new Set<string>());

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
    const context = audioRef.current ?? new window.AudioContext();
    audioRef.current = context;
    if (context.state === "suspended") {
      try { await context.resume(); } catch { return null; }
    }
    return context;
  }, []);

  const playAlert = useCallback(async (kind: IncomingKind) => {
    const context = await ensureAudio();
    if (!context || context.state !== "running") return;
    const now = context.currentTime + 0.01;

    if (kind === "incoming-transfer") {
      // Two rising tones: traffic is being transferred to this controller.
      scheduleTone(context, 820, now, 0.105);
      scheduleTone(context, 1040, now + 0.145, 0.12);
      return;
    }

    // Three shorter tones: another controller requested the traffic on frequency.
    scheduleTone(context, 650, now, 0.08);
    scheduleTone(context, 650, now + 0.115, 0.08);
    scheduleTone(context, 780, now + 0.23, 0.095);
  }, [ensureAudio]);

  useEffect(() => {
    const unlock = () => { void ensureAudio(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);

    const onVisualState = (event: Event) => {
      const states = (event as CustomEvent<VisualEventDetail>).detail?.states ?? {};
      const nextVisible = new Set<string>();

      for (const [key, state] of Object.entries(states)) {
        const signature = stateSignature(key, state);
        nextVisible.add(signature);
        if (!visibleRef.current.has(signature)) void playAlert(state.kind);
      }

      visibleRef.current = nextVisible;
    };

    window.addEventListener(VISUAL_EVENT, onVisualState);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener(VISUAL_EVENT, onVisualState);
      const context = audioRef.current;
      audioRef.current = null;
      if (context && context.state !== "closed") void context.close();
    };
  }, [ensureAudio, playAlert]);

  return null;
}
