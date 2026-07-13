import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Eraser, FileDown, Mic, MicOff, MessageSquare, Pencil, Send, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { ParticipantWithHumanLayer } from "@/lib/canvas-types";
import type { FreehandStroke, SketchPrimitive } from "@/lib/sketch-types";
import { EMPTY_HUMAN_LAYER, type HumanLayer } from "@/lib/human-layer";
import { useSpeech } from "@/lib/use-speech";
import { useLiveDiarization } from "@/hooks/use-live-diarization";
import { ArtifactTabs, type Artifacts } from "./artifact-tabs";
import { IntroModal } from "./intro-modal";
import { Canvas } from "./canvas/Canvas";
import { CanvasProvider } from "./canvas/canvas-context";
import { ChatPanel } from "./chat-panel";
import { CostMeter } from "./cost-meter";
import { CheckIn } from "./team-desk/CheckIn";
import { TeamDesk } from "./team-desk/TeamDesk";
import type { InferredState } from "./team-desk/use-inferred-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type SessionContext = {
  name: string;
  goal: string;
  outputs: string[];
  facilitation: string;
  hostRole: string;
};

type ParticipantRow = {
  id: string;
  display_name: string;
  color: string | null;
  role: string | null;
  role_today: string | null;
  strengths: string[] | null;
  contribution_modes: string[] | null;
  feedback_style: string | null;
  blockers: string | null;
  needs_today: string | null;
  can_help_with: string | null;
  share_blockers: boolean | null;
  share_needs: boolean | null;
  human_layer_complete: boolean | null;
};

function rowToParticipant(p: ParticipantRow): ParticipantWithHumanLayer {
  return {
    id: p.id,
    name: p.display_name,
    role: p.role ?? undefined,
    color: p.color ?? "#E07A3E",
    role_today: p.role_today,
    strengths: p.strengths,
    contribution_modes: p.contribution_modes,
    feedback_style: p.feedback_style,
    blockers: p.blockers,
    needs_today: p.needs_today,
    can_help_with: p.can_help_with,
    share_blockers: p.share_blockers,
    share_needs: p.share_needs,
    human_layer_complete: p.human_layer_complete,
  };
}

function humanLayerFromParticipant(me: ParticipantWithHumanLayer): HumanLayer {
  return {
    role_today: me.role_today ?? "",
    strengths: me.strengths ?? [],
    contribution_modes: (me.contribution_modes ?? []).filter((m): m is "voice" | "chat" | "whiteboard" | "async" => ["voice","chat","whiteboard","async"].includes(m as string)),
    feedback_style: (["direct","gentle","ask-first","written-only"].includes((me.feedback_style ?? "") as string) ? me.feedback_style : "") as HumanLayer["feedback_style"],
    needs_today: me.needs_today ?? "",
    blockers: me.blockers ?? "",
    can_help_with: me.can_help_with ?? "",
    share_blockers: me.share_blockers ?? false,
    share_needs: me.share_needs ?? true,
    human_layer_complete: me.human_layer_complete ?? false,
  };
}

function participantForPrompt(p: ParticipantWithHumanLayer) {
  return {
    name: p.name,
    role: p.role,
    role_today: p.role_today,
    strengths: p.strengths,
    feedback_style: p.feedback_style,
    contribution_modes: p.contribution_modes,
    needs_today: p.needs_today,
    blockers: p.blockers,
    can_help_with: p.can_help_with,
    share_blockers: p.share_blockers,
    share_needs: p.share_needs,
  };
}

export function CanvasRoom(props: { roomId: string }) {
  return <CanvasRoomInner {...props} />;
}

