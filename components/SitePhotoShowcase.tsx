"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

// Solo assets que hoy sabemos que cargan correctamente en producción.
// Las fotos JPG se mantienen como fallback visual hasta reemplazarlas por HQ válidas.
const PHOTOS = [
  "/images/community/photo-hq-01.webp?v=20260909q5",
  "/images/community/photo-01.jpg?v=20260909q5",
  "/images/community/photo-02.jpg?v=20260909q5",
  "/images/community/photo-03.jpg?v=20260909q5",
  "/images/community/photo-04.jpg?v=20260909q5",
] as const;

const LAST_PHOTO_KEY = "pf24-community-photo-last-src-v2";

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
  const [photoSrc, setPhotoSrc] = useState<string>(PHOTOS[0]);
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

function CommunityPhoto({ src, onError }: { src: string; onError: () => void }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      onError={onError}
      className="absolute inset-0 h-full w-full select-none object-cover object-center"
      aria-hidden="true"
    />
  );
}

function HeroPhoto({ src, onError }: { src: string; onError: () => void }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050612]" aria-hidden="true">
      <CommunityPhoto src={src} onError={onError} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020617]/94 via-[#020617]/64 to-[#020617]/18" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050612]/48 via-transparent to-black/20" />
    </div>
  );
}

function BannerPhoto({ src, onError }: { src: string; onError: () => void }) {
  return (
    <div className="relative h-40 overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-xl shadow-black/25 sm:h-52 lg:h-60">
      <CommunityPhoto src={src} onError={onError} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/20 via-transparent to-black/5" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function RandomSitePhoto({ variant = "banner" }: { variant?: "banner" | "hero" }) {
  const { photoSrc, handleError } = useRandomPhoto();

  return variant === "hero" ? (
    <HeroPhoto src={photoSrc} onError={handleError} />
  ) : (
    <BannerPhoto src={photoSrc} onError={handleError} />
  );
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
