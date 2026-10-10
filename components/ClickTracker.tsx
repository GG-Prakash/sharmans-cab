"use client";

import { useEffect } from "react";
import { track, type TrackEvent } from "@/lib/track";
import { captureAttribution } from "@/lib/attribution";

// One delegated listener for every <TrackedLink />, instead of hydrating each link.
// Also records which ad/campaign brought the visitor (see lib/attribution).
export default function ClickTracker() {
  useEffect(() => {
    captureAttribution();
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
