import { useEffect, useState } from "react";
import { Coins, Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCostCap, onCostCapChange, setCostCap } from "@/lib/cost-cap";

/**
 * v1 P1.9 — Live cost meter + soft cost cap.
 * HUD pill bottom-right of the canvas. Sums cost_usd from `ai_calls` for the
 * current room, updates in near-realtime, and lets the host set a soft cap.
 * Past the cap the renderer degrades to a cheaper model ("saving") instead of
 * stopping the session.
 */
export function CostMeter({ roomId }: { roomId: string }) {
  const [totalUsd, setTotalUsd] = useState(0);
  const [calls, setCalls] = useState(0);
  const [cap, setCap] = useState(0);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setCap(getCostCap(roomId));
    return onCostCapChange(roomId, setCap);
  }, [roomId]);

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

  const saving = cap > 0 && totalUsd >= cap;

  const commit = () => {
    const n = Number(draft);
    setCostCap(roomId, Number.isFinite(n) && n > 0 ? n : 0);
  };

  return (
    <Popover onOpenChange={(open) => open && setDraft(cap > 0 ? String(cap) : "")}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${calls} AI call${calls === 1 ? "" : "s"} this session`}
          className={`absolute right-5 top-4 z-10 flex items-center gap-1.5 border border-transparent px-1.5 py-0.5 transition active:scale-[0.98] hover:border-border ${
            saving ? "text-foreground" : "text-muted-foreground/70 opacity-60 hover:opacity-100"
          }`}
        >
          {saving ? <Leaf className="h-3 w-3 text-primary" /> : <Coins className="h-3 w-3" />}
          <span className="eyebrow">{saving ? "Saving" : "Session"}</span>
          <span className="tabular-nums" style={{ fontSize: "var(--step-0)" }}>
            {display}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="eyebrow text-muted-foreground">Soft cost cap</p>
        <p className="mt-1.5 text-muted-foreground" style={{ fontSize: "var(--step--1)", lineHeight: 1.5 }}>
          Past the cap, drawing switches to a cheaper model instead of stopping.
        </p>
        <div className="mt-2.5 flex items-stretch gap-1.5">
          <div className="flex flex-1 items-center border border-border px-2">
            <span className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>$</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              inputMode="decimal"
              placeholder="off"
              className="w-full bg-transparent px-1 py-1.5 tabular-nums outline-none"
              style={{ fontSize: "var(--step-0)" }}
            />
          </div>
          <button
            type="button"
            onClick={commit}
            className="border border-foreground bg-foreground px-2.5 text-background transition active:scale-[0.98]"
          >
            <span className="eyebrow">Set</span>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="eyebrow text-muted-foreground">
            {cap > 0 ? `Cap $${cap}` : "No cap"} · {calls} call{calls === 1 ? "" : "s"}
          </span>
          {cap > 0 && (
            <button
              type="button"
              onClick={() => { setCostCap(roomId, 0); setDraft(""); }}
              className="eyebrow text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
