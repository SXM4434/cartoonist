import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Check, Copy, FileDown, Mic, MicOff, Play, Sparkles, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Card, Connection, Participant } from "@/lib/canvas-types";
import { ArtifactTabs, type Artifacts } from "./artifact-tabs";
import { CanvasBoard } from "./canvas-board";
import { IntroModal } from "./intro-modal";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Op =
  | { type: "sticky"; id: string; text: string; author?: string; category?: string }
  | { type: "flowStep"; id: string; label: string; connectsFrom?: string | null }
  | { type: "journeyStep"; id: string; label: string; persona?: string }
  | { type: "decision"; id: string; label: string }
  | { type: "actionItem"; id: string; task: string; owner?: string | null }
  | { type: "connect"; from: string; to: string; label?: string }
  | { type: "section"; id: string; title: string; kind?: string };

const DEMO_TRANSCRIPT = [
  "Sam (PM): Okay team, let's map out the onboarding flow. What's the first friction point users hit?",
  "Alex (Design): The signup form. Too many fields up front.",
  "Jordan (Eng): Agreed. We could defer profile fields until after first action.",
  "Sam (PM): Love it. So step one is just email and password.",
  "Alex (Design): Then drop them straight into a sample workspace.",
  "Jordan (Eng): And a tooltip tour on the first key action.",
  "Sam (PM): Decision: ship the slim signup behind a flag next sprint.",
  "Alex (Design): I'll mock the new form by Thursday.",
  "Jordan (Eng): I'll wire the feature flag and migration.",
];

function randomXY(idx: number) {
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  return { x: 120 + col * 260, y: 120 + row * 200 };
}

function cardFromOp(op: Exclude<Op, { type: "connect" }>, idx: number, createdAtMs: number): Card {
  const pos = randomXY(idx);
  if (op.type === "sticky") return { id: op.id, type: "sticky", text: op.text, author: op.author, category: op.category, x: pos.x, y: pos.y, createdAtMs };
  if (op.type === "flowStep") return { id: op.id, type: "flowStep", text: op.label, x: pos.x, y: pos.y, createdAtMs };
  if (op.type === "journeyStep") return { id: op.id, type: "journeyStep", text: op.label, author: op.persona, x: pos.x, y: pos.y, createdAtMs };
  if (op.type === "decision") return { id: op.id, type: "decision", text: op.label, x: pos.x, y: pos.y, createdAtMs };
  if (op.type === "actionItem") return { id: op.id, type: "actionItem", text: op.task, owner: op.owner, x: pos.x, y: pos.y, createdAtMs };
  return { id: op.id, type: "section", text: op.title, kind: op.kind, x: pos.x, y: pos.y, createdAtMs };
}

