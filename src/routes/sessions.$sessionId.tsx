import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Mic, MessageSquare, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { addSession, loadProfile } from "@/lib/profile";
import { CartoonistHeader } from "./onboarding";
import { roomGet } from "@/lib/db-rpc";

type Room = {
  id: string; name: string; join_code: string | null;
  goal: string | null; outputs: string[] | null;
  facilitation: string | null; host_role: string | null;
};
type Participant = {
  id: string; display_name: string; role: string | null; color: string | null; personality: string | null;
  input_mode?: "voice" | "chat" | "both" | null;
  linked_participant_id?: string | null;
};

export const Route = createFileRoute("/sessions/$sessionId")({
  ssr: false,
  component: Lobby,
});

const norm = (s: string) => s.trim().toLowerCase();

function Lobby() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const [mode, setMode] = useState<"voice" | "chat">("voice");
  const [copied, setCopied] = useState(false);
  // Identity-merge: if someone with same name is already here, ask before creating dup.
  const [mergeCandidate, setMergeCandidate] = useState<Participant | null>(null);

  // Load room + participants
  useEffect(() => {
    const p = loadProfile();
    if (!p) { sessionStorage.setItem("cartoonist_pending_join", sessionId); navigate({ to: "/onboarding" }); return; }

    let cancelled = false;
    (async () => {
      const r = await roomGet(sessionId);
      if (cancelled) return;
      if (!r) { toast.error("Session not found"); navigate({ to: "/dashboard" }); return; }
      setRoom(r as Room);

      const { data: parts } = await supabase
        .from("participants")
        .select("id,display_name,role,color,personality,input_mode,linked_participant_id")
        .eq("room_id", sessionId);
      if (cancelled) return;
      const list = (parts ?? []) as Participant[];
      setParticipants(list);

      const match = list.find((x) => norm(x.display_name) === norm(p.displayName));
      if (match) {
        // already in this room (probably the host or a prior tab) — reuse identity
        setSelfPid(match.id);
        if (match.input_mode && match.input_mode !== "voice") setMode(match.input_mode === "chat" ? "chat" : "voice");
      } else {
        // look for a same-name canonical to optionally merge with
        const cand = list.find((x) => x.linked_participant_id == null && norm(x.display_name) === norm(p.displayName));
        if (cand) setMergeCandidate(cand);
      }

      addSession({
        roomId: r.id,
        joinCode: r.join_code ?? "",
        name: r.name,
        goal: r.goal ?? "",
        outputs: r.outputs ?? [],
        createdAt: Date.now(),
      });
    })();

    const channel = supabase.channel(`lobby:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const n = payload.new as Participant;
            setParticipants((cur) => {
              const i = cur.findIndex((x) => x.id === n.id);
              if (i === -1) return [...cur, n];
              const next = [...cur]; next[i] = n; return next;
            });
          } else if (payload.eventType === "DELETE") {
            const o = payload.old as { id: string };
            setParticipants((cur) => cur.filter((x) => x.id !== o.id));
          }
        })
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [sessionId, navigate]);

  const joinAs = async (chosenMode: "voice" | "chat", opts?: { linkTo?: string }) => {
    if (!room) return;
    const p = loadProfile();
    if (!p) return;
    let pid = selfPid;

    if (!pid) {
      const { data: inserted, error } = await supabase.from("participants").insert({
        room_id: sessionId,
        display_name: p.displayName,
        role: p.role || null,
        personality: room.host_role ?? null,
        color: p.color,
        input_mode: chosenMode,
        linked_participant_id: opts?.linkTo ?? null,
      } as never).select("id").single();
      if (error || !inserted) { toast.error("Could not join"); return; }
      pid = (inserted as { id: string }).id;
      // If linking, bump the canonical row to "both"
      if (opts?.linkTo) {
        await supabase.from("participants").update({ input_mode: "both" } as never).eq("id", opts.linkTo);
      }
    } else {
      await supabase.from("participants").update({ input_mode: chosenMode } as never).eq("id", pid);
    }

    setSelfPid(pid);
    localStorage.setItem(`cartoonist_joined_${room.id}`, "1");
    localStorage.setItem(`cartoonist_input_mode_${room.id}`, chosenMode);
    localStorage.setItem(`cartoonist_participant_${room.id}`, pid!);
    navigate({ to: "/r/$roomId", params: { roomId: room.id } });
  };

  const start = () => { void joinAs(mode); };
  const startLinked = () => {
    if (!mergeCandidate) return;
    void joinAs(mode, { linkTo: mergeCandidate.id });
  };
  const startSeparate = () => {
    setMergeCandidate(null);
    void joinAs(mode);
  };

  const copyCode = async () => {
    if (!room?.join_code) return;
    await navigator.clipboard.writeText(room.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Join code copied");
  };

  if (!room) {
    return <main className="min-h-screen bg-background"><CartoonistHeader /></main>;
  }

  return (
    <main className="min-h-screen bg-background">
      <CartoonistHeader />
      <div className="mx-auto max-w-[1240px] px-6 py-14">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
          <div className="max-w-[46ch]">
            <span className="eyebrow font-mono text-muted-foreground">LOBBY</span>
            <h1 className="statement mt-3" style={{ fontSize: "var(--step-4)" }}>{room.name}</h1>
            {room.goal && (
              <p className="mt-4 text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
                <span className="font-mono uppercase tracking-[0.16em]" style={{ fontSize: "var(--step-0)" }}>Goal — </span>
                <span className="text-foreground">{room.goal}</span>
              </p>
            )}
            {room.outputs && room.outputs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-px bg-border">
                {room.outputs.map((o) => (
                  <span key={o} className="bg-card px-2.5 py-1 font-mono uppercase tracking-[0.14em] text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{o}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={copyCode} className="press group border border-foreground bg-card px-6 py-4 text-center transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <p className="eyebrow font-mono text-muted-foreground">JOIN CODE — TAP TO COPY</p>
            <p className="mt-1.5 flex items-center justify-center gap-2 font-mono tracking-[0.3em] tabular-nums" style={{ fontSize: "var(--step-3)" }}>
              {room.join_code}
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 opacity-30 transition-opacity group-hover:opacity-100" />}
            </p>
          </button>
        </div>

        {mergeCandidate && (
          <div className="mt-8 flex flex-wrap items-center gap-4 border border-primary bg-card p-4">
            <Link2 className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-[240px] flex-1">
              <p style={{ fontSize: "var(--step-2)" }}>
                <span className="text-primary">{mergeCandidate.display_name}</span> is already in this room ({mergeCandidate.input_mode ?? "voice"}). Is that you?
              </p>
              <p className="mt-1 text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                Yes — your voice and chat count as one person. No — you join as a separate participant.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={startLinked} className="rounded-none">Yes, that's me</Button>
              <Button onClick={startSeparate} variant="outline" className="rounded-none border-foreground">Different person</Button>
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-px border border-foreground bg-border md:grid-cols-[1.4fr_1fr]">
          <section className="bg-card p-5">
            <h2 className="eyebrow font-mono text-muted-foreground">WHO'S HERE</h2>
            <ul className="mt-3 list-none divide-y divide-border">
              {participants.length === 0 && (
                <li className="py-3 text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Joining…</li>
              )}
              {participants.map((p, i) => {
                const modes = new Set<string>();
                if (p.input_mode) modes.add(p.input_mode);
                if (p.input_mode === "both") { modes.add("voice"); modes.add("chat"); }
                participants.forEach((s) => { if (s.linked_participant_id === p.id && s.input_mode) modes.add(s.input_mode); });
                const isLinked = !!p.linked_participant_id;
                return (
                  <li key={p.id} className={`flex items-center gap-3 py-3 ${isLinked ? "opacity-50" : ""}`}>
                    <span className="h-8 w-1.5 shrink-0" style={{ backgroundColor: p.color ?? "var(--muted-foreground)" }} aria-hidden />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span style={{ fontSize: "var(--step-2)" }}>{p.display_name}</span>
                        {i === 0 && <span className="font-mono uppercase tracking-[0.16em] text-primary" style={{ fontSize: "var(--step-0)" }}>host</span>}
                        {isLinked && <span className="font-mono uppercase tracking-[0.16em] text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>linked</span>}
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {modes.has("voice") && <Mic className="h-3 w-3" />}
                          {modes.has("chat") && <MessageSquare className="h-3 w-3" />}
                        </span>
                      </div>
                      <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                        {p.role ?? ""}{p.personality ? ` · ${p.personality}` : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="bg-card p-5">
            <h2 className="eyebrow font-mono text-muted-foreground">HOW ARE YOU JOINING?</h2>
            <div className="mt-3 grid gap-px bg-border">
              <button
                type="button"
                onClick={() => setMode("voice")}
                aria-pressed={mode === "voice"}
                className={`press flex items-start gap-3 p-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${mode === "voice" ? "bg-foreground text-background" : "bg-card hover:bg-secondary"}`}
              >
                <Mic className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block" style={{ fontSize: "var(--step-2)" }}>Voice</span>
                  <span className={mode === "voice" ? "block text-background/70" : "block text-muted-foreground"} style={{ fontSize: "var(--step-0)" }}>
                    Mic on. Cartoonist hears you.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("chat")}
                aria-pressed={mode === "chat"}
                className={`press flex items-start gap-3 p-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${mode === "chat" ? "bg-foreground text-background" : "bg-card hover:bg-secondary"}`}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block" style={{ fontSize: "var(--step-2)" }}>Chat</span>
                  <span className={mode === "chat" ? "block text-background/70" : "block text-muted-foreground"} style={{ fontSize: "var(--step-0)" }}>
                    No mic. Type and Cartoonist draws.
                  </span>
                </span>
              </button>
            </div>
            <p className="mt-4 text-muted-foreground" style={{ fontSize: "var(--step-0)", lineHeight: 1.5 }}>
              You can switch any time inside the room. Voice and chat from the same person count as one.
            </p>
            <Button onClick={start} disabled={!!mergeCandidate} size="lg" className="mt-5 w-full gap-2 rounded-none">
              {mode === "voice" ? "Start with voice" : "Join via chat"} <ArrowRight className="h-4 w-4" />
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}
