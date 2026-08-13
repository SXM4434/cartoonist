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
import { rpc } from "@/lib/db-rpc";

const OUTPUTS = ["Summary", "PRD", "User journey", "Product flow", "Timeline", "Problem statement", "Decisions", "Action items"];
const HOST_ROLES = [
  { id: "driver", label: "Driver", sub: "Steering the convo" },
  { id: "facilitator", label: "Facilitator", sub: "Keeping it on track" },
  { id: "contributor", label: "Contributor", sub: "Adding ideas" },
  { id: "observer", label: "Observer", sub: "Mostly listening" },
];
const FACILITATION = [
  { id: "scribe", label: "Quiet scribe", sub: "Listens, draws, stays out of the way" },
  { id: "facilitator", label: "Active facilitator", sub: "Prompts, summarizes, nudges decisions" },
  { id: "devils-advocate", label: "Devil's advocate", sub: "Pushes back, surfaces risks and gaps" },
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
      const created = await rpc<Array<{ id: string; join_code: string | null; name: string }>>("room_create", {
        p_name: name.trim() || goal.slice(0, 60),
        p_goal: goal.trim(),
        p_outputs: outputs,
        p_facilitation: facilitation,
        p_host_role: hostRole,
        p_mode: "both",
        p_session_type: "session",
      });
      const data = created?.[0];
      if (!data) throw new Error("Could not create session");
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
        const { data: pp } = await supabase.from("participants").insert({
          room_id: data.id,
          display_name: profile.displayName,
          role: profile.role || null,
          personality: hostRole,
          color: profile.color,
          input_mode: "voice",
        } as never).select("id").maybeSingle();
        if (pp?.id) localStorage.setItem(`cartoonist_participant_${data.id}`, pp.id);
        localStorage.setItem(`cartoonist_joined_${data.id}`, "1");
        localStorage.setItem(`cartoonist_input_mode_${data.id}`, "voice");
      }
      navigate({ to: "/sessions/$sessionId", params: { sessionId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <CartoonistHeader />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <span className="eyebrow font-mono text-muted-foreground">STEP 2 / 2</span>
          <h1 className="statement mt-3 max-w-[13ch]" style={{ fontSize: "var(--step-4)" }}>
            What is the room trying to settle?
          </h1>
          <p className="mt-4 max-w-[42ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
            The goal decides what Cartoonist draws when the talking starts, and what it
            hands back at the end. Say the brief out loud and it fills the rest in.
          </p>
        </div>

        <div className="border border-foreground bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground px-5 py-4">
            <div>
              <p className="eyebrow font-mono text-muted-foreground">SPOKEN BRIEF</p>
              <p className="mt-1.5" style={{ fontSize: "var(--step-2)" }}>
                {recording ? "Listening — what are you working on?" : "Twenty seconds. It writes goal, outputs and roles."}
              </p>
            </div>
            {recording ? (
              <Button onClick={stopMic} variant="destructive" className="gap-2 rounded-none">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button onClick={startMic} disabled={parsing} className="gap-2 rounded-none">
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {parsing ? "Reading…" : "Record brief"}
              </Button>
            )}
          </div>

          <div className="space-y-7 p-5">
            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">GOAL</Label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                placeholder="Plan the v1 onboarding flow for our new app"
                className="rounded-none border-foreground shadow-none"
              />
            </div>

            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">SESSION NAME — OPTIONAL</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Taken from the goal" className="h-11 rounded-none border-foreground shadow-none" />
            </div>

            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">DELIVERABLES</Label>
              <div className="flex flex-wrap gap-2">
                {OUTPUTS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleOutput(o)}
                    aria-pressed={outputs.includes(o)}
                    className={`press border px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      outputs.includes(o) ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                    style={{ fontSize: "var(--step-1)" }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">YOUR ROLE</Label>
              <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
                {HOST_ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setHostRole(r.id)}
                    aria-pressed={hostRole === r.id}
                    className={`press bg-card p-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                      hostRole === r.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-foreground" style={{ fontSize: "var(--step-2)" }}>{r.label}</div>
                    <div className="mt-0.5" style={{ fontSize: "var(--step-1)" }}>{r.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">HOW CARTOONIST SHOWS UP</Label>
              <div className="grid gap-px bg-border md:grid-cols-3">
                {FACILITATION.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFacilitation(f.id)}
                    aria-pressed={facilitation === f.id}
                    className={`press bg-card p-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                      facilitation === f.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    }`}
                  >
                    <div style={{ fontSize: "var(--step-2)" }}>{f.label}</div>
                    <div className={facilitation === f.id ? "mt-0.5 text-primary-foreground/80" : "mt-0.5 text-muted-foreground"} style={{ fontSize: "var(--step-1)" }}>
                      {f.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={create} disabled={creating} size="lg" className="w-full rounded-none">
              {creating ? "Creating…" : "Create session"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
