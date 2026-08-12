import { useSyncExternalStore } from "react";

/**
 * Canvas render system.
 *
 * `fidelity` controls how much visual information a shape carries:
 *   lofi  — monochrome outlines, no fills at all (pure thinking sketch)
 *   mid   — one accent + state colors, flat fills only on emphasis
 *   hifi  — full semantic surfaces, solid fills, production UI look
 *
 * `ink` controls HOW it's drawn:
 *   pencil — hand-drawn wobble strokes, marker typeface
 *   clean  — crisp geometric shapes, sans typeface
 *
 * Nothing in the renderer is ever allowed to use tldraw's translucent
 * "semi" fill — that washed-out look is what made ovals and rectangles
 * read as half-transparent ghosts.
 */
export type Fidelity = "lofi" | "mid" | "hifi";
export type Ink = "pencil" | "clean";
export type RenderStyle = { fidelity: Fidelity; ink: Ink };

const KEY = "cartoonist:render-style";
const DEFAULT: RenderStyle = { fidelity: "mid", ink: "pencil" };

let current: RenderStyle = DEFAULT;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RenderStyle>;
      current = {
        fidelity: parsed.fidelity === "lofi" || parsed.fidelity === "hifi" ? parsed.fidelity : "mid",
        ink: parsed.ink === "clean" ? "clean" : "pencil",
      };
    }
  } catch {
    current = DEFAULT;
  }
}

export function getRenderStyle(): RenderStyle {
  return current;
}

export function setRenderStyle(next: Partial<RenderStyle>) {
  current = { ...current, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable — in-memory is fine */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRenderStyle(): RenderStyle {
  return useSyncExternalStore(subscribe, getRenderStyle, () => DEFAULT);
}
