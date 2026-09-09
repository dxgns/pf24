"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

const PHOTOS = [
  "/images/community/photo-hq-01.webp?v=20260909q4",
  "/images/community/hq/photo-01.webp?v=20260909q4",
  "/images/community/hq/photo-02.webp?v=20260909q4",
  "/images/community/hq/photo-03.webp?v=20260909q4",
] as const;

const LAST_PHOTO_KEY = "pf24-community-photo-last-src";

function randomIndex(max: number) {
  if (max <= 1) return 0;

  try {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] % max;
  } catch {
    return Math.floor(Math.random() * max);
  }
}

function choosePhoto(previousSrc: string | null, blocked: Set<string> = new Set()) {
  const available = PHOTOS.filter((src) => src !== previousSrc && !blocked.has(src));
  const pool = available.length > 0 ? available : PHOTOS.filter((src) => !blocked.has(src));

  if (pool.length === 0) return PHOTOS[0];
  return pool[randomIndex(pool.length)];
}

function useRandomPhoto() {
  const pathname = usePathname();
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let previous: string | null = null;

    try {
      previous = window.sessionStorage.getItem(LAST_PHOTO_KEY);
    } catch {
      previous = null;
    }

    const next = choosePhoto(previous);
    setFailed(new Set());
    setPhotoSrc(next);

    try {
      window.sessionStorage.setItem(LAST_PHOTO_KEY, next);
    } catch {
      // La selección sigue funcionando aunque sessionStorage no esté disponible.
    }
  }, [pathname]);

  function handleError() {
    if (!photoSrc) return;

    setFailed((current) => {
      const nextFailed = new Set(current);
      nextFailed.add(photoSrc);
      const replacement = choosePhoto(photoSrc, nextFailed);
      setPhotoSrc(replacement);

      try {
        window.sessionStorage.setItem(LAST_PHOTO_KEY, replacement);
      } catch {
        // Sin sessionStorage simplemente se usa el reemplazo en memoria.
      }

      return nextFailed;
    });
  }

  return { photoSrc, handleError };
}

function CommunityPhoto({
  src,
  onError,
}: {
  src: string;
  onError: () => void;
}) {
  return (
    <img
      src={src}
      alt="Captura de vuelo de la comunidad PF24"
      draggable={false}
      decoding="async"
      onError={onError}
      className="absolute inset-0 h-full w-full select-none object-cover object-center"
    />
  );
}

function PhotoFrame({
  src,
  onError,
  variant,
}: {
  src: string | null;
  onError: () => void;
  variant: "banner" | "hero";
}) {
  const shellClass =
    variant === "hero"
      ? "aspect-video rounded-[2rem] shadow-2xl shadow-black/40"
      : "h-40 rounded-3xl shadow-xl shadow-black/25 sm:h-52 lg:h-60";

  return (
    <div
      className={`relative isolate overflow-hidden border border-white/10 bg-slate-950 ${shellClass}`}
      aria-hidden={src ? undefined : true}
    >
      {src ? <CommunityPhoto src={src} onError={onError} /> : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/35 via-transparent to-black/5" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function RandomSitePhoto({ variant = "banner" }: { variant?: "banner" | "hero" }) {
  const { photoSrc, handleError } = useRandomPhoto();
  return <PhotoFrame src={photoSrc} onError={handleError} variant={variant} />;
}

export default function SitePhotoController() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/scope")) {
      setHost(null);
      return;
    }

    const target = document.querySelector("main.radar-grid > .section-container");
    if (!(target instanceof HTMLElement)) {
      setHost(null);
      return;
    }

    const portalHost = document.createElement("div");
    portalHost.dataset.pf24CommunityPhoto = "true";
    portalHost.className = "mb-6";
    target.prepend(portalHost);
    setHost(portalHost);

    return () => {
      setHost(null);
      portalHost.remove();
    };
  }, [pathname]);

  if (!host) return null;
  return createPortal(<RandomSitePhoto />, host);
}
