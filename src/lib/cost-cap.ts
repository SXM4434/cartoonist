/**
 * v1 P1.9 — soft cost cap.
 * Per-room spend ceiling kept client-side (localStorage). When the session sum
 * crosses the cap, the server degrades the renderer to Flash and the HUD shows
 * a "saving" state. Off by default (0 = no cap).
 */
const KEY = (roomId: string) => `cartoonist:cost-cap:${roomId}`;
const EVENT = "cartoonist:cost-cap";

export function getCostCap(roomId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY(roomId));
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function setCostCap(roomId: string, cap: number) {
  if (typeof window === "undefined") return;
  if (cap > 0) window.localStorage.setItem(KEY(roomId), String(cap));
  else window.localStorage.removeItem(KEY(roomId));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { roomId, cap } }));
}

export function onCostCapChange(roomId: string, fn: (cap: number) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ roomId: string; cap: number }>).detail;
    if (detail?.roomId === roomId) fn(detail.cap);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
