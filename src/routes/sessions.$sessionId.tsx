import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { addSession, loadProfile, VIBES, type Vibe } from "@/lib/profile";
import { CartoonistHeader } from "./onboarding";

type Room = { id: string; name: string; join_code: string | null; session_type: string | null; mode: string | null };
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
  const [vibe, setVibe] = useState<Vibe>("creative");
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { navigate({ to: "/onboarding" }); return; }
    setVibe(p.vibe);
    (async () => {
      const { data: r } = await supabase.from("rooms").select("id,name,join_code,session_type,mode").eq("id", sessionId).maybeSingle();
      if (!r) { toast.error("Session not found"); navigate({ to: "/dashboard" }); return; }
      setRoom(r as Room);
      const { data: parts } = await supabase.from("participants").select("id,display_name,role,color,personality").eq("room_id", sessionId);
      setParticipants((parts ?? []) as Participant[]);
    })();
  }, [sessionId, navigate]);

  const joinLobby = async () => {
    const p = loadProfile();
    if (!p || !room) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.from("participants").insert({
        room_id: room.id,
        display_name: p.displayName,
        role: p.strengths.join(", ") || null,
        personality: vibe,
        color: p.color,
      }).select("id,display_name,role,color,personality").single();
      if (error) throw error;
      setParticipants((cur) => [...cur, data as Participant]);
      setHasJoined(true);
      addSession({
        roomId: room.id,
        joinCode: room.join_code ?? "",
        name: room.name,
        type: room.session_type ?? "",
        mode: room.mode ?? "",
        outputs: [],
        createdAt: Date.now(),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join");
    } finally { setJoining(false); }
  };

  // Auto-join once on load
  useEffect(() => {
    if (room && !hasJoined && !joining) void joinLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const start = () => {
    if (!room) return;
    // Mark legacy "joined" flag so canvas-room skips its IntroModal
    const profile = loadProfile();
    if (profile) {
      localStorage.setItem(`cartoonist_joined_${room.id}`, "1");
    }
    navigate({ to: "/r/$roomId", params: { roomId: room.id } });
  };

  if (!room) {
    return <main className="min-h-screen bg-background px-4 py-6"><CartoonistHeader /></main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <CartoonistHeader />
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-yellow-200 px-3 py-1 font-medium text-yellow-900" style={{ fontSize: "var(--step-0)" }}>Lobby</span>
            <h1 className="mt-2 font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>{room.name}</h1>
            <p className="text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
              {room.session_type ?? "session"} · {room.mode ?? "both"}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-foreground bg-card px-6 py-4 text-center">
            <p className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>Join code</p>
            <p className="mt-1 font-mono font-bold tracking-[0.3em] text-primary" style={{ fontSize: "var(--step-4)" }}>
              {room.join_code}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>Who's here</h2>
            <div className="mt-3 space-y-2">
              {participants.length === 0 && (
                <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Just you so far — share the join code.</p>
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
                    <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{p.personality ?? p.role ?? ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>Your vibe today</h2>
            <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Pick what fits this session.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVibe(v.id)}
                  className={`rounded-full border-2 px-3 py-1 text-sm transition ${vibe === v.id ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground/60"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-center text-5xl">🙂</div>
            <p className="mt-1 text-center text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>Cartoonist is warming up its pen…</p>
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
