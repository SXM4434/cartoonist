import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/canvas-types";
import { cn } from "@/lib/utils";

const CARD_STYLES: Record<string, string> = {
  sticky: "bg-amber-100 border-amber-300 text-amber-950",
  flowStep: "bg-orange-100 border-orange-300 text-orange-950",
  journeyStep: "bg-blue-100 border-blue-300 text-blue-950",
  decision: "bg-emerald-100 border-emerald-300 text-emerald-950",
  actionItem: "bg-rose-100 border-rose-300 text-rose-950",
  participant: "bg-stone-100 border-stone-400 text-stone-900",
  section: "bg-transparent border-dashed border-stone-400 text-stone-700",
};

const TYPE_LABELS: Record<string, string> = {
  sticky: "Idea",
  flowStep: "Step",
  journeyStep: "Journey",
  decision: "Decision",
  actionItem: "Action",
  participant: "Person",
  section: "Section",
};

export function CanvasCard({
  card,
  onMove,
  highlight,
}: {
  card: Card;
  onMove: (id: string, x: number, y: number) => void;
  highlight?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(
    null,
  );
  const [glow, setGlow] = useState(false);

  // glow when newly created
  useEffect(() => {
    setGlow(true);
    const t = setTimeout(() => setGlow(false), 1400);
    return () => clearTimeout(t);
  }, [card.id]);

  useEffect(() => {
    if (!dragOffset) return;
    const onMoveDoc = (e: PointerEvent) => {
      onMove(card.id, e.clientX - dragOffset.dx, e.clientY - dragOffset.dy);
    };
    const onUp = () => setDragOffset(null);
    window.addEventListener("pointermove", onMoveDoc);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMoveDoc);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragOffset, card.id, onMove]);

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const rect = ref.current!.getBoundingClientRect();
        setDragOffset({ dx: e.clientX - rect.left, dy: e.clientY - rect.top });
      }}
      style={{
        left: card.x,
        top: card.y,
        position: "absolute",
        transform: "translate(0,0)",
      }}
      className={cn(
        "w-56 cursor-grab select-none rounded border-2 p-3 transition-all active:cursor-grabbing",
        CARD_STYLES[card.type] ?? CARD_STYLES.sticky,
        (glow || highlight) && "ring-4 ring-primary/60 ring-offset-2 ring-offset-background",
      )}
    >
      <div className="eyebrow mb-1 flex items-center justify-between opacity-70">
        <span>{TYPE_LABELS[card.type] ?? card.type}</span>
        {card.author && <span className="truncate max-w-[60%]">{card.author}</span>}
      </div>
      <div className="font-sans leading-snug" style={{ fontSize: "var(--step-1)" }}>{card.text}</div>
      {card.owner && (
        <div className="mt-2 opacity-70" style={{ fontSize: "var(--step-1)" }}>→ {card.owner}</div>
      )}
    </div>
  );
}
