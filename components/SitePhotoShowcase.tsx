"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

// Fotografías en alta resolución derivadas directamente de las capturas
// originales de la comunidad. Para ampliar el pool, añadir un archivo aquí.
const PHOTOS = [
  "/images/community/photo-hq-01.webp?v=20260908hq2",
] as const;

const PHOTO_COUNT = PHOTOS.length;
const LAST_PHOTO_KEY = "pf24-community-photo-last";

function choosePhotoIndex() {
  let previous = -1;

  try {
    previous = Number(window.sessionStorage.getItem(LAST_PHOTO_KEY) ?? "-1");
  } catch {
    previous = -1;
  }

  let next = Math.floor(Math.random() * PHOTO_COUNT);
  if (PHOTO_COUNT > 1 && next === previous) {
    next = (next + 1 + Math.floor(Math.random() * (PHOTO_COUNT - 1))) % PHOTO_COUNT;
  }

  try {
    window.sessionStorage.setItem(LAST_PHOTO_KEY, String(next));
  } catch {
    // La rotación sigue funcionando aunque sessionStorage no esté disponible.
  }

  return next;
}

function useRandomPhotoIndex() {
  const pathname = usePathname();
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    setPhotoIndex(choosePhotoIndex());
  }, [pathname]);

  return photoIndex;
}

function CommunityPhoto({
  photoIndex,
  className = "",
}: {
  photoIndex: number;
  className?: string;
}) {
  return (
    <img
      src={PHOTOS[photoIndex]}
      alt=""
      draggable={false}
      decoding="async"
      className={`absolute inset-0 h-full w-full select-none object-cover object-center ${className}`}
      aria-hidden="true"
    />
  );
}

function HeroPhoto({ photoIndex }: { photoIndex: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050612]" aria-hidden="true">
      <CommunityPhoto photoIndex={photoIndex} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020617]/92 via-[#020617]/58 to-[#020617]/8" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050612]/45 via-transparent to-black/15" />
    </div>
  );
}

function BannerPhoto({ photoIndex }: { photoIndex: number }) {
  return (
    <div className="relative h-40 overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-xl shadow-black/25 sm:h-52 lg:h-60">
      <CommunityPhoto photoIndex={photoIndex} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/20 via-transparent to-black/5" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function RandomSitePhoto({ variant = "banner" }: { variant?: "banner" | "hero" }) {
  const photoIndex = useRandomPhotoIndex();
  return variant === "hero" ? (
    <HeroPhoto photoIndex={photoIndex} />
  ) : (
    <BannerPhoto photoIndex={photoIndex} />
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
