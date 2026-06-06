import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Eraser, FileDown, Mic, MicOff, Pencil, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Participant } from "@/lib/canvas-types";
import type { FreehandStroke, SketchPrimitive } from "@/lib/sketch-types";
import { useSpeech } from "@/lib/use-speech";
import { ArtifactTabs, type Artifacts } from "./artifact-tabs";
import { IntroModal } from "./intro-modal";
import { SketchCanvas } from "./sketch-canvas";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function CanvasRoom({ roomId }: { roomId: string }) {
  const [introOpen, setIntroOpen] = useState(true);
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [shapes, setShapes] = useState<SketchPrimitive[]>([]);
  const [freehand, setFreehand] = useState<FreehandStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [generating, setGenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  const speech = useSpeech();
  const startedAtRef = useRef(Date.now());
  const lastSentLenRef = useRef(0);

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

  const summarizeCanvas = useCallback(() => {
    if (shapes.length === 0) return "(empty)";
    return shapes
      .slice(-30)
      .map((s) => {
        if (s.type === "arrow") return `arrow[${s.id}] ${s.x1},${s.y1}→${s.x2},${s.y2}${s.label ? ` "${s.label}"` : ""}`;
        if (s.type === "line") return `line[${s.id}]`;
        if (s.type === "text") return `text[${s.id}] "${s.text}"`;
        if (s.type === "stroke") return `stroke[${s.id}]`;
        return `${s.type}[${s.id}] @${s.x},${s.y} ${s.w}x${s.h}${"label" in s && s.label ? ` "${s.label}"` : ""}`;
      })
      .join("\n");
  }, [shapes]);

  const requestDraw = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setThinking(true);
    setDrawError(null);
    try {
      const res = await fetch("/api/cartoonist-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, existing: summarizeCanvas() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDrawError(data?.error ?? "AI draw failed");
        return;
      }
      const incoming = Array.isArray(data.shapes) ? (data.shapes as SketchPrimitive[]) : [];
      if (incoming.length === 0) return;
      setShapes((current) => {
        const known = new Set(current.map((s) => s.id));
        const fresh = incoming.filter((s) => s && s.id && !known.has(s.id));
        if (fresh.length === 0) return current;
        // Persist to canvas_events (fire and forget)
        for (const shape of fresh) {
          void supabase.from("canvas_events").insert({
            room_id: roomId,
            op: JSON.parse(JSON.stringify(shape)),
            t_offset_ms: Date.now() - startedAtRef.current,
          });
        }
        return [...current, ...fresh];
      });
    } catch (e) {
      setDrawError(e instanceof Error ? e.message : "Network error");
    } finally {
      setThinking(false);
    }
  }, [roomId, summarizeCanvas]);

  // Auto-draw from speech: every ~6s if there's new committed text
  useEffect(() => {
    if (!speech.listening) return;
    const interval = setInterval(() => {
      const text = speech.finals.join(" ");
      if (text.length <= lastSentLenRef.current + 12) return;
      const newText = text.slice(lastSentLenRef.current);
      lastSentLenRef.current = text.length;
      void requestDraw(newText);
      // Persist transcript chunk
      void supabase.from("transcript_chunks").insert({
        room_id: roomId,
        text: newText,
        t_offset_ms: Date.now() - startedAtRef.current,
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [requestDraw, roomId, speech.finals, speech.listening]);

  const askDraw = useCallback(async () => {
    const text = askText.trim();
    if (!text) return;
    setAskText("");
    await requestDraw(text);
  }, [askText, requestDraw]);

  const clearCanvas = useCallback(() => {
    setShapes([]);
    setFreehand([]);
    lastSentLenRef.current = speech.finals.join(" ").length;
  }, [speech.finals]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Room link copied");
  }, []);

  const generateArtifacts = useCallback(async () => {
    setExportOpen(true);
    const transcript = speech.finals.length ? speech.finals.join("\n") : "(no transcript yet — start the mic or type to Cartoonist)";
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
  }, [speech.finals]);

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

  const recentTranscript = useMemo(() => {
    const last = speech.finals.slice(-3).join(" ");
    return speech.partial ? `${last} ${speech.partial}`.trim() : last;
  }, [speech.finals, speech.partial]);

  const micBarCount = 18;
  const micBars = useMemo(() => Array.from({ length: micBarCount }), []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="z-10 grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background px-5 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow text-foreground">Cartoonist</span>
          <span className="eyebrow text-muted-foreground" data-numeric>№ {roomId.slice(0, 6).toUpperCase()}</span>
          {speech.listening && (
            <span className="eyebrow flex items-center gap-1.5 text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Listening
            </span>
          )}
          {thinking && <span className="eyebrow text-muted-foreground">Drawing…</span>}
        </div>

        <div className="flex items-center gap-1.5">
          {participants.map((p) => (
            <div key={p.id} className="flex h-6 w-6 items-center justify-center border border-border font-medium uppercase text-background" style={{ backgroundColor: p.color, fontSize: "var(--step-0)" }} title={p.name}>
              {p.name.slice(0, 1)}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setDrawing((d) => !d)} className={`h-8 gap-1.5 rounded-none border-border ${drawing ? "bg-foreground text-background" : ""}`}>
            <Pencil className="h-3.5 w-3.5" /><span className="eyebrow">Draw</span>
          </Button>
          <Button size="sm" variant="outline" onClick={clearCanvas} className="h-8 gap-1.5 rounded-none border-border">
            <Eraser className="h-3.5 w-3.5" /><span className="eyebrow">Clear</span>
          </Button>
          <Button size="sm" variant="outline" onClick={copyLink} className="h-8 gap-1.5 rounded-none border-border">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}<span className="eyebrow">Share</span>
          </Button>
          {speech.listening ? (
            <Button size="sm" onClick={speech.stop} className="h-8 gap-1.5 rounded-none bg-foreground text-background hover:bg-foreground/90">
              <MicOff className="h-3.5 w-3.5" /><span className="eyebrow">Stop</span>
            </Button>
          ) : (
            <Button size="sm" onClick={() => void speech.start()} className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Mic className="h-3.5 w-3.5" /><span className="eyebrow">Listen</span>
            </Button>
          )}
          <Sheet open={exportOpen} onOpenChange={setExportOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" onClick={generateArtifacts} className="h-8 gap-1.5 rounded-none border-border">
                <FileDown className="h-3.5 w-3.5" /><span className="eyebrow">Export</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-2xl">
              <SheetHeader>
                <SheetTitle className="font-serif" style={{ fontSize: "var(--step-3)" }}>Meeting artifacts</SheetTitle>
              </SheetHeader>
              <div className="mt-4"><ArtifactTabs artifacts={artifacts} loading={generating} /></div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Live mic feedback bar — impossible to miss */}
      {(speech.listening || speech.error || !speech.supported) && (
        <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-2">
          {speech.listening && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <div className="flex h-5 items-end gap-[2px]">
                {micBars.map((_, i) => {
                  const threshold = (i + 1) / micBarCount;
                  const active = speech.level > threshold * 0.8;
                  const h = active ? 4 + Math.min(16, speech.level * 20) : 3;
                  return <span key={i} className="w-[3px] bg-foreground/80 transition-all" style={{ height: `${h}px`, opacity: active ? 1 : 0.25 }} />;
                })}
              </div>
            </div>
          )}
          <span className="eyebrow text-muted-foreground shrink-0">
            {speech.listening ? "Hearing" : speech.error ? "Mic error" : "Mic"}
          </span>
          <span className="truncate text-foreground" style={{ fontSize: "var(--step-1)" }}>
            {speech.error
              ? speech.error
              : !speech.supported
              ? "Voice transcription works in Chrome / Edge. Use the prompt below to draw."
              : recentTranscript || "say something — Cartoonist will draw it…"}
          </span>
        </div>
      )}

      {drawError && (
        <div className="border-b border-border bg-background px-5 py-1.5">
          <span className="eyebrow text-primary">Draw error</span>{" "}
          <span className="text-foreground/80" style={{ fontSize: "var(--step-0)" }}>{drawError}</span>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <SketchCanvas
          shapes={shapes}
          freehand={freehand}
          drawingEnabled={drawing}
          onFreehandComplete={(stroke) => setFreehand((current) => [...current, stroke])}
        />

        {shapes.length === 0 && freehand.length === 0 && (
          <div className="pointer-events-none absolute left-8 top-8 max-w-md border border-border bg-background p-5">
            <p className="eyebrow text-primary">Whiteboard ready</p>
            <p className="mt-2 font-serif" style={{ fontSize: "var(--step-3)" }}>
              Hit Listen and start talking, or ask Cartoonist to draw something below.
            </p>
            <p className="mt-2 text-foreground/70" style={{ fontSize: "var(--step-0)" }}>
              Try: "draw the signup flow with email, Google, and a verify-email step."
            </p>
          </div>
        )}

        {/* Prompt bar — works without mic */}
        <form
          onSubmit={(e) => { e.preventDefault(); void askDraw(); }}
          className="absolute bottom-5 left-1/2 z-10 flex w-[min(640px,calc(100%-2.5rem))] -translate-x-1/2 items-center gap-2 border border-border bg-background px-3 py-2"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <input
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder="Ask Cartoonist to draw something…"
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: "var(--step-1)" }}
          />
          <Button type="submit" size="sm" variant="outline" disabled={!askText.trim() || thinking} className="h-7 rounded-none border-border">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      {!joined && <IntroModal open={introOpen} onClose={() => setIntroOpen(false)} onSubmit={handleIntroSubmit} />}
    </div>
  );
}
