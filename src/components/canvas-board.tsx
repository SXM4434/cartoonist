import { useMemo, useRef } from "react";
import type { Card, Connection, Participant } from "@/lib/canvas-types";
import { CanvasCard } from "./canvas-card";

export function CanvasBoard({
  cards,
  connections,
  participants = [],
  onMoveCard,
  highlightedIds,
}: {
  cards: readonly Card[];
  connections: readonly Connection[];
  participants?: readonly Participant[];
  onMoveCard: (id: string, x: number, y: number) => void;
  highlightedIds?: Set<string>;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);

  const cardMap = useMemo(() => {
    const m = new Map<string, Card>();
    cards.forEach((c) => m.set(c.id, c));
    return m;
  }, [cards]);

  return (
    <div
      ref={boardRef}
      className="relative h-full w-full overflow-auto bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] bg-[length:24px_24px]"
    >
      <div className="relative" style={{ width: 4000, height: 3000 }}>
        {/* SVG arrows behind cards */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={4000}
          height={3000}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          {connections.map((conn) => {
            const a = cardMap.get(conn.from);
            const b = cardMap.get(conn.to);
            if (!a || !b) return null;
            const x1 = a.x + 112;
            const y1 = a.y + 40;
            const x2 = b.x + 112;
            const y2 = b.y + 40;
            return (
              <g key={conn.id} className="text-stone-500">
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeWidth={2}
                  markerEnd="url(#arrow)"
                />
                {conn.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    fontSize="11"
                    fill="currentColor"
                    textAnchor="middle"
                    className="font-medium"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Cards */}
        {cards.map((c) => (
          <CanvasCard
            key={c.id}
            card={c}
            onMove={onMoveCard}
            highlight={highlightedIds?.has(c.id)}
          />
        ))}

        {participants.length === 0 && cards.length === 0 && (
          <div className="absolute left-10 top-10 max-w-md border border-border bg-background p-5">
            <p className="eyebrow text-primary">Ready</p>
            <p className="mt-2 font-display" style={{ fontSize: "var(--step-3)" }}>
              Start the demo or add an anonymous note.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
