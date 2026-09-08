"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

const PHOTO_STRIPS = [
  "/images/community/strip-1.jpg",
  "/images/community/strip-2.jpg",
  "/images/community/strip-3.jpg",
  "/images/community/strip-4.jpg",
  "/images/community/strip-5.jpg",
] as const;

const PHOTOS_PER_STRIP = 4;
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

function CommunityPhoto({
  photoIndex,
  className,
  overscan = 1,
}: {
  photoIndex: number;
  className?: string;
  overscan?: number;
}) {
  const stripIndex = Math.floor(photoIndex / PHOTOS_PER_STRIP);
  const slotIndex = photoIndex % PHOTOS_PER_STRIP;
  const totalWidth = PHOTOS_PER_STRIP * overscan;
  const centeredOffset = slotIndex * overscan + (overscan - 1) / 2;
  const position = totalWidth > 1 ? (centeredOffset / (totalWidth - 1)) * 100 : 50;

  return (
    <div
      className={className}
      style={{
        backgroundImage: `url("${PHOTO_STRIPS[stripIndex]}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: `${position}% center`,
        backgroundSize: `${totalWidth * 100}% auto`,
      }}
      aria-hidden="true"
    />
  );
}

function HeroPhoto({ photoIndex }: { photoIndex: number | null }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050612]" aria-hidden="true">
      {photoIndex !== null && (
        <CommunityPhoto
          photoIndex={photoIndex}
          overscan={1.1}
          className="absolute inset-0 bg-[#050612]"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020617]/92 via-[#020617]/58 to-[#020617]/8" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050612]/45 via-transparent to-black/15" />
    </div>
  );
}

function BannerPhoto({ photoIndex }: { photoIndex: number | null }) {
  return (
    <div className="relative h-40 overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-xl shadow-black/25 sm:h-52 lg:h-60">
      {photoIndex !== null && (
        <CommunityPhoto
          photoIndex={photoIndex}
          overscan={1.04}
          className="absolute inset-0 bg-slate-950"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/45 via-transparent to-black/10" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function RandomSitePhoto({ variant = "banner" }: { variant?: "banner" | "hero" }) {
  const photoIndex = useRandomPhotoIndex();
  return variant === "hero" ? <HeroPhoto photoIndex={photoIndex} /> : <BannerPhoto photoIndex={photoIndex} />;
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
