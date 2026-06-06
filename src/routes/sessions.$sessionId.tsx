import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { addSession, loadProfile } from "@/lib/profile";
import { CartoonistHeader } from "./onboarding";

type Room = {
  id: string; name: string; join_code: string | null;
  goal: string | null; outputs: string[] | null;
  facilitation: string | null; host_role: string | null;
};
type Participant = { id: string; display_name: string; role: string | null; color: string | null; personality: string | null };

export const Route = createFileRoute("/sessions/$sessionId")({
  ssr: false,
  component: Lobby,
});

function Lobby() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load room + participants + subscribe to realtime
  useEffect(() => {
    const p = loadProfile();
    if (!p) { sessionStorage.setItem("cartoonist_pending_join", sessionId); navigate({ to: "/onboarding" }); return; }

    let cancelled = false;
    (async () => {
      const { data: r, error } = await supabase
        .from("rooms")
        .select("id,name,join_code,goal,outputs,facilitation,host_role")
        .eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      if (error || !r) { toast.error("Session not found"); navigate({ to: "/dashboard" }); return; }
      setRoom(r as Room);

      const { data: parts } = await supabase
        .from("participants").select("id,display_name,role,color,personality").eq("room_id", sessionId);
      if (!cancelled) setParticipants((parts ?? []) as Participant[]);

      // Auto-join if not already a participant under this name
      const already = (parts ?? []).some((x) => x.display_name === p.displayName);
      if (!already) {
        const { data: inserted } = await supabase.from("participants").insert({
          room_id: sessionId,
          display_name: p.displayName,
          role: p.role || null,
          personality: r.host_role ?? null,
          color: p.color,
        }).select("id,display_name,role,color,personality").single();
        if (!cancelled && inserted) {
          setParticipants((cur) => cur.find((x) => x.id === inserted.id) ? cur : [...cur, inserted as Participant]);
        }
      }
      if (!cancelled) {
        setHasJoined(true);
        addSession({
          roomId: r.id,
          joinCode: r.join_code ?? "",
          name: r.name,
          goal: r.goal ?? "",
          outputs: r.outputs ?? [],
          createdAt: Date.now(),
        });
      }
    })();

    const channel = supabase.channel(`lobby:${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `room_id=eq.${sessionId}` },
        (payload) => {
          const p = payload.new as Participant;
          setParticipants((cur) => cur.find((x) => x.id === p.id) ? cur : [...cur, p]);
        })
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [sessionId, navigate]);

  const start = () => {
    if (!room) return;
    localStorage.setItem(`cartoonist_joined_${room.id}`, "1");
    navigate({ to: "/r/$roomId", params: { roomId: room.id } });
  };

  const copyCode = async () => {
    if (!room?.join_code) return;
    await navigator.clipboard.writeText(room.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Join code copied");
  };

  if (!room) {
    return <main className="min-h-screen bg-background px-4 py-6"><CartoonistHeader /></main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <CartoonistHeader />
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <span className="eyebrow text-primary">Lobby</span>
            <h1 className="mt-1 font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>{room.name}</h1>
            {room.goal && (
              <p className="mt-3 text-foreground/80" style={{ fontSize: "var(--step-2)", lineHeight: 1.5 }}>
                <span className="eyebrow text-muted-foreground">Goal · </span>{room.goal}
              </p>
            )}
            {room.outputs && room.outputs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {room.outputs.map((o) => (
                  <span key={o} className="rounded-full border border-border bg-card px-2.5 py-0.5" style={{ fontSize: "var(--step-0)" }}>{o}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={copyCode} className="group rounded-2xl border-2 border-foreground bg-card px-6 py-4 text-center hover:bg-secondary">
            <p className="eyebrow text-muted-foreground">Join code · tap to copy</p>
            <p className="mt-1 flex items-center justify-center gap-2 font-mono font-bold tracking-[0.3em] text-primary" style={{ fontSize: "var(--step-4)" }}>
              {room.join_code}
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-40 group-hover:opacity-100" />}
            </p>
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>Who's here</h2>
            <div className="mt-3 space-y-2">
              {participants.length === 0 && (
                <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Joining…</p>
              )}
              {participants.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full font-medium text-background" style={{ backgroundColor: p.color ?? "#666" }}>
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.display_name}</span>
                      {i === 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground" style={{ fontSize: "var(--step-0)" }}>host</span>}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{p.role ?? ""}{p.personality ? ` · ${p.personality}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>Cartoonist mode</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-4xl">
                {room.facilitation === "facilitator" ? "🎤" : room.facilitation === "devils-advocate" ? "🔥" : "✍️"}
              </div>
              <div>
                <div className="font-medium capitalize">{(room.facilitation || "scribe").replace("-", " ")}</div>
                <p className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                  {room.facilitation === "facilitator" ? "Prompts and summarizes." :
                   room.facilitation === "devils-advocate" ? "Pushes back, surfaces gaps." :
                   "Listens & draws quietly."}
                </p>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
              Share the join code so others can hop in. {hasJoined ? "You're in — start when ready." : ""}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={start} className="gap-2 rounded-full bg-primary px-6 py-6 text-primary-foreground hover:bg-primary/90">
            Start session <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
