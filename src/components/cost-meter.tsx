import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * v1 P1.9 — Live cost meter.
 * HUD pill bottom-right of the canvas. Sums cost_usd from `ai_calls` for the
 * current room and updates in near-realtime as new AI calls land.
 */
export function CostMeter({ roomId }: { roomId: string }) {
  const [totalUsd, setTotalUsd] = useState(0);
  const [calls, setCalls] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const { data } = await supabase
        .from("ai_calls")
        .select("cost_usd")
        .eq("room_id", roomId);
      if (cancelled || !data) return;
      setCalls(data.length);
      setTotalUsd(data.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0));
    }
    void loadInitial();

    const channel = supabase
      .channel(`ai_calls:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_calls", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { cost_usd?: number | string };
          const cost = Number(row.cost_usd ?? 0);
          setTotalUsd((prev) => prev + (Number.isFinite(cost) ? cost : 0));
          setCalls((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const display =
    totalUsd < 0.01
      ? `$${totalUsd.toFixed(4)}`
      : totalUsd < 1
      ? `$${totalUsd.toFixed(3)}`
      : `$${totalUsd.toFixed(2)}`;

  return (
    <div
      className="pointer-events-none absolute right-5 top-4 z-10 flex items-center gap-1.5 px-1.5 py-0.5 text-muted-foreground/70 opacity-60 transition-opacity hover:opacity-100"
      title={`${calls} AI call${calls === 1 ? "" : "s"} this session`}
    >
      <Coins className="h-3 w-3" />
      <span className="eyebrow text-muted-foreground">Session</span>
      <span
        className="font-medium tabular-nums text-foreground"
        style={{ fontSize: "var(--step-0)" }}
      >
        {display}
      </span>
    </div>
  );
}
