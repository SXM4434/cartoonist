import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Mic, MessageSquare, Link2 } from "lucide-react";
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
      const { data: r, error } = await supabase
        .from("rooms")
        .select("id,name,join_code,goal,outputs,facilitation,host_role")
        .eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      if (error || !r) { toast.error("Session not found"); navigate({ to: "/dashboard" }); return; }
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

        {mergeCandidate && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4">
            <Link2 className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-[200px]">
              <p className="font-medium" style={{ fontSize: "var(--step-2)" }}>
                Looks like <span className="text-primary">{mergeCandidate.display_name}</span> is already here ({mergeCandidate.input_mode ?? "voice"}). Is that you?
              </p>
              <p className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                Yes → your voice and chat will count as one person. No → joins as a separate participant.
              </p>
            </div>
            <Button onClick={startLinked} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">Yes, that's me</Button>
            <Button onClick={startSeparate} variant="outline" className="rounded-full border-2 border-foreground">No, different person</Button>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>Who's here</h2>
            <div className="mt-3 space-y-2">
              {participants.length === 0 && (
                <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Joining…</p>
              )}
              {participants.map((p, i) => {
                const modes = new Set<string>();
                if (p.input_mode) modes.add(p.input_mode);
                if (p.input_mode === "both") { modes.add("voice"); modes.add("chat"); }
                // sibling links pointing here
                participants.forEach((s) => { if (s.linked_participant_id === p.id && s.input_mode) modes.add(s.input_mode); });
                const isLinked = !!p.linked_participant_id;
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border border-border bg-background p-3 ${isLinked ? "opacity-60" : ""}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full font-medium text-background" style={{ backgroundColor: p.color ?? "#666" }}>
                      {p.display_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.display_name}</span>
                        {i === 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground" style={{ fontSize: "var(--step-0)" }}>host</span>}
                        {isLinked && <span className="eyebrow text-muted-foreground">linked</span>}
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {modes.has("voice") && <Mic className="h-3 w-3" />}
                          {modes.has("chat") && <MessageSquare className="h-3 w-3" />}
                        </span>
                      </div>
                      <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{p.role ?? ""}{p.personality ? ` · ${p.personality}` : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>How are you joining?</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode("voice")}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${mode === "voice" ? "border-foreground bg-secondary" : "border-border hover:border-foreground/60"}`}>
                <Mic className="h-4 w-4" />
                <div className="font-medium">Voice</div>
                <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>Mic on. Cartoonist hears you.</div>
              </button>
              <button type="button" onClick={() => setMode("chat")}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${mode === "chat" ? "border-foreground bg-secondary" : "border-border hover:border-foreground/60"}`}>
                <MessageSquare className="h-4 w-4" />
                <div className="font-medium">Chat</div>
                <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>No mic. Type and Cartoonist draws.</div>
              </button>
            </div>
            <p className="mt-4 text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
              You can switch any time inside the room. Voice + chat from the same person count as one.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={start} disabled={!!mergeCandidate} className="gap-2 rounded-full bg-primary px-6 py-6 text-primary-foreground hover:bg-primary/90">
            {mode === "voice" ? "Start with voice" : "Join via chat"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
