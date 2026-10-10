export type TrackEvent = "call_click" | "whatsapp_click" | "form_submit";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export function track(event: TrackEvent, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}
