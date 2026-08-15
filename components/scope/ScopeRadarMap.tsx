"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_EVENT = "pf24-radar-viewport";
const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";

// User-provided airspace chart, optimized and gzip-compressed so it can live with the Scope component.
const MAP_GZIP_BASE64 = "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[...truncated for brevity...]";

function readViewport(): Viewport {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (!raw) return { zoom: 1, panX: 0, panY: 0 };
    const parsed = JSON.parse(raw) as Partial<Viewport>;
    return {
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1,
      panX: typeof parsed.panX === "number" ? parsed.panX : 0,
      panY: typeof parsed.panY === "number" ? parsed.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

async function inflateSvg(): Promise<string> {
  const binary = atob(MAP_GZIP_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export default function ScopeRadarMap() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });

  useEffect(() => {
    setViewport(readViewport());
    const radar = findRadar();
    setHost(radar);
    const retry = window.setTimeout(() => setHost(findRadar()), 250);
    return () => window.clearTimeout(retry);
  }, []);

  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    void inflateSvg().then((svg) => {
      if (disposed) return;
      url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      setSvgUrl(url);
    });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    const onViewport = (event: Event) => {
      const next = (event as CustomEvent<Viewport>).detail;
      if (next) setViewport(next);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
  }, []);

  if (!host || !svgUrl) return null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-[#070e0c]" aria-hidden="true">
      <img
        src={svgUrl}
        alt=""
        draggable={false}
        className="absolute left-0 top-0 h-full w-full select-none"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      />
    </div>,
    host,
  );
}
