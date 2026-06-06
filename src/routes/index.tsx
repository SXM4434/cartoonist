import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Mic, Square, Sparkles, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TranscriptPanel } from "@/components/transcript-panel";
import { ArtifactTabs, type Artifacts } from "@/components/artifact-tabs";
import { SAMPLE_TRANSCRIPT } from "@/lib/sample-transcripts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cartoonist — AI mediator for teams" },
      {
        name: "description",
        content:
          "Cartoonist listens to your team and turns the conversation into a summary, decisions, action items, PRD, user journey, and flow diagram.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [committed, setCommitted] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [generating, setGenerating] = useState(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (d: { text: string }) => setPartial(d.text ?? ""),
    onCommittedTranscript: (d: { text: string }) => {
      const t = (d.text ?? "").trim();
      if (!t) return;
      setCommitted((prev) => [...prev, t]);
      setPartial("");
    },
  });

  const transcriptText = useMemo(
    () => [...committed, partial].filter(Boolean).join(" ").trim(),
    [committed, partial],
  );

  const start = useCallback(async () => {
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/scribe-token", { method: "POST" });
      if (!res.ok) throw new Error(`Token request failed (${res.status})`);
      const { token } = (await res.json()) as { token: string };
      if (!token) throw new Error("No Scribe token returned");
      await scribe.connect({
        token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      toast.success("Listening — start talking");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setConnecting(false);
    }
  }, [scribe]);

  const stop = useCallback(async () => {
    try {
      await scribe.disconnect();
    } catch (e) {
      console.error(e);
    }
  }, [scribe]);

  const generate = useCallback(async () => {
    if (transcriptText.length < 20) {
      toast.error("Transcript is too short — record more or load the sample.");
      return;
    }
    setGenerating(true);
    setArtifacts({});
    try {
      const res = await fetch("/api/generate-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      setArtifacts(data as Artifacts);
      toast.success("Artifacts ready");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [transcriptText]);

  const loadSample = useCallback(() => {
    const lines = SAMPLE_TRANSCRIPT.split("\n").filter(Boolean);
    setCommitted(lines);
    setPartial("");
    toast.success("Sample transcript loaded");
  }, []);

  const reset = useCallback(() => {
    setCommitted([]);
    setPartial("");
    setArtifacts({});
  }, []);

  const isLive = scribe.isConnected;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <header className="mb-12 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            AI Team Mediator
          </p>
          <h1 className="font-serif text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Cartoonist
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Talk through your idea. Cartoonist listens, then turns the conversation into a
            summary, decisions, action items, PRD, user journey, and a flow diagram.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          {!isLive ? (
            <Button size="lg" onClick={start} disabled={connecting} className="gap-2">
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {connecting ? "Connecting…" : "Start session"}
            </Button>
          ) : (
            <Button size="lg" variant="destructive" onClick={stop} className="gap-2">
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}

          <Button size="lg" variant="outline" onClick={loadSample} className="gap-2">
            <FileText className="h-4 w-4" /> Load sample
          </Button>

          <Button
            size="lg"
            onClick={generate}
            disabled={generating || transcriptText.length < 20}
            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate artifacts"}
          </Button>

          {(committed.length > 0 || Object.keys(artifacts).length > 0) && !isLive && (
            <Button size="lg" variant="ghost" onClick={reset}>
              Reset
            </Button>
          )}
        </div>

        <div className="space-y-6">
          <TranscriptPanel partial={partial} committed={committed} isLive={isLive} />
          <ArtifactTabs artifacts={artifacts} loading={generating} />
        </div>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Built with ElevenLabs Scribe + Lovable AI.
        </footer>
      </div>
    </main>
  );
}
