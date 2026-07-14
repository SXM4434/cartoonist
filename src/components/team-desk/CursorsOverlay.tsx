import type { RemoteCursor } from "@/hooks/use-live-cursors";

/**
 * CursorsOverlay — renders remote participant pointers over the canvas.
 * Positioned by normalized coordinates so it stays sane across viewport sizes.
 */
export function CursorsOverlay({ cursors }: { cursors: Record<string, RemoteCursor> }) {
  const entries = Object.values(cursors);
  if (entries.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {entries.map((c) => (
        <div
          key={c.pid}
          className="absolute -translate-x-[3px] -translate-y-[3px] transition-[left,top] duration-75 ease-linear"
          style={{ left: `${c.nx * 100}%`, top: `${c.ny * 100}%` }}
        >
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none" style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.35))" }}>
            <path d="M1 1 L1 14 L5 11 L7.5 16 L10 15 L7.5 10 L13 10 Z" fill={c.color} stroke="#1a1a1a" strokeWidth="1" strokeLinejoin="round" />
          </svg>
          <span
            className="ml-2 inline-block whitespace-nowrap border border-border px-1.5 py-0.5 font-medium text-background"
            style={{ backgroundColor: c.color, fontSize: "var(--step-0)" }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
