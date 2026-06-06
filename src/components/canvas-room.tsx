import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Mic, MicOff, Sparkles, StickyNote, Copy, Check, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LiveList } from "@liveblocks/client";
import {
  RoomProvider,
  useMutation,
  useStorage,
  useOthers,
  useSelf,
  type Card,
  type Connection,
} from "@/lib/liveblocks";
import { CanvasBoard } from "./canvas-board";
import { IntroModal } from "./intro-modal";
import { supabase } from "@/integrations/supabase/client";
import { ArtifactTabs, type Artifacts } from "./artifact-tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Op =
  | { type: "sticky"; id: string; text: string; author?: string; category?: string }
  | { type: "flowStep"; id: string; label: string; connectsFrom?: string | null }
  | { type: "journeyStep"; id: string; label: string; persona?: string }
  | { type: "decision"; id: string; label: string }
  | { type: "actionItem"; id: string; task: string; owner?: string | null }
  | { type: "connect"; from: string; to: string; label?: string }
  | { type: "section"; id: string; title: string; kind?: string };

function randomXY(idx: number) {
  // simple flow layout: rows of 4
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  return {
    x: 120 + col * 260,
    y: 120 + row * 200,
  };
}

function RoomShell({ roomId }: { roomId: string }) {
  const cards = useStorage((root) => root.cards) as readonly Card[] | null;
  const others = useOthers();
  const self = useSelf();

  const [committed, setCommitted] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [generating, setGenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const lastProcessedIdx = useRef(0);
  const startedAtRef = useRef<number>(Date.now());

  const applyOps = useMutation(({ storage }, ops: Op[]) => {
    const cardsList = storage.get("cards") as LiveList<Card>;
    const connList = storage.get("connections") as LiveList<Connection>;

    for (const op of ops) {
      if (op.type === "connect") {
        const id = `conn_${op.from}_${op.to}`;
        if (!connList.find((c: Connection) => c.id === id)) {
          connList.push({ id, from: op.from, to: op.to, label: op.label });
        }
        continue;
      }

      if (cardsList.find((c: Card) => c.id === op.id)) continue;
      const pos = randomXY(cardsList.length);
      let card: Card;
      switch (op.type) {
        case "sticky":
          card = {
            id: op.id,
            type: "sticky",
            text: op.text,
            author: op.author,
            category: op.category,
            x: pos.x,
            y: pos.y,
            createdAtMs: Date.now() - startedAtRef.current,
          };
          break;
        case "flowStep":
          card = {
            id: op.id,
            type: "flowStep",
            text: op.label,
            x: pos.x,
            y: pos.y,
            createdAtMs: Date.now() - startedAtRef.current,
          };
          if (op.connectsFrom) {
            const id = `conn_${op.connectsFrom}_${op.id}`;
            if (!connList.find((c: Connection) => c.id === id)) {
              connList.push({ id, from: op.connectsFrom, to: op.id });
            }
          }
          break;
        case "journeyStep":
          card = {
            id: op.id,
            type: "journeyStep",
            text: op.label,
            author: op.persona,
            x: pos.x,
            y: pos.y,
            createdAtMs: Date.now() - startedAtRef.current,
          };
          break;
        case "decision":
          card = {
            id: op.id,
            type: "decision",
            text: op.label,
            x: pos.x,
            y: pos.y,
            createdAtMs: Date.now() - startedAtRef.current,
          };
          break;
        case "actionItem":
          card = {
            id: op.id,
            type: "actionItem",
            text: op.task,
            owner: op.owner,
            x: pos.x,
            y: pos.y,
            createdAtMs: Date.now() - startedAtRef.current,
          };
          break;
        case "section":
          card = {
            id: op.id,
            type: "section",
            text: op.title,
            kind: op.kind,
            x: pos.x,
            y: pos.y,
            createdAtMs: Date.now() - startedAtRef.current,
          };
          break;
        default:
          continue;
      }
      cardsList.push(card);
    }
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (d: { text: string }) => setPartial(d.text ?? ""),
    onCommittedTranscript: (d: { text: string }) => {
      const t = (d.text ?? "").trim();
      if (!t) return;
      setCommitted((p) => [...p, t]);
      setPartial("");
      // persist
      void supabase.from("transcript_chunks").insert({
        room_id: roomId,
        text: t,
        t_offset_ms: Date.now() - startedAtRef.current,
      });
    },
  });

  const startMic = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/scribe-token", { method: "POST" });
      const { token } = await res.json();
      await scribe.connect({
        token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      setIsLive(true);
      toast.success("Cartoonist is listening");
    } catch (e) {
      console.error(e);
      toast.error("Mic failed");
    }
  }, [scribe]);

  const stopMic = useCallback(async () => {
    try {
      await scribe.disconnect();
    } catch {}
    setIsLive(false);
  }, [scribe]);

  // AI mediator loop: every 10s when live, process new transcript chunks
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const newChunks = committed.slice(lastProcessedIdx.current);
      if (newChunks.length === 0) return;
      const transcript = newChunks.join(" ");
      lastProcessedIdx.current = committed.length;

      const canvasSummary = (cards ?? [])
        .slice(-20)
        .map((c) => `[${c.type}:${c.id}] ${c.text}`)
        .join("\n");

      const participantNames = [
        self?.info?.name,
        ...others.map((o) => o.info?.name),
      ]
        .filter(Boolean)
        .join(", ");

      try {
        const res = await fetch("/api/canvas-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            canvasSummary,
            participants: participantNames.split(", ").filter(Boolean),
          }),
        });
        const data = await res.json();
        if (data.ops && Array.isArray(data.ops) && cards != null) {
          applyOps(data.ops as Op[]);
          // persist canvas events
          for (const op of data.ops) {
            void supabase.from("canvas_events").insert({
              room_id: roomId,
              op,
              t_offset_ms: Date.now() - startedAtRef.current,
            });
          }
        }
      } catch (e) {
        console.error("canvas-ops error", e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isLive, committed, cards, others, self, applyOps, roomId]);

  const addAnonNote = useCallback(() => {
    const text = window.prompt("Anonymous note:");
    if (!text) return;
    applyOps([
      {
        type: "sticky",
        id: `anon_${Date.now()}`,
        text,
        author: "anonymous",
        category: "idea",
      },
    ]);
  }, [applyOps]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Room link copied");
  };

  const generateArtifacts = useCallback(async () => {
    setExportOpen(true);
    if (committed.length < 2) {
      toast.error("Talk more first");
      return;
    }
    setGenerating(true);
    setArtifacts({});
    try {
      const res = await fetch("/api/generate-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: committed.join("\n") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setArtifacts(data as Artifacts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }, [committed]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Masthead — editorial bar, hairline rule, no blur/shadow */}
      <header className="z-10 flex items-center justify-between border-b border-border bg-background px-5 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow text-foreground">Cartoonist</span>
          <span className="eyebrow text-muted-foreground" data-numeric>
            № {roomId.slice(0, 6).toUpperCase()}
          </span>
          {isLive && (
            <span className="eyebrow flex items-center gap-1.5 text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              On air
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {[self, ...others].filter(Boolean).map((u: any, i) => (
            <div
              key={i}
              className="flex h-6 w-6 items-center justify-center border border-border text-[10px] font-medium uppercase text-background"
              style={{ backgroundColor: u?.info?.color ?? "#1a1a1a" }}
              title={u?.info?.name}
            >
              {(u?.info?.name ?? "G").slice(0, 1)}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={copyLink} className="h-8 gap-1.5 rounded-none border-border">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="eyebrow">Share</span>
          </Button>
          <Button size="sm" variant="outline" onClick={addAnonNote} className="h-8 gap-1.5 rounded-none border-border">
            <StickyNote className="h-3.5 w-3.5" />
            <span className="eyebrow">Anon</span>
          </Button>
          {isLive ? (
            <Button size="sm" onClick={stopMic} className="h-8 gap-1.5 rounded-none bg-foreground text-background hover:bg-foreground/90">
              <MicOff className="h-3.5 w-3.5" />
              <span className="eyebrow">Stop</span>
            </Button>
          ) : (
            <Button size="sm" onClick={startMic} className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Mic className="h-3.5 w-3.5" />
              <span className="eyebrow">Listen</span>
            </Button>
          )}
          <Sheet open={exportOpen} onOpenChange={setExportOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={generateArtifacts}
                className="h-8 gap-1.5 rounded-none border-border"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span className="eyebrow">Export</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[90vw] sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-serif text-2xl">Meeting artifacts</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <ArtifactTabs artifacts={artifacts} loading={generating} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Live transcript ticker */}
      {(isLive || committed.length > 0) && (
        <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-1.5">
          <span className="eyebrow text-primary">Live</span>
          <span className="truncate text-foreground/70" style={{ fontSize: "var(--step-1)" }}>
            {partial || committed[committed.length - 1] || "Listening…"}
          </span>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <CanvasBoard />
      </div>

      {/* Bottom-right mediator marker — bordered, not shadowed */}
      {isLive && (
        <div className="pointer-events-none absolute bottom-5 right-5 flex items-center gap-2 border border-border bg-background px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
          <span className="eyebrow text-foreground">Mediating</span>
        </div>
      )}
    </div>
  );
}

export function CanvasRoom({ roomId }: { roomId: string }) {
  const [introOpen, setIntroOpen] = useState(true);
  const [joined, setJoined] = useState(false);

  // Check localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`cartoonist_joined_${roomId}`);
    if (cached) {
      setIntroOpen(false);
      setJoined(true);
    }
  }, [roomId]);

  const handleIntroSubmit = async (data: {
    name: string;
    role: string;
    personality: string;
    color: string;
  }) => {
    window.localStorage.setItem("cartoonist_user_name", data.name);
    window.localStorage.setItem("cartoonist_user_color", data.color);
    window.localStorage.setItem(`cartoonist_joined_${roomId}`, "1");

    // create participant row
    const { data: row } = await supabase
      .from("participants")
      .insert({
        room_id: roomId,
        display_name: data.name,
        role: data.role,
        personality: data.personality,
        color: data.color,
      })
      .select()
      .single();

    setIntroOpen(false);
    setJoined(true);
    toast.success(`Welcome, ${data.name}`);
  };

  if (!joined) {
    return (
      <IntroModal
        open={introOpen}
        onClose={() => setIntroOpen(false)}
        onSubmit={handleIntroSubmit}
      />
    );
  }

  return (
    <RoomProvider
      id={`cartoonist-${roomId}`}
      initialPresence={{ cursor: null, name: "Guest", color: "#E07A3E" }}
      initialStorage={{
        cards: new LiveList<Card>([]),
        connections: new LiveList<Connection>([]),
      }}
    >
      <RoomShell roomId={roomId} />
    </RoomProvider>
  );
}
