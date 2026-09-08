"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

const PHOTO_STRIPS = [
  "/images/community/strip-1.webp",
  "/images/community/strip-2.webp",
  "/images/community/strip-3.webp",
  "/images/community/strip-4.webp",
  "/images/community/strip-5.webp",
] as const;

const PHOTOS_PER_STRIP = 5;
const PHOTO_COUNT = PHOTO_STRIPS.length * PHOTOS_PER_STRIP;
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
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    setPhotoIndex(choosePhotoIndex());
  }, [pathname]);

  return photoIndex;
}

function PhotoFrame({
  photoIndex,
  variant,
}: {
  photoIndex: number | null;
  variant: "banner" | "hero";
}) {
  const shellClass =
    variant === "hero"
      ? "aspect-video rounded-[2rem] shadow-2xl shadow-black/40"
      : "h-40 rounded-3xl shadow-xl shadow-black/25 sm:h-52 lg:h-60";

  if (photoIndex === null) {
    return (
      <div
        className={`relative overflow-hidden border border-white/10 bg-slate-900/80 ${shellClass}`}
        aria-hidden="true"
      />
    );
  }

  const stripIndex = Math.floor(photoIndex / PHOTOS_PER_STRIP);
  const slotIndex = photoIndex % PHOTOS_PER_STRIP;

  return (
    <div className={`relative isolate overflow-hidden border border-white/10 bg-slate-950 ${shellClass}`}>
      <img
        src={PHOTO_STRIPS[stripIndex]}
        alt="Captura de vuelo de la comunidad PF24"
        loading={variant === "hero" ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="absolute top-1/2 h-auto w-[500%] max-w-none -translate-y-1/2 select-none"
        style={{ left: `-${slotIndex * 100}%` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/65 via-transparent to-black/10" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function RandomSitePhoto({ variant = "banner" }: { variant?: "banner" | "hero" }) {
  const photoIndex = useRandomPhotoIndex();
  return <PhotoFrame photoIndex={photoIndex} variant={variant} />;
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
