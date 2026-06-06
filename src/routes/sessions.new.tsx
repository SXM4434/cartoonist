import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { addSession, loadProfile } from "@/lib/profile";
import { CartoonistHeader } from "./onboarding";

const OUTPUTS = ["Summary", "PRD", "User journey", "Product flow", "Timeline", "Problem statement", "Decisions", "Action items"];
const HOST_ROLES = [
  { id: "driver", label: "Driver", sub: "Steering the convo" },
  { id: "facilitator", label: "Facilitator", sub: "Keeping it on track" },
  { id: "contributor", label: "Contributor", sub: "Adding ideas" },
  { id: "observer", label: "Observer", sub: "Mostly listening" },
];
const FACILITATION = [
  { id: "scribe", label: "Quiet scribe", emoji: "✍️", sub: "Listens, draws, stays out of the way" },
  { id: "facilitator", label: "Active facilitator", emoji: "🎤", sub: "Prompts, summarizes, nudges decisions" },
  { id: "devils-advocate", label: "Devil's advocate", emoji: "🔥", sub: "Pushes back, surfaces risks & gaps" },
];

export const Route = createFileRoute("/sessions/new")({
  ssr: false,
  component: NewSession,
});

function NewSession() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [outputs, setOutputs] = useState<string[]>(["Summary", "Action items"]);
  const [hostRole, setHostRole] = useState("driver");
  const [facilitation, setFacilitation] = useState("scribe");
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const recRef = useRef<unknown>(null);

  useEffect(() => { if (!loadProfile()) navigate({ to: "/onboarding" }); }, [navigate]);

  const toggleOutput = (o: string) =>
    setOutputs((cur) => cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);

  const startMic = () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown })
      .webkitSpeechRecognition || (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition;
    if (!SR) { toast.error("Voice works in Chrome / Edge. Type instead."); return; }
    const rec = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
      onerror: () => void; onend: () => Promise<void>;
      start: () => void; stop: () => void;
    })();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = false;
    let transcript = "";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " ";
      }
    };
    rec.onerror = () => setRecording(false);
    rec.onend = async () => {
      setRecording(false);
      const text = transcript.trim();
      if (!text) return;
      await autofill(text);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    toast.success("Describe the session: what you're working on, what you want to walk away with");
    setTimeout(() => { try { rec.stop(); } catch { /* noop */ } }, 20000);
  };

  const stopMic = () => { try { (recRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* noop */ } };

  const autofill = async (transcript: string) => {
    setParsing(true);
    try {
      const res = await fetch("/api/parse-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, kind: "goal" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "parse failed");
      if (data.name) setName((v) => v || data.name);
      if (data.goal) setGoal((v) => v || data.goal);
      if (Array.isArray(data.outputs) && data.outputs.length) {
        const valid = data.outputs.filter((o: string) => OUTPUTS.includes(o));
        if (valid.length) setOutputs((cur) => Array.from(new Set([...cur, ...valid])));
      }
      if (data.hostRole && HOST_ROLES.find((r) => r.id === data.hostRole)) setHostRole(data.hostRole);
      if (data.facilitation && FACILITATION.find((f) => f.id === data.facilitation)) setFacilitation(data.facilitation);
      toast.success("Autofilled — tweak anything.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse");
    } finally {
      setParsing(false);
    }
  };

  const create = async () => {
    if (!goal.trim()) { toast.error("Add a goal — what are we trying to do?"); return; }
    setCreating(true);
    try {
      const profile = loadProfile();
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          name: name.trim() || goal.slice(0, 60),
          goal: goal.trim(),
          outputs,
          facilitation,
          host_role: hostRole,
          mode: "both",
          session_type: "session",
        } as never)
        .select("id, join_code, name")
        .single();
      if (error) throw error;
      addSession({
        roomId: data.id,
        joinCode: data.join_code ?? "",
        name: data.name,
        goal: goal.trim(),
        outputs,
        createdAt: Date.now(),
      });
      // Pre-register host as participant so they show up in lobby + canvas
      if (profile) {
        await supabase.from("participants").insert({
          room_id: data.id,
          display_name: profile.displayName,
          role: profile.role || null,
          personality: hostRole,
          color: profile.color,
        });
        localStorage.setItem(`cartoonist_joined_${data.id}`, "1");
      }
      navigate({ to: "/sessions/$sessionId", params: { sessionId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <CartoonistHeader />
      <div className="mx-auto max-w-2xl">
        <span className="eyebrow text-primary">Step 2 of 2</span>
        <h1 className="font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>What's this session about?</h1>
        <p className="text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
          Tell Cartoonist the goal so it can draw the right things.
        </p>

        <div className="mt-6 rounded-2xl border-2 border-foreground bg-card p-6 space-y-6">
          {/* Voice */}
          <div className="rounded-xl border-2 border-foreground bg-yellow-50 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium" style={{ fontSize: "var(--step-2)" }}>Just describe it out loud</p>
              <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>
                20 sec mic — autofills goal, outputs, your role, and Cartoonist's mode.
              </p>
            </div>
            {recording ? (
              <Button onClick={stopMic} className="gap-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Square className="h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button onClick={startMic} disabled={parsing} className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {parsing ? "Reading…" : "Record brief"}
              </Button>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block">Goal — what are we trying to do?</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="Plan the v1 onboarding flow for our new app"
              className="rounded-xl border-2 border-foreground"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Session name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-filled from goal" className="rounded-full border-2 border-foreground" />
          </div>

          <div>
            <Label className="mb-2 block">What do you want to walk away with?</Label>
            <div className="flex flex-wrap gap-2">
              {OUTPUTS.map((o) => (
                <button key={o} type="button" onClick={() => toggleOutput(o)}
                  className={`rounded-full border-2 px-3 py-1 text-sm transition ${outputs.includes(o) ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/60"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Your role in this session</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {HOST_ROLES.map((r) => (
                <button key={r.id} type="button" onClick={() => setHostRole(r.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${hostRole === r.id ? "border-foreground bg-secondary" : "border-border bg-background hover:border-foreground/60"}`}>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{r.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">How should Cartoonist show up?</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {FACILITATION.map((f) => (
                <button key={f.id} type="button" onClick={() => setFacilitation(f.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${facilitation === f.id ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground/60"}`}>
                  <div className="text-xl">{f.emoji}</div>
                  <div className="mt-1 font-medium">{f.label}</div>
                  <div className={facilitation === f.id ? "text-primary-foreground/80" : "text-muted-foreground"} style={{ fontSize: "var(--step-0)" }}>{f.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={create} disabled={creating} className="w-full rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
            {creating ? "Creating…" : "Create session"}
          </Button>
        </div>
      </div>
    </main>
  );
}