export function CanvasRoom({ roomId }: { roomId: string }) {
  const [introOpen, setIntroOpen] = useState(true);
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [committed, setCommitted] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [generating, setGenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [demoLine, setDemoLine] = useState("");
  const [demoRunning, setDemoRunning] = useState(false);

  const startedAtRef = useRef(Date.now());
  const lastProcessedIdx = useRef(0);

  const participantNames = useMemo(() => participants.map((p) => p.name), [participants]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`cartoonist_joined_${roomId}`);
    const name = window.localStorage.getItem("cartoonist_user_name");
    const color = window.localStorage.getItem("cartoonist_user_color") ?? "#E07A3E";
    if (cached && name) {
      setJoined(true);
      setIntroOpen(false);
      setParticipants([{ id: "local", name, color }]);
    }
  }, [roomId]);

  const applyOps = useCallback((ops: Op[]) => {
    const createdAtMs = Date.now() - startedAtRef.current;
    setCards((current) => {
      const next = [...current];
      for (const op of ops) {
        if (op.type === "connect" || next.some((card) => card.id === op.id)) continue;
        next.push(cardFromOp(op, next.length, createdAtMs));
      }
      return next;
    });
    setConnections((current) => {
      const next = [...current];
      for (const op of ops) {
        if (op.type === "connect") {
          const id = `conn_${op.from}_${op.to}`;
          if (!next.some((conn) => conn.id === id)) next.push({ id, from: op.from, to: op.to, label: op.label });
        } else if (op.type === "flowStep" && op.connectsFrom) {
          const id = `conn_${op.connectsFrom}_${op.id}`;
          if (!next.some((conn) => conn.id === id)) next.push({ id, from: op.connectsFrom, to: op.id });
        }
      }
      return next;
    });
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (d: { text: string }) => setPartial(d.text ?? ""),
    onCommittedTranscript: (d: { text: string }) => {
      const text = (d.text ?? "").trim();
      if (!text) return;
      setCommitted((current) => [...current, text]);
      setPartial("");
      void supabase.from("transcript_chunks").insert({ room_id: roomId, text, t_offset_ms: Date.now() - startedAtRef.current });
    },
  });

  const startMic = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/scribe-token", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error ?? "Mic token unavailable");
      await scribe.connect({ token: data.token, microphone: { echoCancellation: true, noiseSuppression: true } });
      setIsLive(true);
      toast.success("Cartoonist is listening");
    } catch (error) {
      console.error(error);
      toast.error("Mic is unavailable — use Demo instead");
    }
  }, [scribe]);

  const stopMic = useCallback(async () => {
    try {
      await scribe.disconnect();
    } catch {}
    setIsLive(false);
  }, [scribe]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const newChunks = committed.slice(lastProcessedIdx.current);
      if (newChunks.length === 0) return;
      const transcript = newChunks.join(" ");
      lastProcessedIdx.current = committed.length;
      const canvasSummary = cards.slice(-20).map((card) => `[${card.type}:${card.id}] ${card.text}`).join("\n");
      try {
        const res = await fetch("/api/canvas-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, canvasSummary, participants: participantNames }),
        });
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.ops)) {
          applyOps(data.ops as Op[]);
          for (const op of data.ops) {
            void supabase.from("canvas_events").insert({ room_id: roomId, op, t_offset_ms: Date.now() - startedAtRef.current });
          }
        }
      } catch (error) {
        console.error("canvas-ops error", error);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [applyOps, cards, committed, isLive, participantNames, roomId]);

  const moveCard = useCallback((id: string, x: number, y: number) => {
    setCards((current) => current.map((card) => (card.id === id ? { ...card, x, y } : card)));
  }, []);

  const addAnonNote = useCallback(() => {
    const text = window.prompt("Anonymous note:");
    if (!text?.trim()) return;
    applyOps([{ type: "sticky", id: `anon_${Date.now()}`, text: text.trim(), author: "anonymous", category: "idea" }]);
  }, [applyOps]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Room link copied");
  }, []);

  const generateArtifacts = useCallback(async () => {
    setExportOpen(true);
    const transcript = committed.length ? committed.join("\n") : DEMO_TRANSCRIPT.join("\n");
    setGenerating(true);
    setArtifacts({});
    try {
      const res = await fetch("/api/generate-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");
      setArtifacts(data as Artifacts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }, [committed]);

  const runDemo = useCallback(async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setCards([]);
    setConnections([]);
    setCommitted([]);
    const script: Array<{ line: string; ops?: Op[] }> = [
      { line: DEMO_TRANSCRIPT[0] },
      { line: DEMO_TRANSCRIPT[1], ops: [{ type: "sticky", id: "d1", text: "Signup form too long", author: "Alex", category: "friction" }] },
      { line: DEMO_TRANSCRIPT[2], ops: [{ type: "sticky", id: "d2", text: "Defer profile fields until after activation", author: "Jordan", category: "idea" }] },
      { line: DEMO_TRANSCRIPT[3], ops: [{ type: "flowStep", id: "d3", label: "1. Email + password" }] },
      { line: DEMO_TRANSCRIPT[4], ops: [{ type: "flowStep", id: "d4", label: "2. Sample workspace", connectsFrom: "d3" }] },
      { line: DEMO_TRANSCRIPT[5], ops: [{ type: "flowStep", id: "d5", label: "3. Guided first action", connectsFrom: "d4" }] },
      { line: DEMO_TRANSCRIPT[6], ops: [{ type: "decision", id: "d6", label: "Ship slim signup behind a flag next sprint" }] },
      { line: DEMO_TRANSCRIPT[7], ops: [{ type: "actionItem", id: "d7", task: "Mock new signup form", owner: "Alex — Thu" }] },
      { line: DEMO_TRANSCRIPT[8], ops: [{ type: "actionItem", id: "d8", task: "Wire feature flag and migration", owner: "Jordan" }] },
    ];
    for (const step of script) {
      setDemoLine(step.line);
      setCommitted((current) => [...current, step.line]);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (step.ops) applyOps(step.ops);
    }
    setDemoLine("Demo complete — the canvas is local-first and safe even when live services fail.");
    setDemoRunning(false);
  }, [applyOps, demoRunning]);

  const handleIntroSubmit = useCallback(async (data: { name: string; role: string; personality: string; color: string }) => {
    window.localStorage.setItem("cartoonist_user_name", data.name);
    window.localStorage.setItem("cartoonist_user_color", data.color);
    window.localStorage.setItem(`cartoonist_joined_${roomId}`, "1");
    setParticipants([{ id: "local", name: data.name, role: data.role, color: data.color }]);
    setIntroOpen(false);
    setJoined(true);
    toast.success(`Welcome, ${data.name}`);
    void supabase.from("participants").insert({ room_id: roomId, display_name: data.name, role: data.role, personality: data.personality, color: data.color });
  }, [roomId]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="z-10 grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background px-5 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow text-foreground">Cartoonist</span>
          <span className="eyebrow text-muted-foreground" data-numeric>№ {roomId.slice(0, 6).toUpperCase()}</span>
          <span className="eyebrow text-primary">Local canvas</span>
          {isLive && <span className="eyebrow flex items-center gap-1.5 text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />On air</span>}
        </div>

        <div className="flex items-center gap-1.5">
          {participants.map((participant) => (
            <div key={participant.id} className="flex h-6 w-6 items-center justify-center border border-border font-medium uppercase text-background" style={{ backgroundColor: participant.color, fontSize: "var(--step-0)" }} title={participant.name}>
              {participant.name.slice(0, 1)}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={copyLink} className="h-8 gap-1.5 rounded-none border-border">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}<span className="eyebrow">Share</span></Button>
          <Button size="sm" variant="outline" onClick={addAnonNote} className="h-8 gap-1.5 rounded-none border-border"><StickyNote className="h-3.5 w-3.5" /><span className="eyebrow">Anon</span></Button>
          <Button size="sm" variant="outline" onClick={runDemo} disabled={demoRunning} className="h-8 gap-1.5 rounded-none border-border"><Play className="h-3.5 w-3.5" /><span className="eyebrow">{demoRunning ? "Playing…" : "Demo"}</span></Button>
          {isLive ? <Button size="sm" onClick={stopMic} className="h-8 gap-1.5 rounded-none bg-foreground text-background hover:bg-foreground/90"><MicOff className="h-3.5 w-3.5" /><span className="eyebrow">Stop</span></Button> : <Button size="sm" onClick={startMic} className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90"><Mic className="h-3.5 w-3.5" /><span className="eyebrow">Listen</span></Button>}
          <Sheet open={exportOpen} onOpenChange={setExportOpen}>
            <SheetTrigger asChild><Button size="sm" variant="outline" onClick={generateArtifacts} className="h-8 gap-1.5 rounded-none border-border"><FileDown className="h-3.5 w-3.5" /><span className="eyebrow">Export</span></Button></SheetTrigger>
            <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-2xl">
              <SheetHeader><SheetTitle className="font-serif" style={{ fontSize: "var(--step-3)" }}>Meeting artifacts</SheetTitle></SheetHeader>
              <div className="mt-4"><ArtifactTabs artifacts={artifacts} loading={generating} /></div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {(isLive || committed.length > 0 || demoLine) && (
        <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-1.5">
          <span className="eyebrow text-primary">{demoRunning ? "Demo" : isLive ? "Live" : "Replay"}</span>
          <span className="truncate text-foreground/70" style={{ fontSize: "var(--step-1)" }}>{demoLine || partial || committed[committed.length - 1] || "Listening…"}</span>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <CanvasBoard cards={cards} connections={connections} participants={participants} onMoveCard={moveCard} />
      </div>

      {!joined && <IntroModal open={introOpen} onClose={() => setIntroOpen(false)} onSubmit={handleIntroSubmit} />}

      {isLive && (
        <div className="pointer-events-none absolute bottom-5 right-5 flex items-center gap-2 border border-border bg-background px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
          <span className="eyebrow text-foreground">Mediating</span>
        </div>
      )}
    </div>
  );
}
