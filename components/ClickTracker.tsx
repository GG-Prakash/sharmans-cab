"use client";

import { useEffect } from "react";
import { track, type TrackEvent } from "@/lib/track";

// One delegated listener for every <TrackedLink />, instead of hydrating each link.
export default function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[data-track]");
      if (!a) return;
      track(a.dataset.track as TrackEvent, { cta_location: a.dataset.cta });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
