import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useMyPresence,
  useOthers,
  useStorage,
  useMutation,
  useRoom,
  type Card,
  type Connection,
} from "@/lib/liveblocks";
import { LiveList } from "@liveblocks/client";
import { CanvasCard } from "./canvas-card";

export function CanvasBoard({
  highlightedIds,
}: {
  highlightedIds?: Set<string>;
}) {
  const cards = useStorage((root) => root.cards) as readonly Card[] | null;
  const connections = useStorage((root) => root.connections) as
    | readonly Connection[]
    | null;
  const others = useOthers();
  const [, setPresence] = useMyPresence();
  const room = useRoom();
  const boardRef = useRef<HTMLDivElement | null>(null);

  const moveCard = useMutation((context, id: string, x: number, y: number) => {
    if (!room.isStorageReady()) return;
    const list = context.storage.get("cards") as LiveList<Card>;
    const idx = list.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const existing = list.get(idx)!;
      list.set(idx, { ...existing, x, y });
    }
  }, [room]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = boardRef.current!.getBoundingClientRect();
      setPresence({
        cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
    },
    [setPresence],
  );

  const onPointerLeave = useCallback(() => {
    setPresence({ cursor: null });
  }, [setPresence]);

  const cardMap = useMemo(() => {
    const m = new Map<string, Card>();
    (cards ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cards]);

  return (
    <div
      ref={boardRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
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
          {(connections ?? []).map((conn) => {
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
        {(cards ?? []).map((c) => (
          <CanvasCard
            key={c.id}
            card={c}
            onMove={moveCard}
            highlight={highlightedIds?.has(c.id)}
          />
        ))}

        {/* Other users' cursors */}
        {others.map((other) => {
          if (!other.presence.cursor) return null;
          return (
            <div
              key={other.connectionId}
              className="pointer-events-none absolute z-50 transition-transform"
              style={{
                left: other.presence.cursor.x,
                top: other.presence.cursor.y,
                color: other.info?.color ?? "#E07A3E",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 2 L18 9 L10 11 L8 18 Z" />
              </svg>
              <span
                className="ml-3 inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white shadow"
                style={{ backgroundColor: other.info?.color ?? "#E07A3E" }}
              >
                {other.info?.name ?? "Guest"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