function CanvasRoomInner({ roomId }: { roomId: string }) {
  const [introOpen, setIntroOpen] = useState(false);
  const [introMode, setIntroMode] = useState<"self" | "add">("self");
  const [joined, setJoined] = useState(false);

  const [participants, setParticipants] = useState<ParticipantWithHumanLayer[]>([]);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInInitial, setCheckInInitial] = useState<HumanLayer>(EMPTY_HUMAN_LAYER);
  const [checkInPid, setCheckInPid] = useState<string | null>(null);
  const [checkInName, setCheckInName] = useState<string | null>(null);
  const [kioskQueue, setKioskQueue] = useState<string[]>([]);
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
  const [sessionCtx, setSessionCtx] = useState<SessionContext | null>(null);
  const [inputMode, setInputMode] = useState<"voice" | "chat">("voice");
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const inferredStatesRef = useRef<Record<string, InferredState>>({});

  const speech = useSpeech();
  const startedAtRef = useRef(Date.now());
  const lastSentLenRef = useRef(0);
  const seededRef = useRef(false);

  // Pull session context + auto-join from local profile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`cartoonist_joined_${roomId}`);
    const name = window.localStorage.getItem("cartoonist_user_name");
    const color = window.localStorage.getItem("cartoonist_user_color") ?? "#E07A3E";
    const storedMode = window.localStorage.getItem(`cartoonist_input_mode_${roomId}`) as "voice" | "chat" | null;
    const storedPid = window.localStorage.getItem(`cartoonist_participant_${roomId}`);
    if (storedMode) setInputMode(storedMode);
    if (storedPid) setSelfPid(storedPid);
    if (name) {
      // Auto-join with the profile they set up during onboarding.
      // No popup — they already introduced themselves.
      setJoined(true);
      setIntroOpen(false);
      setParticipants([{ id: storedPid ?? "local", name, color }]);
      if (!cached) {
        window.localStorage.setItem(`cartoonist_joined_${roomId}`, "1");
      }
    }

    (async () => {
      const { data: room } = await supabase
        .from("rooms")
        .select("name,goal,outputs,facilitation,host_role")
        .eq("id", roomId).maybeSingle();
      if (room) {
        setSessionCtx({
          name: (room as { name: string }).name ?? "",
          goal: (room as { goal: string | null }).goal ?? "",
          outputs: (room as { outputs: string[] | null }).outputs ?? [],
          facilitation: (room as { facilitation: string | null }).facilitation ?? "scribe",
          hostRole: (room as { host_role: string | null }).host_role ?? "",
        });
      }
      const { data: parts } = await supabase
        .from("participants")
        .select("id,display_name,color,role,role_today,strengths,contribution_modes,feedback_style,blockers,needs_today,can_help_with,share_blockers,share_needs,human_layer_complete")
        .eq("room_id", roomId);
      if (parts && parts.length) {
        setParticipants(parts.map((p) => rowToParticipant(p as never)));
      }
    })();
  }, [roomId]);

  // Seed initial shapes from session setup the first time we have context + empty canvas
  useEffect(() => {
    if (seededRef.current) return;
    if (!sessionCtx || !sessionCtx.goal) return;
    if (shapes.length > 0) { seededRef.current = true; return; }
    seededRef.current = true;
    const seeded: SketchPrimitive[] = [];
    seeded.push({ type: "text", id: "seed_title", x: 60, y: 60, text: sessionCtx.name || "Session", size: 18, weight: "bold" });
    seeded.push({ type: "line", id: "seed_underline_1", x1: 60, y1: 104, x2: 215, y2: 108 });
    seeded.push({ type: "line", id: "seed_underline_2", x1: 214, y1: 108, x2: 385, y2: 104 });
    seeded.push({ type: "line", id: "seed_underline_3", x1: 382, y1: 104, x2: 515, y2: 107 });
    seeded.push({
      type: "note", id: "seed_goal", x: 60, y: 132, w: 315, h: 118,
      text: `GOAL\n${sessionCtx.goal}`, color: "yellow",
    });
    sessionCtx.outputs.slice(0, 6).forEach((o, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      seeded.push({
        type: "note", id: `seed_out_${i}`,
        x: 410 + col * 176, y: 132 + row * 140, w: 156, h: 118,
        text: o, color: i % 2 === 0 ? "blue" : "green",
      });
    });
    setShapes(seeded);
    // v2.P6 groundwork — provenance at the write boundary.
    // Seed shapes are authored by the session brief, not by a participant.
    const seedThread = `thread_seed_${crypto.randomUUID().slice(0, 8)}`;
    for (const shape of seeded) {
      void supabase.from("canvas_events").insert({
        room_id: roomId, op: JSON.parse(JSON.stringify(shape)),
        t_offset_ms: Date.now() - startedAtRef.current,
        source: "seed",
        transcript_span: { origin: "session_brief", goal: sessionCtx.goal ?? null },
        confidence: 1,
        thread_id: seedThread,
      });
    }
  }, [sessionCtx, shapes.length, roomId]);


  const summarizeCanvas = useCallback(() => {
    if (shapes.length === 0) return "(empty)";
    return shapes
      .slice(-30)
      .map((s) => {
        switch (s.type) {
          case "arrow":
            return `arrow[${s.id}] ${s.x1},${s.y1}→${s.x2},${s.y2}${s.label ? ` "${s.label}"` : ""}`;
          case "line":
            return `line[${s.id}] ${s.x1},${s.y1}→${s.x2},${s.y2}`;
          case "text":
            return `text[${s.id}] @${s.x},${s.y} "${s.text}"`;
          case "note":
            return `note[${s.id}] @${s.x},${s.y} "${s.text}"`;
          case "icon":
            return `icon[${s.id}] ${s.kind} @${s.x},${s.y}${s.label ? ` "${s.label}"` : ""}`;
          case "path":
            return `path[${s.id}] ${s.points.length}pts`;
          case "stroke":
            return `stroke[${s.id}]`;
          default:
            return `${s.type}[${s.id}] @${s.x},${s.y} ${s.w}x${s.h}${s.label ? ` "${s.label}"` : ""}`;
        }
      })
      .join("\n");
  }, [shapes]);

  const requestDraw = useCallback(async (latest: string) => {
    if (!latest.trim()) return;
    setThinking(true);
    setDrawError(null);
    try {
      // Send rolling context: last 12 final utterances + the latest delta.
      const recent = speech.finals.slice(-12).join(" ");
      const fullContext = recent ? `${recent}\n---LATEST---\n${latest}` : latest;
      // v2.P2 — pass live inferred state per participant so mediator can
      // surface unresolved threads / quiet-too-long at natural pauses. Only
      // share flagged fields — respects per-participant privacy.
      const states = inferredStatesRef.current;
      const liveStates = participants
        .map((p) => {
          const s = states[p.id];
          if (!s || s.focus === "idle" || s.focus === "engaged") return null;
          return {
            name: p.name,
            focus: s.focus,
            last_ms: Number.isFinite(s.last_ms) ? s.last_ms : null,
            unresolved_point: s.unresolved_point,
          };
        })
        .filter(Boolean);
      const res = await fetch("/api/cartoonist-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, transcript: fullContext, latest, existing: summarizeCanvas(), sessionContext: sessionCtx, participants: participants.map(participantForPrompt), liveStates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setDrawError(data?.error ?? "AI draw failed");
        return;
      }
      const incoming = Array.isArray(data.shapes) ? (data.shapes as SketchPrimitive[]) : [];
      const edits = Array.isArray(data.edits) ? (data.edits as Array<{ id: string; patch: Record<string, unknown> }>) : [];
      const removes = Array.isArray(data.removes) ? (data.removes as string[]) : [];
      if (incoming.length === 0 && edits.length === 0 && removes.length === 0) return;
      setShapes((current) => {
        const byId = new Map(current.map((s) => [s.id, s]));
        // 1) removes (only touch AI-authored shapes already in state)
        for (const id of removes) {
          if (byId.has(id)) byId.delete(id);
        }
        // 2) edits (partial-merge; drop unknown ids)
        for (const { id, patch } of edits) {
          const prev = byId.get(id);
          if (!prev || !patch || typeof patch !== "object") continue;
          const merged = { ...prev, ...patch, id: prev.id, type: prev.type } as SketchPrimitive;
          byId.set(id, merged);
        }
        // 3) new shapes (skip ids we already know)
        const fresh: SketchPrimitive[] = [];
        for (const s of incoming) {
          if (!s || !s.id || byId.has(s.id)) continue;
          byId.set(s.id, s);
          fresh.push(s);
        }
        // Mirror to canvas_events with provenance (v2.P6 groundwork).
        // One thread_id per draw batch so shapes born of the same utterance
        // group together; span carries the utterance that triggered them.
        const stamp = Date.now() - startedAtRef.current;
        const threadId = `thread_${crypto.randomUUID().slice(0, 8)}`;
        const span = {
          origin: "utterance" as const,
          latest: latest.slice(0, 240),
          modality: typeof (data as { modality?: unknown }).modality === "string" ? (data as { modality: string }).modality : null,
        };
        for (const shape of fresh) {
          void supabase.from("canvas_events").insert({
            room_id: roomId, op: JSON.parse(JSON.stringify(shape)), t_offset_ms: stamp,
            source: "mediator", transcript_span: span, confidence: 0.8, thread_id: threadId,
          });
        }
        for (const { id, patch } of edits) {
          if (!byId.has(id)) continue;
          void supabase.from("canvas_events").insert({
            room_id: roomId, op: JSON.parse(JSON.stringify({ kind: "edit", id, patch })), t_offset_ms: stamp,
            source: "mediator", transcript_span: span, confidence: 0.9, thread_id: threadId,
          });
        }
        for (const id of removes) {
          void supabase.from("canvas_events").insert({
            room_id: roomId, op: { kind: "remove", id } as unknown as Record<string, string>, t_offset_ms: stamp,
            source: "mediator", transcript_span: span, confidence: 0.9, thread_id: threadId,
          });
        }
        return Array.from(byId.values());
      });
    } catch (e) {
      setDrawError(e instanceof Error ? e.message : "Network error");
    } finally {
      setThinking(false);
    }
  }, [roomId, speech.finals, summarizeCanvas, sessionCtx, participants]);

  // Auto-draw from speech: every ~6s if there's new committed text (voice mode only).
  // Note: transcript_chunks rows are written by the diarization hook below, not here,
  // so each chunk gets a proper speaker attribution.
  useEffect(() => {
    if (inputMode === "chat") return;
    if (!speech.listening) return;
    const interval = setInterval(() => {
      const text = speech.finals.join(" ");
      if (text.length <= lastSentLenRef.current + 12) return;
      const newText = text.slice(lastSentLenRef.current);
      lastSentLenRef.current = text.length;
      void requestDraw(newText);
    }, 6000);
    return () => clearInterval(interval);
  }, [requestDraw, roomId, speech.finals, speech.listening, inputMode, selfPid]);

  // Live diarization: rolling 8s chunks → ElevenLabs Scribe diarize → speaker_map
  const diarization = useLiveDiarization({
    roomId,
    enabled: inputMode === "voice" && speech.listening,
    startedAtMs: startedAtRef.current,
  });

  // Chat → AI handler (transcript persistence happens inside ChatPanel)
  const handleChatMessage = useCallback((text: string) => {
    void requestDraw(text);
  }, [requestDraw]);

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

  const toggleDraw = useCallback(() => {
    setDrawing((d) => !d);
  }, []);

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

  const handleIntroSubmit = useCallback(async (data: { name: string; role: string; personality: string; color: string; voiceSamplePath: string | null }) => {
    const isAdd = introMode === "add";
    setIntroOpen(false);

    if (!isAdd) {
      window.localStorage.setItem("cartoonist_user_name", data.name);
      window.localStorage.setItem("cartoonist_user_color", data.color);
      window.localStorage.setItem(`cartoonist_joined_${roomId}`, "1");
      window.localStorage.setItem(`cartoonist_input_mode_${roomId}`, inputMode);
      setJoined(true);
    }
    toast.success(isAdd ? `${data.name} added` : `Welcome, ${data.name}`);

    const { data: ins } = await supabase.from("participants").insert({
      room_id: roomId, display_name: data.name, role: data.role,
      personality: data.personality, color: data.color, input_mode: inputMode,
      voice_sample_path: data.voiceSamplePath,
    } as never).select("id").maybeSingle();

    const pid = ins?.id ?? `local-${Date.now()}`;

    if (isAdd) {
      setParticipants((prev) => [...prev, { id: pid, name: data.name, role: data.role, color: data.color }]);
    } else {
      if (ins?.id) window.localStorage.setItem(`cartoonist_participant_${roomId}`, ins.id);
      setSelfPid(pid);
      setParticipants([{ id: pid, name: data.name, role: data.role, color: data.color }]);
      // v2.P1 — right after they finish self-intro, prompt the human-layer check-in.
      setCheckInInitial(EMPTY_HUMAN_LAYER);
      setCheckInPid(pid);
      setCheckInName(data.name);
      setCheckInOpen(true);
    }
  }, [roomId, inputMode, introMode]);

  const advanceKiosk = useCallback((remaining: string[]) => {
    if (remaining.length === 0) {
      setKioskQueue([]);
      setCheckInPid(null);
      setCheckInName(null);
      setCheckInOpen(false);
      toast.success("Check-ins done");
      return;
    }
    const [next, ...rest] = remaining;
    setParticipants((prev) => {
      const p = prev.find((x) => x.id === next);
      setCheckInName(p?.name ?? null);
      setCheckInInitial(p ? humanLayerFromParticipant(p) : EMPTY_HUMAN_LAYER);
      return prev;
    });
    setCheckInPid(next);
    setKioskQueue(rest);
    setCheckInOpen(true);
  }, []);

  const handleCheckInSave = useCallback(async (hl: HumanLayer) => {
    const pid = checkInPid ?? selfPid;
    if (!pid) { setCheckInOpen(false); return; }
    const patch = {
      role_today: hl.role_today || null,
      strengths: hl.strengths.length ? hl.strengths : null,
      contribution_modes: hl.contribution_modes.length ? hl.contribution_modes : null,
      feedback_style: hl.feedback_style || null,
      needs_today: hl.needs_today || null,
      blockers: hl.blockers || null,
      can_help_with: hl.can_help_with || null,
      share_blockers: hl.share_blockers,
      share_needs: hl.share_needs,
      human_layer_complete: true,
    };
    await supabase.from("participants").update(patch).eq("id", pid);
    setParticipants((prev) => prev.map((p) => p.id === pid ? { ...p, ...patch } : p));
    toast.success("Checked in");
    if (kioskQueue.length > 0) {
      advanceKiosk(kioskQueue);
    } else {
      setCheckInOpen(false);
      setCheckInPid(null);
      setCheckInName(null);
    }
  }, [checkInPid, selfPid, kioskQueue, advanceKiosk]);

  const handleCheckInSkip = useCallback(() => {
    if (kioskQueue.length > 0) {
      advanceKiosk(kioskQueue);
    } else {
      setCheckInOpen(false);
      setCheckInPid(null);
      setCheckInName(null);
    }
  }, [kioskQueue, advanceKiosk]);

  const openCheckInFor = useCallback((pid: string) => {
    const p = participants.find((x) => x.id === pid);
    setCheckInInitial(p ? humanLayerFromParticipant(p) : EMPTY_HUMAN_LAYER);
    setCheckInPid(pid);
    setCheckInName(p?.name ?? null);
    setCheckInOpen(true);
  }, [participants]);

  const startKiosk = useCallback(() => {
    const pending = participants.filter((p) => !p.human_layer_complete).map((p) => p.id);
    if (pending.length === 0) { toast.info("Everyone's checked in"); return; }
    advanceKiosk(pending);
  }, [participants, advanceKiosk]);

  const openAddPerson = useCallback(() => {
    setIntroMode("add");
    setIntroOpen(true);
  }, []);


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
          <button
            type="button"
            onClick={openAddPerson}
            title="Add someone on this device"
            className="flex h-6 w-6 items-center justify-center border border-dashed border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
          >
            <UserPlus className="h-3 w-3" />
          </button>
        </div>


        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={toggleDraw} className={`h-8 gap-1.5 rounded-none border-border ${drawing ? "bg-foreground text-background" : ""}`}>
            <Pencil className="h-3.5 w-3.5" /><span className="eyebrow">Draw</span>
          </Button>
          <Button size="sm" variant="outline" onClick={clearCanvas} className="h-8 gap-1.5 rounded-none border-border">
            <Eraser className="h-3.5 w-3.5" /><span className="eyebrow">Clear</span>
          </Button>
          <Button size="sm" variant="outline" onClick={copyLink} className="h-8 gap-1.5 rounded-none border-border">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}<span className="eyebrow">Share</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChatOpen((v) => !v)} className={`h-8 gap-1.5 rounded-none border-border ${chatOpen ? "bg-foreground text-background" : ""}`}>
            <MessageSquare className="h-3.5 w-3.5" /><span className="eyebrow">Chat</span>
          </Button>
          {inputMode === "voice" ? (
            speech.listening ? (
              <Button size="sm" onClick={speech.stop} className="h-8 gap-1.5 rounded-none bg-foreground text-background hover:bg-foreground/90">
                <MicOff className="h-3.5 w-3.5" /><span className="eyebrow">Stop</span>
              </Button>
            ) : (
              <Button size="sm" onClick={() => void speech.start()} className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                <Mic className="h-3.5 w-3.5" /><span className="eyebrow">Listen</span>
              </Button>
            )
          ) : (
            <Button size="sm" onClick={() => {
              setInputMode("voice");
              window.localStorage.setItem(`cartoonist_input_mode_${roomId}`, "voice");
              if (selfPid) void supabase.from("participants").update({ input_mode: "both" } as never).eq("id", selfPid);
              void speech.start();
            }} className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              <Mic className="h-3.5 w-3.5" /><span className="eyebrow">Add voice</span>
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

      {diarization.pendingClusters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-5 py-2">
          <span className="eyebrow text-muted-foreground shrink-0">New voice detected — who's speaking?</span>
          {diarization.pendingClusters.map((cluster) => (
            <div key={cluster} className="flex items-center gap-1.5 border border-border bg-background px-2 py-1">
              <span className="eyebrow text-foreground" data-numeric>{cluster}</span>
              {diarization.latestByCluster[cluster] && (
                <span className="max-w-[160px] truncate text-xs italic text-muted-foreground">"{diarization.latestByCluster[cluster]}"</span>
              )}
              <span className="text-xs text-muted-foreground">→</span>
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void diarization.assignSpeaker(cluster, p.id)}
                  className="flex h-5 items-center gap-1 border border-border px-1.5 text-xs text-foreground transition hover:bg-foreground hover:text-background"
                >
                  <span className="h-2 w-2" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden">
          <CanvasProvider>
            <Canvas shapes={shapes} drawingEnabled={drawing} />
          </CanvasProvider>

          {shapes.length === 0 && freehand.length === 0 && (
            <div className="pointer-events-none absolute left-8 top-8 max-w-md border border-border bg-background p-5">
              <p className="eyebrow text-primary">Whiteboard ready</p>
              <p className="mt-2 font-serif" style={{ fontSize: "var(--step-3)" }}>
                {inputMode === "chat"
                  ? "Type in the Stream on the right, or ask Cartoonist to draw below."
                  : "Hit Listen and start talking, or ask Cartoonist to draw something below."}
              </p>
              <p className="mt-2 text-foreground/70" style={{ fontSize: "var(--step-0)" }}>
                Try: "draw the signup flow with email, Google, and a verify-email step."
              </p>
            </div>
          )}

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

          <CostMeter roomId={roomId} />
        </div>


        <div className="flex w-[280px] shrink-0 flex-col">
          <TeamDesk
            roomId={roomId}
            participants={participants}
            selfPid={selfPid}
            selfSpeaking={speech.listening}
            selfTyping={false}
            onInferredStates={(s) => { inferredStatesRef.current = s; }}
            onEditProfile={() => { if (selfPid) openCheckInFor(selfPid); }}
            onCheckInAs={openCheckInFor}
            onStartKiosk={startKiosk}
            kioskActive={kioskQueue.length > 0}
          />
          {chatOpen && (
            <div className="min-h-0 flex-1 border-t border-border">
              <ChatPanel
                roomId={roomId}
                selfParticipantId={selfPid}
                selfName={participants[0]?.name ?? "You"}
                selfColor={participants[0]?.color ?? "#E07A3E"}
                onChatMessage={handleChatMessage}
              />
            </div>
          )}
        </div>
      </div>

      <IntroModal
        open={introOpen}
        mode={introMode}
        roomId={roomId}
        onClose={() => { setIntroOpen(false); setIntroMode("self"); }}
        onSubmit={handleIntroSubmit}
      />


      <CheckIn
        open={checkInOpen}
        initial={checkInInitial}
        onSubmit={handleCheckInSave}
        onSkip={handleCheckInSkip}
        subjectName={checkInName}
        kioskRemaining={kioskQueue.length}
      />
    </div>
  );
}
