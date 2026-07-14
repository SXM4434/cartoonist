import type { Reaction } from "@/hooks/use-reactions";

/**
 * ReactionsOverlay — renders floating emoji bursts at normalized (nx, ny)
 * positions over the canvas stage. Each burst rises and fades over ~2.4s
 * via a CSS keyframe. Pointer-events-none so it never blocks canvas input.
 */
export function ReactionsOverlay({ reactions }: { reactions: Reaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute flex flex-col items-center"
          style={{
            left: `${r.nx * 100}%`,
            top: `${r.ny * 100}%`,
            transform: "translate(-50%, -50%)",
            animation: "cartoonistReactionFloat 2.4s ease-out forwards",
          }}
        >
          <span style={{ fontSize: 34, lineHeight: 1 }}>{r.emoji}</span>
          <span
            className="mt-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
            style={{
              borderColor: r.color,
              color: r.color,
              backgroundColor: "hsl(var(--background))",
              letterSpacing: "0.08em",
            }}
          >
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}
