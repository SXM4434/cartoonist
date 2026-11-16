import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain, Check, Copy, Eraser, FileDown, Globe, Hand, History, Layers, Mic, MicOff, MessageSquare, MoreHorizontal, Search, Send, ShieldAlert, Smile, Sparkles, UserPlus, Users, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { TLRecord, TLShape } from "tldraw";
import type { ParticipantWithHumanLayer } from "@/lib/canvas-types";
import type { FreehandStroke, SketchPrimitive } from "@/lib/sketch-types";
import { bboxOf, placeBatchClear } from "@/lib/sketch-layout";
import { frameTitlePrimitives, placeInFrame, frameIndexOfShape, topicKey, type StoryFrame } from "@/lib/storyboard";

import { EMPTY_HUMAN_LAYER, type HumanLayer } from "@/lib/human-layer";
import { useSpeech } from "@/lib/use-speech";
import { useLiveDiarization } from "@/hooks/use-live-diarization";
import { SessionPack } from "./session-pack";
import { ArtifactTabs, type Artifacts } from "./artifact-tabs";
import { SessionRecap } from "./session-recap";
import { SessionReplay } from "./session-replay";
import { MemoryPanel } from "./known-about-you";

import { IntroModal } from "./intro-modal";
import { Canvas } from "./canvas/Canvas";
import { getRenderStyle } from "@/lib/render-style";

import { CanvasProvider } from "./canvas/canvas-context";
import { ChatPanel } from "./chat-panel";
import { CostMeter } from "./cost-meter";
import { getCostCap } from "@/lib/cost-cap";
import { CheckIn } from "./team-desk/CheckIn";
import { TeamDesk } from "./team-desk/TeamDesk";
import { ThreadList, type CanvasThread } from "./team-desk/ThreadRail";
import { CanvasToolbar } from "./room/canvas-toolbar";
import { RoomPanel, type RoomPanelTab } from "./room/room-panel";
import type { InferredState } from "./team-desk/use-inferred-state";
import { buildUserAgents, userAgentsPromptBlock } from "@/lib/user-agents";
import { playStreamingTTS, stopStreamingTTS } from "@/lib/tts-stream";
import { useLiveCursors } from "@/hooks/use-live-cursors";
import { useSharedFocus } from "@/hooks/use-shared-focus";
import { CursorsOverlay } from "./team-desk/CursorsOverlay";
import { ReactionsOverlay } from "./team-desk/ReactionsOverlay";
import { useReactions } from "@/hooks/use-reactions";
import { useHandQueue } from "@/hooks/use-hand-queue";
import { useCrossSessionMemory } from "@/hooks/use-cross-session-memory";
import { useSessionMemory, sessionMemoryBlock } from "@/hooks/use-session-memory";
import { useLiveArtifacts } from "@/hooks/use-live-artifacts";
import { useDevilsAdvocate, type Risk as DevilRisk } from "@/hooks/use-devils-advocate";
import { RisksPanel } from "./room/risks-panel";
import { useHistorian, type RecallEntry } from "@/hooks/use-historian";
import { RecallPanel } from "./room/recall-panel";
import { useWebReferences } from "@/hooks/use-web-references";
import { ReferencesPanel } from "./room/references-panel";
import { referenceCanvasEvent, referenceToShape, type WebReference } from "@/lib/web-reference";
import { wakeFromStream, voiceAction, pauseNudge, interruptPlayback } from "@/lib/voice-intent";

import { canvasEventsForRoom, roomGet, rpc, type CanvasEventRow } from "@/lib/db-rpc";
import { applyCanvasEvent, CanvasEventWriter, mergeHydrated, mergeReplayRows, ParticipantBatch, shouldSeedCanvas, type ParticipantOp } from "@/lib/canvas-event-sync";
import { joinParticipant } from "@/lib/participant-identity";
import { FeedbackDeduper, type DrawingOutcome } from "@/lib/drawing-feedback";
import { eventKey, runAgentEvent } from "@/lib/agent-events";
import { meetingEventStore } from "@/lib/agent-event-store";

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
  allow_voice_mention: boolean | null;
  human_layer_complete: boolean | null;
};

const NON_SPEECH_TRANSCRIPT = /^\s*\[(?:silence|heartbeat|background noise|music|outro jingle|bell dings?|birds chirping|door squeaking)\]\s*$/i;

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
    allow_voice_mention: p.allow_voice_mention,
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
    allow_voice_mention: me.allow_voice_mention ?? true,
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
  const [kioskMode, setKioskMode] = useState(false);
  const [shapes, setShapes] = useState<SketchPrimitive[]>([]);
  const [participantRecords, setParticipantRecords] = useState<Map<string, TLRecord | null>>(new Map());
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsReady] = useState(() => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
  });
  const [canvasSubscribed, setCanvasSubscribed] = useState(false);
  const hasCanvasHistoryRef = useRef(false);
  const hydratingEventsRef = useRef(true);
  const pendingCanvasRowsRef = useRef<CanvasEventRow[]>([]);
  const generatedOriginsRef = useRef(new Map<string, { threadId: string; span: Record<string, unknown>; op: SketchPrimitive }>());
  const feedbackDeduperRef = useRef(new FeedbackDeduper());
  const clientIdRef = useRef(crypto.randomUUID());
  const shapesRef = useRef<SketchPrimitive[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // Session replay overrides what the canvas renders while scrubbing.
  const [replayShapes, setReplayShapes] = useState<SketchPrimitive[] | null>(null);
  const [freehand, setFreehand] = useState<FreehandStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [generating, setGenerating] = useState(false);
  const [askText, setAskText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [sessionCtx, setSessionCtx] = useState<SessionContext | null>(null);
  const [inputMode, setInputMode] = useState<"voice" | "chat">("voice");
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const [canvasWriter] = useState(() => new CanvasEventWriter<Record<string, unknown>>(
    async (rows, expectedClear, seed) => {
      const result = await rpc<boolean>("canvas_events_append", {
        p_room: roomId, p_rows: rows, p_expected_clear: expectedClear, p_seed: seed,
      });
      if (result === null) throw new Error("Canvas write failed");
      return result;
    },
    async (row) => {
      const clear = await rpc<{ id: string; created_at: string }>("canvas_events_clear", { p_room: roomId, p_row: row });
      if (!clear) throw new Error("Canvas clear failed");
      return clear;
    },
  ));
  const publishCanvasRows = useCallback((rows: Array<Record<string, unknown>>, seed = false) => {
    for (let i = 0; i < rows.length; i += 100) {
      void canvasWriter.enqueue(rows.slice(i, i + 100), seed).catch((error) => console.error("[canvas] event insert failed", error));
    }
  }, [canvasWriter]);
  const waitingOpsRef = useRef(new ParticipantBatch());
  const waitingFeedbackRef = useRef(new Map<string, { shapeId: string; outcome: DrawingOutcome; resultRecord?: TLShape; actionId?: string }>());
  const onParticipantOps = useCallback((ops: ParticipantOp[]) => {
    if (!ops.length) return;
    setParticipantRecords((current) => {
      const next = new Map(current);
      for (const op of ops) next.set(op.id, op.kind === "participant_upsert" ? op.record as unknown as TLRecord : null);
      return next;
    });
    if (!selfPid) {
      for (const op of ops) waitingOpsRef.current.add(op);
      return;
    }
    const stamp = Date.now() - startedAtRef.current;
    const rows = ops.map((op) => ({
      room_id: roomId, op, t_offset_ms: stamp, source: "participant",
      transcript_span: { participant_id: selfPid, client_id: clientIdRef.current },
      confidence: 1,
    }));
    publishCanvasRows(rows);
  }, [publishCanvasRows, roomId, selfPid]);
  const onGeneratedInteraction = useCallback((shapeId: string, outcome: DrawingOutcome, resultRecord?: TLShape, actionId?: string) => {
    if (!selfPid) {
      waitingFeedbackRef.current.set(`${shapeId}:${outcome}:${actionId ?? ""}`, { shapeId, outcome, resultRecord, actionId });
      return;
    }
    if (!feedbackDeduperRef.current.accept(roomId, shapeId, outcome, actionId)) return;
    const origin = generatedOriginsRef.current.get(shapeId);
    if (!origin) {
      feedbackDeduperRef.current.release(roomId, shapeId, outcome, actionId);
      return;
    }
    void canvasWriter.idle().then(() => supabase.from("drawing_feedback" as never).insert({
      room_id: roomId, participant_id: selfPid, shape_id: shapeId,
      outcome, original_thread_id: origin.threadId, original_span: origin.span,
      original_op: origin.op, result_record: resultRecord ?? null, action_id: actionId ?? crypto.randomUUID(),
    } as never)).then(({ error }) => {
      if (error && error.code !== "23505") {
        feedbackDeduperRef.current.release(roomId, shapeId, outcome, actionId);
        console.error("[canvas] drawing feedback failed", error);
        if (outcome === "kept") toast.error("Could not save drawing feedback.");
      } else if (!error && outcome === "kept") {
        toast.success("Drawing kept.");
      }
    }).catch((error) => {
      feedbackDeduperRef.current.release(roomId, shapeId, outcome, actionId);
      console.error("[canvas] drawing feedback failed", error);
    });
  }, [canvasWriter, roomId, selfPid]);
  useEffect(() => {
    if (!selfPid) return;
    const ops = waitingOpsRef.current.drain();
    if (ops.length) {
      const stamp = Date.now() - startedAtRef.current;
      publishCanvasRows(ops.map((op) => ({
        room_id: roomId, op, t_offset_ms: stamp, source: "participant",
        transcript_span: { participant_id: selfPid, client_id: clientIdRef.current }, confidence: 1,
      })));
    }
    const feedback = [...waitingFeedbackRef.current.values()];
    waitingFeedbackRef.current.clear();
    for (const item of feedback) onGeneratedInteraction(item.shapeId, item.outcome, item.resultRecord, item.actionId);
  }, [onGeneratedInteraction, publishCanvasRows, roomId, selfPid]);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<"people" | "transcript" | "threads" | "memory" | "risks" | "recall" | "refs" | "replay" | "artifacts">("transcript");
  const [mediatorMuted, setMediatorMuted] = useState(false);
  const inferredStatesRef = useRef<Record<string, InferredState>>({});
  const lastSpokenRef = useRef<string>("");
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const [threads, setThreads] = useState<CanvasThread[]>([]);
  // v1 P2.3 — storyboard frames. Canvas grows left→right, one frame per topic.
  const [frames, setFrames] = useState<StoryFrame[]>([]);
  const framesRef = useRef<StoryFrame[]>([]);
  framesRef.current = frames;
  const [activeFrame, setActiveFrame] = useState(0);
  const activeFrameRef = useRef(0);
  activeFrameRef.current = activeFrame;
  // v2.P6 — brief peek toast when the mediator returns to an older thread.
  const [reopenPeek, setReopenPeek] = useState<{ relation: string | null; latest: string; oldLatest: string } | null>(null);

  // v2.P6 — cross-session memory: does today's talk echo an older session?
  const memory = useCrossSessionMemory(roomId);
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  const lastThreadIdRef = useRef<string | null>(null);

  const speech = useSpeech();
  const [pausePrompts, setPausePrompts] = useState(false);
  const voiceQueryRef = useRef<(query: string) => Promise<void>>(async () => {});
  const voiceSeenRef = useRef(0);
  const nudgeAtRef = useRef(0);
  const lastHumanAtRef = useRef(Date.now());
  const playbackEpochRef = useRef(0);

  useEffect(() => {
    setPausePrompts(window.localStorage.getItem(`cartoonist_pause_prompts_${roomId}`) === "true");
  }, [roomId]);

  useEffect(() => {
    if (speech.partial || speech.level > 0.08) {
      lastHumanAtRef.current = Date.now();
      playbackEpochRef.current++;
      if (interruptPlayback(true, ttsAudioRef.current, () => window.speechSynthesis?.cancel())) stopStreamingTTS();
    }
  }, [speech.partial, speech.level]);
  // v1 P2.2 — rolling full-session memory folded from the transcript.
  const sessionMemory = useSessionMemory(roomId, speech.finals);
  const sessionMemoryRef = useRef(sessionMemory);
  sessionMemoryRef.current = sessionMemory;
  const startedAtRef = useRef(Date.now());
  const lastSentLenRef = useRef(0);
  const drawInFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const seededRef = useRef(false);
  const appliedReopensRef = useRef(new Set<string>());

  // v1 P2.3 — open a storyboard frame (idempotent per topic) and return its index.
  const ensureFrame = useCallback((topic: string): number => {
    const existing = framesRef.current;
    const key = topicKey(topic);
    if (existing.length > 0) {
      const current = existing[existing.length - 1];
      if (!key || topicKey(current.topic) === key) return current.index;
    }
    const index = existing.length;
    const title = topic || `Topic ${index + 1}`;
    const strip = frameTitlePrimitives(index, title, Date.now() - startedAtRef.current);
    setShapes((current) => {
      const ids = new Set(current.map((s) => s.id));
      return [...current, ...strip.filter((s) => !ids.has(s.id))];
    });
    const frame: StoryFrame = { index, topic: title, at: Date.now(), x: 0, shapeIds: strip.map((s) => s.id) };
    const frameThread = `thread_frame_${index}`;
    publishCanvasRows(strip.map((shape) => ({
      room_id: roomId, op: shape, t_offset_ms: Date.now() - startedAtRef.current,
      source: "storyboard", transcript_span: { origin: "storyboard", frame, client_id: clientIdRef.current },
      confidence: 1, thread_id: frameThread,
    })));
    framesRef.current = [...existing, frame];
    setFrames(framesRef.current);
    activeFrameRef.current = index;
    setActiveFrame(index);
    return index;
  }, [publishCanvasRows, roomId]);

  const jumpToFrame = useCallback((index: number) => {
    const frame = framesRef.current[index];
    if (!frame) return;
    setActiveFrame(index);
    const ids = frame.shapeIds.length ? frame.shapeIds : [];
    if (ids.length && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids } }));
    }
  }, []);


  const selfParticipant = participants.find((p) => p.id === selfPid);
  const remoteCursors = useLiveCursors({
    roomId,
    selfPid,
    selfName: selfParticipant?.name,
    selfColor: selfParticipant?.color,
    containerRef: canvasStageRef,
  });
  useSharedFocus({
    roomId,
    selfPid,
    selfName: selfParticipant?.name,
    selfColor: selfParticipant?.color,
  });
  const { reactions, send: sendReaction } = useReactions({
    roomId,
    selfPid,
    selfName: selfParticipant?.name,
    selfColor: selfParticipant?.color,
  });
  // Fallback identity so anyone in the room (even pre-check-in) can raise a hand.
  // If no local id exists yet we mint one — otherwise the hand button is a no-op.
  const [fallbackId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("cartoonist_user_id");
    if (!id) {
      id = (crypto.randomUUID?.() ?? `guest-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem("cartoonist_user_id", id);
    }
    return id;
  });
  const fallbackName = typeof window !== "undefined" ? (localStorage.getItem("cartoonist_user_name") || "Guest") : "Guest";
  const fallbackColor = typeof window !== "undefined" ? (localStorage.getItem("cartoonist_user_color") || "#E07A3E") : "#E07A3E";
  const handPid = selfPid ?? (fallbackId || null);

  const { queue: handQueue, isRaised, toggle: toggleHand, lower: lowerHand } = useHandQueue({
    roomId,
    selfPid: handPid,
    selfName: selfParticipant?.name || fallbackName,
    selfColor: selfParticipant?.color || fallbackColor,
  });

  const playMediatorLine = useCallback((text: string, opts?: { localFirst?: boolean }) => {
    const speak = text.trim();
    if (!speak || mediatorMuted || speak === lastSpokenRef.current || typeof window === "undefined") return;
    lastSpokenRef.current = speak;
    // Mark only transcript that existed before playback as consumed. Updating
    // this at playback end swallowed genuine speech made while the mediator
    // was talking.
    lastSentLenRef.current = Math.max(lastSentLenRef.current, speech.finals.join(" ").length);
    const onDone = () => {
      // Playback completion intentionally does not advance the transcript
      // cursor; any human speech captured during playback must still draw.
    };
    const playBrowserVoice = () => {
      if (!("speechSynthesis" in window)) return false;
      try {
        const u = new SpeechSynthesisUtterance(speak);
        u.rate = 1.02;
        u.pitch = 1;
        u.volume = 0.9;
        u.onend = onDone;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return true;
      } catch {
        return false;
      }
    };
    if (opts?.localFirst && playBrowserVoice()) return;
    const epoch = playbackEpochRef.current;
    void (async () => {
      try {
        const audio = await playStreamingTTS({ roomId, text: speak, volume: 0.95, onEnd: onDone });
        if (audio && epoch === playbackEpochRef.current) ttsAudioRef.current = audio;
      } catch {
        if (epoch === playbackEpochRef.current) playBrowserVoice();
      }
    })();
  }, [mediatorMuted, speech.finals]);

  const lastHandInviteRef = useRef<{ pid: string; at: number } | null>(null);

  const handInviteLine = useCallback((hand: { pid: string; name: string }) => {
    const participant = participants.find((p) => p.id === hand.pid);
    const canName = participant ? participant.allow_voice_mention !== false : true;
    return canName ? `${hand.name}, go ahead.` : "I see a hand up — go ahead.";
  }, [participants]);

  const inviteRaisedHand = useCallback((hand: { pid: string; name: string }) => {
    // Only debounce a repeat invite for the SAME person within a few seconds —
    // lowering and re-raising must always speak again.
    const prev = lastHandInviteRef.current;
    if (prev && prev.pid === hand.pid && Date.now() - prev.at < 6000) return;
    lastHandInviteRef.current = { pid: hand.pid, at: Date.now() };
    const line = handInviteLine(hand);
    toast.message(line);
    // Bypass the "already said this" guard — the same line is expected here.
    lastSpokenRef.current = "";
    playMediatorLine(line, { localFirst: true });
  }, [handInviteLine, playMediatorLine]);

  const handleToggleHand = useCallback(() => {
    if (!isRaised && handPid) {
      // Speak inside the click gesture for the local user, then let the
      // broadcast queue update every other screen.
      inviteRaisedHand({ pid: handPid, name: selfParticipant?.name || fallbackName });
    } else if (isRaised) {
      lastHandInviteRef.current = null;
    }
    toggleHand();
  }, [fallbackName, handPid, inviteRaisedHand, isRaised, selfParticipant?.name, toggleHand]);

  // A raised hand is an explicit facilitation event, so the mediator should
  // open the floor immediately instead of waiting for the next transcript draw.
  useEffect(() => {
    const next = handQueue[0];
    if (!next) {
      lastHandInviteRef.current = null;
      return;
    }
    inviteRaisedHand(next);
  }, [handQueue, inviteRaisedHand]);


  const emitReaction = useCallback((emoji: string) => {
    const nx = 0.32 + Math.random() * 0.36;
    const ny = 0.72 + Math.random() * 0.12;
    sendReaction(emoji, nx, ny);
  }, [sendReaction]);

  // Pull session context + auto-join from local profile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`cartoonist_joined_${roomId}`);
    const name = window.localStorage.getItem("cartoonist_user_name");
    const color = window.localStorage.getItem("cartoonist_user_color") ?? "#E07A3E";
    const storedMode = window.localStorage.getItem(`cartoonist_input_mode_${roomId}`) as "voice" | "chat" | null;
    const storedPid = window.localStorage.getItem(`cartoonist_participant_${roomId}`);
    if (storedMode) setInputMode(storedMode);
    if (name) {
      // Auto-join with the profile they set up during onboarding.
      // No popup — they already introduced themselves.
      setJoined(true);
      setIntroOpen(false);
      setParticipants([{ id: storedPid ?? "local", name, color }]);
      if (!cached) {
        window.localStorage.setItem(`cartoonist_joined_${roomId}`, "1");
      }
      void (async () => {
          const id = await joinParticipant(roomId, window.localStorage,
            async (id) => {
              const { error } = await supabase.from("participants")
                .insert({ id, room_id: roomId, display_name: name, color } as never);
              if (error) throw error;
            },
            async (id) => {
              const { data, error } = await supabase.from("participants")
                .select("id").eq("room_id", roomId).eq("id", id).maybeSingle();
              if (error) throw error;
              return Boolean(data);
            }, crypto.randomUUID.bind(crypto), navigator.locks,
          );
          if (storedPid) {
            const { error } = await supabase.from("participants").update({ display_name: name, color } as never)
              .eq("room_id", roomId).eq("id", id);
            if (error) throw error;
          }
          return id;
        })().then((id) => {
            if (!id) {
              console.error("[canvas] participant join returned no id");
              setJoined(false);
              setIntroOpen(true);
              toast.error("Could not join the meeting.");
              return;
            }
            window.localStorage.setItem(`cartoonist_participant_${roomId}`, id);
            setSelfPid(id);
            setParticipants((current) => current.some((person) => person.id === "local")
              ? current.map((person) => person.id === "local" ? { ...person, id } : person)
              : current.some((person) => person.id === id) ? current : [...current, { id, name, color }]);
        }).catch((error) => {
          console.error("[canvas] participant join failed", error);
          setJoined(false);
          setIntroOpen(true);
          toast.error("Could not join the meeting.");
        });
    }

    (async () => {
      const room = await roomGet(roomId);
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
        .select("id,display_name,color,role,role_today,strengths,contribution_modes,feedback_style,blockers,needs_today,can_help_with,share_blockers,share_needs,allow_voice_mention,human_layer_complete")
        .eq("room_id", roomId);
      if (parts && parts.length) {
        setParticipants((current) => {
          const merged = new Map(current.filter((p) => p.id !== "local").map((p) => [p.id, p]));
          for (const part of parts) merged.set(part.id, rowToParticipant(part as never));
          return [...merged.values()];
        });
      }
    })();
    const participantChannel = supabase.channel(`room_participants:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          setParticipants((current) => current.filter((part) => part.id !== id));
        } else {
          const part = rowToParticipant(payload.new as ParticipantRow);
          setParticipants((current) => {
            const rest = current.filter((item) => item.id !== part.id && item.id !== "local");
            return [...rest, part];
          });
        }
      }).subscribe();
    return () => { void supabase.removeChannel(participantChannel); };
  }, [roomId]);

  // v2.P6 — hydrate shapes + threads from canvas_events so reload survives.
  // Replays creates/edits/removes in insert order; groups by thread_id to
  // rebuild the Threads rail. Skips seed effect if anything hydrates.
  useEffect(() => {
    if (!canvasSubscribed) return;
    let cancelled = false;
    (async () => {
      const data = await canvasEventsForRoom(roomId);
      if (cancelled) return;
      if (data === null) return;
      const rows = mergeReplayRows(data, pendingCanvasRowsRef.current);
      pendingCanvasRowsRef.current = [];
      hydratingEventsRef.current = false;
      const lastClear = [...rows].reverse().find((row) => (row.op as { kind?: string } | null)?.kind === "clear");
      canvasWriter.setLastClear(lastClear ? { id: lastClear.id, created_at: lastClear.created_at } : null);
      const cleared = Boolean(lastClear);
      const touchedIds = new Set(rows.map((row) => (row.op as { id?: string } | null)?.id).filter((id): id is string => typeof id === "string"));
      const touchedThreads = new Set(rows.map((row) => row.thread_id).filter((id): id is string => Boolean(id)));

      const byId = new Map<string, SketchPrimitive>();
      const participantById = new Map<string, TLRecord | null>();
      const origins = new Map<string, { threadId: string; span: Record<string, unknown>; op: SketchPrimitive }>();
      const frameMap = new Map<number, StoryFrame>();
      type ThreadAcc = { latest: string; modality: string | null; shapeIds: string[]; at: number; source: "seed" | "mediator"; relation: CanvasThread["relation"] };
      const threadMap = new Map<string, ThreadAcc>();

      for (const row of rows) {
        const op = row.op as { id?: string; type?: string; kind?: string; patch?: Record<string, unknown> } | null;
        if (!op || typeof op !== "object") continue;
        const tid = row.thread_id ?? null;
        const span = (row.transcript_span ?? {}) as { latest?: string; modality?: string | null; relation?: string | null; goal?: string | null; origin?: string; frame?: StoryFrame };
        const at = new Date(row.created_at).getTime();

        // Apply op to shape map.
        applyCanvasEvent(byId, participantById, row);
        if (op.kind === "clear") {
          threadMap.clear();
          frameMap.clear();
          origins.clear();
          continue;
        }
        if (span.frame && Number.isInteger(span.frame.index)) frameMap.set(span.frame.index, span.frame);
        if (row.source === "mediator" && typeof op.id === "string" && typeof op.type === "string" && tid) {
          origins.set(op.id, { threadId: tid, span: span as Record<string, unknown>, op: op as unknown as SketchPrimitive });
        }

        // Group into threads.
        if (tid && row.source !== "participant" && row.source !== "storyboard") {
          const src: "seed" | "mediator" = row.source === "seed" ? "seed" : "mediator";
          const latest = span.latest ?? (span.origin === "session_brief" ? `Session brief: ${span.goal ?? "opening"}` : "");
          const existing = threadMap.get(tid);
          const shapeId = typeof op.id === "string" && op.kind !== "remove" && op.kind !== "edit" ? op.id : null;
          if (existing) {
            if (shapeId && !existing.shapeIds.includes(shapeId)) existing.shapeIds.push(shapeId);
            if (latest) existing.latest = latest;
            if (span.modality) existing.modality = span.modality;
            existing.at = at;
            const rel = span.relation as CanvasThread["relation"];
            if (rel) existing.relation = rel;
          } else {
            threadMap.set(tid, {
              latest: latest || "(untitled)",
              modality: span.modality ?? null,
              shapeIds: shapeId ? [shapeId] : [],
              at,
              source: src,
              relation: (span.relation as CanvasThread["relation"]) ?? null,
            });
          }
        }
      }

      // Only keep shapeIds still present on canvas.
      const alive = new Set(byId.keys());
      const rebuiltFrames = [...frameMap.values()].sort((a, b) => a.index - b.index)
        .map((frame) => ({ ...frame, shapeIds: [...byId.values()].filter((shape) => frameIndexOfShape(shape) === frame.index).map((shape) => shape.id) }));
      const rebuiltThreads: CanvasThread[] = Array.from(threadMap.entries())
        .map(([id, t]) => ({
          id,
          latest: t.latest,
          modality: t.modality,
          shapeIds: t.shapeIds.filter((sid) => alive.has(sid)),
          at: t.at,
          source: t.source,
          relation: t.relation ?? null,
        }))
        .filter((t) => t.shapeIds.length > 0)
        .sort((a, b) => a.at - b.at);

      hasCanvasHistoryRef.current = rows.some((row) => row.source !== "participant");
      if (hasCanvasHistoryRef.current || participantById.size > 0) {
        if (hasCanvasHistoryRef.current) seededRef.current = true;
        setShapes((current) => mergeHydrated(byId, current, touchedIds, cleared));
        setParticipantRecords((current) => new Map([...participantById, ...(!cleared ? [...current].filter(([id]) => !touchedIds.has(id)) : [])]));
        generatedOriginsRef.current = new Map([...origins, ...(!cleared ? [...generatedOriginsRef.current].filter(([id]) => !touchedIds.has(id)) : [])]);
        setThreads((current) => {
          const merged = new Map(rebuiltThreads.map((thread) => [thread.id, thread]));
          if (!cleared) for (const thread of current) if (!touchedThreads.has(thread.id)) merged.set(thread.id, thread);
          return [...merged.values()].sort((a, b) => a.at - b.at);
        });
        framesRef.current = rebuiltFrames;
        setFrames(rebuiltFrames);
        setActiveFrame(rebuiltFrames.at(-1)?.index ?? 0);
      }
      setEventsLoaded(true);
      eventsReady.resolve();
    })();
    return () => { cancelled = true; };
  }, [canvasSubscribed, canvasWriter, eventsReady, roomId]);

  // v2.P6 — realtime canvas sync. Any device inserting into canvas_events
  // publishes to the room channel; every other device applies the op to
  // local shapes + threads. Skips ids already known locally so we don't
  // fight our own writes.
  useEffect(() => {
    const ch = supabase
      .channel(`canvas_events:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "canvas_events", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as CanvasEventRow;
        if (hydratingEventsRef.current) {
          pendingCanvasRowsRef.current.push(row as CanvasEventRow);
          return;
        }
        const op = row.op as { id?: string; type?: string; kind?: string; patch?: Record<string, unknown> } | null;
        if (!op || typeof op !== "object") return;
        const span = (row.transcript_span ?? {}) as { latest?: string; modality?: string | null; relation?: string | null; goal?: string | null; origin?: string; client_id?: string; frame?: StoryFrame; thread_ref?: string | null };
        if (span.client_id === clientIdRef.current) return;
        if (op.kind === "clear") {
          canvasWriter.remoteClear({ id: row.id, created_at: row.created_at });
          seededRef.current = true;
          hasCanvasHistoryRef.current = true;
          waitingOpsRef.current.drain();
          generatedOriginsRef.current.clear();
          lastThreadIdRef.current = null;
          shapesRef.current = [];
          activeFrameRef.current = 0;
          window.dispatchEvent(new CustomEvent("cartoonist:clear"));
          setShapes([]);
          setParticipantRecords(new Map());
          setThreads([]);
          framesRef.current = [];
          setFrames([]);
          setActiveFrame(0);
          return;
        }
        if (span.frame && Number.isInteger(span.frame.index)) {
          framesRef.current = [...framesRef.current.filter((f) => f.index !== span.frame!.index), span.frame].sort((a, b) => a.index - b.index);
          setFrames(framesRef.current);
          setActiveFrame(span.frame.index);
        }
        if (row.source === "participant") {
          if (typeof op.id === "string") {
            waitingOpsRef.current.remove(op.id);
            window.dispatchEvent(new CustomEvent("cartoonist:remote-participant", { detail: { id: op.id } }));
          }
          setParticipantRecords((current) => {
            const next = new Map(current);
            applyCanvasEvent(new Map<string, SketchPrimitive>(), next, row);
            return next;
          });
          return;
        }
        hasCanvasHistoryRef.current = true;
        seededRef.current = true;
        const tid = row.thread_id ?? null;
        if (row.source === "mediator" && typeof op.id === "string" && typeof op.type === "string" && tid) {
          generatedOriginsRef.current.set(op.id, { threadId: tid, span: span as Record<string, unknown>, op: op as unknown as SketchPrimitive });
        }

        setShapes((current) => {
          const byId = new Map(current.map((s) => [s.id, s]));
          if (typeof op.id !== "string" || (typeof op.type === "string" && byId.has(op.id))) return current;
          applyCanvasEvent(byId, new Map<string, TLRecord | null>(), row);
          return Array.from(byId.values());
        });

        if (tid && typeof op.id === "string" && row.source !== "storyboard") {
          const rel = (span.relation as CanvasThread["relation"]) ?? null;
          const src: "seed" | "mediator" = row.source === "seed" ? "seed" : "mediator";
          setThreads((prev) => {
            if (op.kind === "remove") return prev.map((thread) => ({ ...thread, shapeIds: thread.shapeIds.filter((id) => id !== op.id) })).filter((thread) => thread.shapeIds.length > 0);
            const idx = prev.findIndex((t) => t.id === tid);
            if (idx >= 0) {
              const t = prev[idx];
              const reopenKey = `${tid}:${row.t_offset_ms}:${span.latest ?? ""}`;
              const reopened = Boolean(span.thread_ref && !appliedReopensRef.current.has(reopenKey));
              if (reopened) appliedReopensRef.current.add(reopenKey);
              const merged: CanvasThread = {
                ...t,
                shapeIds: op.kind === "edit" || t.shapeIds.includes(op.id!) ? t.shapeIds : [...t.shapeIds, op.id!],
                latest: span.latest ?? t.latest,
                modality: span.modality ?? t.modality,
                at: Date.now(),
                relation: rel ?? t.relation ?? null,
                reopenedAt: reopened ? Date.now() : t.reopenedAt,
                reopenCount: reopened ? (t.reopenCount ?? 0) + 1 : t.reopenCount,
              };
              if (reopened && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("cartoonist:reopen", { detail: { oldIds: t.shapeIds, newIds: op.kind === "edit" ? [] : [op.id], relation: merged.relation } }));
                setReopenPeek({ relation: merged.relation ?? null, latest: span.latest ?? "", oldLatest: t.latest });
                window.setTimeout(() => setReopenPeek(null), 4200);
              }
              return [...prev.slice(0, idx), ...prev.slice(idx + 1), merged];
            }
            if (op.kind === "edit") return prev;
            return [
              ...prev.slice(-49),
              {
                id: tid,
                latest: span.latest ?? (span.origin === "session_brief" ? `Session brief: ${span.goal ?? "opening"}` : "(remote)"),
                modality: span.modality ?? null,
                shapeIds: [op.id!],
                at: Date.now(),
                source: src,
                relation: rel,
              },
            ];
          });
        }
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") setCanvasSubscribed(true); });
    return () => { void supabase.removeChannel(ch); };
  }, [canvasWriter, roomId]);





  // Seed initial shapes from session setup the first time we have context + empty canvas
  useEffect(() => {
    if (!shouldSeedCanvas(eventsLoaded, seededRef.current, shapes.length, Boolean(sessionCtx?.goal), hasCanvasHistoryRef.current)) return;
    if (!sessionCtx) return;
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
    const seedThread = `thread_seed_${roomId}`;
    publishCanvasRows(seeded.map((shape) => ({
        room_id: roomId, op: shape,
        t_offset_ms: Date.now() - startedAtRef.current,
        source: "seed",
        transcript_span: { origin: "session_brief", goal: sessionCtx.goal ?? null, client_id: clientIdRef.current },
        confidence: 1,
        thread_id: seedThread,
    })), true);
    setThreads((prev) => [
      ...prev,
      {
        id: seedThread,
        latest: `Session brief: ${sessionCtx.goal ?? sessionCtx.name ?? "opening"}`,
        modality: "seed",
        shapeIds: seeded.map((s) => s.id),
        at: Date.now(),
        source: "seed",
      },
    ]);
  }, [eventsLoaded, sessionCtx, shapes.length, roomId, publishCanvasRows]);


  const summarizeCanvas = useCallback(() => {
    const current = shapesRef.current;
    if (current.length === 0) return "(empty)";
    // Detail passes need the complete screen geometry. The old last-30 slice
    // hid frames and panels from later passes, so components were guessed and
    // stacked. This compact digest fits hundreds of primitives while retaining
    // exact bounds, hierarchy cues, copy, and semantic styling.
    return current
      .slice(-320)
      .map((s) => {
        const visual = `${s.style === "ui" ? ":ui" : ""}${s.tone ? `:${s.tone}` : ""}`;
        switch (s.type) {
          case "arrow":
            return `arrow[${s.id}] ${s.x1},${s.y1}→${s.x2},${s.y2}${s.label ? ` "${s.label}"` : ""}`;
          case "line":
            return `line[${s.id}] ${s.x1},${s.y1}→${s.x2},${s.y2}`;
          case "text":
            return `text[${s.id}${visual}] @${s.x},${s.y} "${s.text.slice(0, 80)}"`;
          case "note":
            return `note[${s.id}] @${s.x},${s.y} "${s.text}"`;
          case "icon":
            return `icon[${s.id}${visual}] ${s.kind} @${s.x},${s.y} ${s.size ?? 24}${s.label ? ` "${s.label}"` : ""}`;
          case "path":
            return `path[${s.id}] ${s.points.length}pts`;
          case "stroke":
            return `stroke[${s.id}]`;
          default:
            return `${s.type}[${s.id}${visual}] @${s.x},${s.y} ${s.w}x${s.h}${s.label ? ` "${s.label}"` : ""}`;
        }
      })
      .join("\n");
  }, []);

  const requestDraw = useCallback(async (latest: string, enrichPass = 0, maxFidelity = false): Promise<boolean> => {
    const cleanLatest = latest.trim();
    if (!cleanLatest || NON_SPEECH_TRANSCRIPT.test(cleanLatest)) return false;
    await eventsReady.promise;
    if (drawInFlightRef.current) return false;
    const requestsUi = /\b(high[-\s]?fi(?:delity)?|wireframes?|mockups?|ui screens?|interface|dashboard|editor|app (?:screen|page)|website (?:screen|page)|production[-\s]?ready)\b/i.test(cleanLatest);
    // Wait for a content-specific plan; never seed an unrelated demo dashboard.
    drawInFlightRef.current = true;
    setThinking(true);
    setDrawError(null);
    try {
      // Send rolling context: last 12 final utterances + the latest delta.
      const recent = speech.finals.slice(-12).join(" ");
      const fullContext = recent ? `${recent}\n---LATEST---\n${cleanLatest}` : cleanLatest;
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
      // v2.P3 follow-up — unify mediator + drafter on the same agent block.
      const agentsBlock = userAgentsPromptBlock(buildUserAgents(participants, inferredStatesRef.current));
      const voiceAllowedNames = participants.filter((p) => p.allow_voice_mention !== false).map((p) => p.name);
      // v2.P6 — send recent open threads so the model can extend/reference them.
      const openThreads = threads.slice(-8).map((t) => ({ id: t.id, latest: t.latest, modality: t.modality }));
      // Raise-hand queue → mediator surfaces the next hand at natural pauses.
      const handsUp = handQueue.map((h) => h.name);
      const { data: auth } = await supabase.auth.getSession();
      // Let the model finish rather than discarding a paid generation on a timer.
      const event = await runAgentEvent(meetingEventStore(roomId, "drafter"), eventKey("drafter", roomId, `${fullContext}:${enrichPass}`, "drawing"), async () => {
        const res = await fetch("/api/cartoonist-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth.session?.access_token ? { Authorization: `Bearer ${auth.session.access_token}` } : {}) },
        body: JSON.stringify({ roomId, transcript: fullContext, latest: cleanLatest, existing: summarizeCanvas(), occupied: bboxOf(shapesRef.current), sessionContext: sessionCtx, participants: participants.map(participantForPrompt), liveStates, agentsBlock, voiceAllowedNames, openThreads, handsUp, enrichPass, maxFidelity: maxFidelity || requestsUi, fidelity: getRenderStyle().fidelity, ink: getRenderStyle().ink, costCapUsd: getCostCap(roomId), memoryBlock: sessionMemoryBlock(sessionMemoryRef.current) }),
      });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error ?? "AI draw failed");
        return data;
      });
      if (event.status === "failed") { setDrawError(event.error ?? "AI draw failed"); return true; }
      if (event.status === "running") return true;
      if (!event.claimed) return true;
      const data = event.result as Record<string, unknown>;
      // v2.P4 — mediator speaks. Prefer ElevenLabs (warm, natural) via
      // /api/mediator-tts; fall back to Web Speech if that fails. Gated by
      // the per-user mute toggle. Deduped so re-renders don't repeat.
      const speak = typeof data?.speak === "string" ? data.speak.trim() : "";
      playMediatorLine(speak);

      let incoming = Array.isArray(data.shapes) ? (data.shapes as SketchPrimitive[]) : [];
      if (data?.modality === "ui_wireframe") {
        incoming = incoming.map((shape) => ({ ...shape, style: "ui" as const }));
      }
      const edits = Array.isArray(data.edits) ? (data.edits as Array<{ id: string; patch: Record<string, unknown> }>) : [];
      const removes = Array.isArray(data.removes) ? (data.removes as string[]) : [];
      // v1 P2.3 — storyboard placement. Each topic owns a 1200px frame; a fresh
      // batch is left-aligned in the active frame and stacked under whatever is
      // already there. Enrichment passes (enrichPass > 0) draw in place.
      let landedFrame = activeFrameRef.current;
      if (enrichPass === 0 && incoming.length > 0) {
        const topics = sessionMemoryRef.current.topics ?? [];
        const topic = topics[topics.length - 1] ?? sessionCtx?.name ?? "Opening";
        landedFrame = ensureFrame(topic);
        const inFrame = shapesRef.current.filter((s) => frameIndexOfShape(s) === landedFrame);
        const placed = placeInFrame(incoming, landedFrame, inFrame);
        // Guard: never let a batch overlap what is already inside the frame.
        incoming = placeBatchClear(inFrame, placed);
      }

      if (incoming.length === 0 && edits.length === 0 && removes.length === 0) return true;

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
        // v2.P6 — if the model set a thread_ref to an existing open thread,
        // reuse that id so new shapes attach to (and re-open) it.
        const stamp = Date.now() - startedAtRef.current;
        const threadRef = typeof (data as { thread_ref?: unknown }).thread_ref === "string" ? (data as { thread_ref: string }).thread_ref : null;
        const rawRelation = typeof (data as { relation?: unknown }).relation === "string" ? (data as { relation: string }).relation : null;
        const relation = (["extends", "references", "contradicts", "resolves"] as const).find((r) => r === rawRelation) ?? null;
        // Enrichment passes belong to the thread the first pass opened.
        const threadId = threadRef ?? ((enrichPass > 0 && lastThreadIdRef.current) || `thread_${crypto.randomUUID().slice(0, 8)}`);
        lastThreadIdRef.current = threadId;
        const span = {
          origin: "utterance" as const,
          latest: cleanLatest.slice(0, 240),
          modality: typeof (data as { modality?: unknown }).modality === "string" ? (data as { modality: string }).modality : null,
          thread_ref: threadRef,
          relation,
          client_id: clientIdRef.current,
        };
        for (const shape of fresh) generatedOriginsRef.current.set(shape.id, { threadId, span, op: shape });
        // Perf: one batched insert instead of a request per primitive — a
        // dense wireframe used to fire ~170 individual POSTs and stall the tab.
        const rows = [
          ...fresh.map((shape) => ({
            room_id: roomId, op: JSON.parse(JSON.stringify(shape)) as Record<string, unknown>, t_offset_ms: stamp,
            source: "mediator", transcript_span: span, confidence: 0.8, thread_id: threadId,
          })),
          ...edits.filter(({ id }) => byId.has(id)).map(({ id, patch }) => ({
            room_id: roomId, op: JSON.parse(JSON.stringify({ kind: "edit", id, patch })) as Record<string, unknown>, t_offset_ms: stamp,
            source: "mediator", transcript_span: span, confidence: 0.9, thread_id: threadId,
          })),
          ...removes.map((id) => ({
            room_id: roomId, op: { kind: "remove", id } as unknown as Record<string, unknown>, t_offset_ms: stamp,
            source: "mediator", transcript_span: span, confidence: 0.9, thread_id: threadId,
          })),
        ];
        publishCanvasRows(rows);
        // Track thread client-side for the Threads rail (jump-to on canvas).
        if (fresh.length || edits.length || removes.length) {
          const modality = span.modality;
          const newIds = [
            ...fresh.map((s) => s.id),
            ...edits.map((e) => e.id).filter((id) => byId.has(id)),
          ];
          if (newIds.length || removes.length) {
            setThreads((prev) => {
              const remaining = prev.map((thread) => ({ ...thread, shapeIds: thread.shapeIds.filter((id) => !removes.includes(id)) }))
                .filter((thread) => thread.shapeIds.length > 0);
              if (!newIds.length) return remaining;
              if (threadRef) {
                // Merge into existing thread — mark reopened.
                const idx = remaining.findIndex((t) => t.id === threadRef);
                if (idx >= 0) {
                  const existing = remaining[idx];
                  const merged: CanvasThread = {
                    ...existing,
                    latest: cleanLatest.slice(0, 240) || existing.latest,
                    modality: modality ?? existing.modality,
                    shapeIds: Array.from(new Set([...existing.shapeIds, ...newIds])),
                    at: Date.now(),
                    reopenedAt: Date.now(),
                    reopenCount: (existing.reopenCount ?? 0) + 1,
                    relation: relation ?? existing.relation ?? null,
                  };
                  // v2.P6 — fire the glow + peek so the reopen is felt, not just filed.
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("cartoonist:reopen", {
                      detail: { oldIds: existing.shapeIds, newIds, relation: relation ?? existing.relation ?? null },
                    }));
                    setReopenPeek({ relation: relation ?? existing.relation ?? null, latest: cleanLatest.slice(0, 160), oldLatest: existing.latest });
                    window.setTimeout(() => setReopenPeek(null), 4200);
                  }
                  return [...remaining.slice(0, idx), ...remaining.slice(idx + 1), merged];
                }
              }
              return [
                ...remaining.slice(-49),
                { id: threadId, latest: cleanLatest.slice(0, 240), modality, shapeIds: newIds, at: Date.now(), source: "mediator", relation: relation ?? null },
              ];
            });
          }
        }
        return Array.from(byId.values());
      });
      // v1 P2.3 — file the new marks under the active frame and pan the camera
      // there so the room follows the story instead of hunting for it.
      if (incoming.length > 0) {
        const ids = incoming.map((s) => s.id);
        framesRef.current = framesRef.current.map((f) =>
          f.index === landedFrame ? { ...f, shapeIds: [...f.shapeIds, ...ids] } : f,
        );
        setFrames(framesRef.current);
        if (enrichPass === 0 && typeof window !== "undefined") {
          const bounds = bboxOf(incoming);
          const focusIds = data?.modality === "ui_wireframe" && bounds
            ? incoming.filter(s => "x" in s ? s.x < bounds.minX + 1000 : s.type === "line" ? s.x1 < bounds.minX + 1000 : false).map(s => s.id)
            : ids;
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids: focusIds, clearSelection: true } })), 180);
        }
      }
      // v2.P6 — cross-session recall: if this utterance echoes a thread from an
      // earlier session, persist the edge and ghost-surface it in the room.
      const sourceThreadId = lastThreadIdRef.current;
      void runAgentEvent(meetingEventStore(roomId, "librarian"), eventKey("librarian", roomId, cleanLatest), () => memoryRef.current.recall(cleanLatest)).then(event => {
        if (event.status === "completed" && event.result && sourceThreadId) void memoryRef.current.record(event.result, sourceThreadId);
        if (event.status === "failed") setDrawError(event.error ?? "Could not check earlier sessions.");
      }).catch(cause => setDrawError(cause instanceof Error ? cause.message : "Could not save memory event."));
      // Progressive fidelity: the structural pass is already on screen; ask
      // for additive detail so the wireframe thickens live instead of the
      // room staring at a blank canvas for minutes.
      const maxPasses = Number((data as { maxPasses?: unknown }).maxPasses ?? 2) || 2;
      const wantsMax = maxFidelity || (data as { maxFidelity?: boolean }).maxFidelity === true;
      if ((data as { enrichable?: boolean }).enrichable && enrichPass < maxPasses) {
        window.setTimeout(() => { void requestDrawRef.current?.(cleanLatest, enrichPass + 1, wantsMax); }, 120);
      }
      return true;
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      setDrawError(aborted ? "Drawing timed out. Your voice request was kept and will retry." : e instanceof Error ? e.message : "Network error");
      return false;
    } finally {
      drawInFlightRef.current = false;
      setThinking(false);
    }
  }, [roomId, speech.finals, summarizeCanvas, sessionCtx, participants, handQueue, threads, playMediatorLine, ensureFrame, publishCanvasRows, eventsReady]);

  // Self-reference so a completed pass can chain the next enrichment pass.
  const requestDrawRef = useRef<typeof requestDraw | null>(null);
  useEffect(() => { requestDrawRef.current = requestDraw; }, [requestDraw]);

  // Auto-draw from speech: debounce ~1.2s after the last new final utterance,
  // so the mediator reacts as soon as the speaker pauses instead of waiting
  // for a fixed 6s tick. Voice mode only.
  useEffect(() => {
    if (inputMode === "chat") return;
    if (!speech.listening) return;
    if (thinking) return;
    const text = speech.finals.join(" ");
    if (text.length <= lastSentLenRef.current + 6) return;
    const timer = setTimeout(() => {
      const newText = text.slice(lastSentLenRef.current);
      const endLength = text.length;
      const query = wakeFromStream(text.slice(0, lastSentLenRef.current), newText);
      if (query !== null) {
        lastSentLenRef.current = endLength;
        if (query) void voiceQueryRef.current(query);
        return;
      }
      if (NON_SPEECH_TRANSCRIPT.test(newText.trim())) {
        lastSentLenRef.current = endLength;
        return;
      }
      void requestDraw(newText).then((handled) => {
        if (handled) {
          lastSentLenRef.current = Math.max(lastSentLenRef.current, endLength);
        } else if (drawInFlightRef.current) {
          // Lane busy (a wireframe ladder is running). Retry shortly instead of
          // waiting for brand-new speech — that was the "limbo" stall.
          retryTimerRef.current = window.setTimeout(() => setRetryTick((n) => n + 1), 900);
        }
      });
    }, 600);
    return () => {
      clearTimeout(timer);
      if (retryTimerRef.current) { window.clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    };
  }, [requestDraw, speech.finals, speech.listening, inputMode, thinking, retryTick]);

  // v2.P6 — publish a per-shape relations map to Canvas so it can render
  // persistent ↗ chips glued to any shape belonging to a reopened / related
  // thread. One chip per shape; click → focus the whole thread.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const items: Array<{ id: string; threadId: string; relation: string; label: string; peer: string }> = [];
    for (const t of threads) {
      if (!t.relation) continue;
      const label = t.latest.slice(0, 120);
      // One chip per THREAD (anchored on its first shape) — chips on every
      // shape turned dense wireframes into a field of orange arrows.
      const sid = t.shapeIds[0];
      if (!sid) continue;
      items.push({ id: sid, threadId: t.id, relation: t.relation, label, peer: t.latest.slice(0, 160) });
    }
    window.dispatchEvent(new CustomEvent("cartoonist:relations", { detail: { items } }));
  }, [threads]);

  // While someone is recording an intro / check-in on this device, the room
  // must let go of the mic — otherwise two recorders fight over one input and
  // the personal sample comes back empty.
  const captureBlocked = introOpen || checkInOpen;
  const resumeListeningRef = useRef(false);
  useEffect(() => {
    if (captureBlocked) {
      if (speech.listening) {
        resumeListeningRef.current = true;
        speech.stop();
      }
      return;
    }
    if (resumeListeningRef.current) {
      resumeListeningRef.current = false;
      void speech.start();
    }
  }, [captureBlocked, speech]);

  // Live diarization: rolling 8s chunks → ElevenLabs Scribe diarize → speaker_map
  const diarization = useLiveDiarization({
    roomId,
    enabled: inputMode === "voice" && speech.listening && !captureBlocked,
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
    void canvasWriter.clear({
      room_id: roomId, op: { kind: "clear" }, t_offset_ms: Date.now() - startedAtRef.current,
      source: "clear", transcript_span: { origin: "clear", client_id: clientIdRef.current, participant_id: selfPid },
      confidence: 1,
    }).catch((error) => console.error("[canvas] clear failed", error));
    seededRef.current = true;
    hasCanvasHistoryRef.current = true;
    waitingOpsRef.current.drain();
    generatedOriginsRef.current.clear();
    lastThreadIdRef.current = null;
    shapesRef.current = [];
    activeFrameRef.current = 0;
    window.dispatchEvent(new CustomEvent("cartoonist:clear"));
    setShapes([]);
    setParticipantRecords(new Map());
    setThreads([]);
    framesRef.current = [];
    setFrames([]);
    setActiveFrame(0);
    setFreehand([]);
    lastSentLenRef.current = speech.finals.join(" ").length;
  }, [canvasWriter, participantRecords, roomId, selfPid, speech.finals]);

  const toggleDraw = useCallback(() => {
    setDrawing((d) => !d);
  }, []);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Room link copied");
  }, []);

  const generateArtifacts = useCallback(async (requestedUpdate?: string): Promise<boolean> => {
    setPanelTab("artifacts");
    setPanelOpen(true);
    const transcript = speech.finals.length ? speech.finals.join("\n") : "(no transcript yet — start the mic or type to Cartoonist)";
    setGenerating(true);
    setArtifacts({});
    try {
      const { buildUserAgents, userAgentsPromptBlock } = await import("@/lib/user-agents");
      const agents = buildUserAgents(participants, inferredStatesRef.current);
      const participantsBlock = userAgentsPromptBlock(agents);
      const event = await runAgentEvent(meetingEventStore(roomId, "drafter"), eventKey("drafter", roomId, requestedUpdate ? `${transcript}:${requestedUpdate}` : transcript, "documents"), async () => {
        const res = await fetch("/api/generate-artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, transcript, participantsBlock, requestedUpdate }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Could not update documents.");
        return data as Artifacts;
      });
      if (event.status === "failed") throw new Error(event.error ?? "Could not update documents.");
      if (event.status === "running") { toast.info("Documents are being drafted."); return false; }
      setArtifacts(event.result as Artifacts);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
      return false;
    } finally {
      setGenerating(false);
    }
  }, [speech.finals, participants]);

  // v1 P2.4 — partial artifacts while listening. Background drafts keep the
  // Artifacts tab warm so it is never an empty "click to generate" surface.
  const liveArtifacts = useLiveArtifacts({
    roomId,
    transcript: speech.finals.join("\n"),
    enabled: joined && !generating,
    buildParticipantsBlock: async () => {
      const { buildUserAgents, userAgentsPromptBlock } = await import("@/lib/user-agents");
      return userAgentsPromptBlock(buildUserAgents(participants, inferredStatesRef.current));
    },
    onDraft: (data: unknown) => setArtifacts(data as Artifacts),
  });

  // Phase 3.1 — Devil's Advocate. Names the risks/gaps the room is skating
  // past; each item cites the words that triggered it and can be pinned to
  // the canvas as a pink sticky.
  const devil = useDevilsAdvocate({
    roomId,
    transcript: speech.finals.join("\n"),
    memoryBlock: sessionMemoryBlock(sessionMemory),
    enabled: joined,
  });

  // Phase 3.3 — Historian. Answers "what did we say about X earlier?" only
  // with words the room actually said, and can pin the callback to the canvas.
  const historian = useHistorian({
    roomId,
    transcript: speech.finals.join("\n"),
    memoryBlock: sessionMemoryBlock(sessionMemory),
  });
  const webRefs = useWebReferences({
    roomId,
    transcript: speech.finals.join("\n"),
  });

  voiceQueryRef.current = async (query) => {
    const action = voiceAction(query);
    if (action === "draw") { await requestDraw(query); return; }
    if (action === "documents") {
      if (await generateArtifacts(query)) playMediatorLine("I updated the session documents. They are ready to review.");
      return;
    }
    setPanelTab("recall");
    setPanelOpen(true);
    const entry = await historian.ask(query);
    if (entry) playMediatorLine(entry.answer);
  };

  useEffect(() => {
    if (speech.finals.length !== voiceSeenRef.current) {
      voiceSeenRef.current = speech.finals.length;
      lastHumanAtRef.current = Date.now();
      const utterance = speech.finals.at(-1);
      if (utterance) void runAgentEvent(meetingEventStore(roomId, "scribe"), eventKey("scribe", roomId, `${voiceSeenRef.current}:${utterance}`), () => ({ text: utterance })).catch(cause => setDrawError(cause instanceof Error ? cause.message : "Could not save speech event."));
    }
    if (!pausePrompts || !speech.listening || mediatorMuted || thinking) return;
    const timer = window.setInterval(() => {
      if (nudgeAtRef.current === voiceSeenRef.current) return;
      const line = pauseNudge(speech.finals.at(-1) ?? "", Date.now() - lastHumanAtRef.current, pausePrompts);
      if (line) {
        nudgeAtRef.current = voiceSeenRef.current;
        void runAgentEvent(meetingEventStore(roomId, "facilitator"), eventKey("facilitator", roomId, `${voiceSeenRef.current}:${speech.finals.at(-1)}`), () => ({ line })).then(event => {
          if (event.claimed && event.status === "completed") playMediatorLine(line);
          if (event.status === "failed") setDrawError(event.error ?? "Could not save pause prompt.");
        }).catch(cause => setDrawError(cause instanceof Error ? cause.message : "Could not save pause prompt."));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [roomId, pausePrompts, speech.finals, speech.listening, mediatorMuted, thinking, playMediatorLine]);

  const pinRecall = useCallback((entry: RecallEntry) => {
    const occupied = bboxOf(shapesRef.current);
    const note: SketchPrimitive = {
      type: "note",
      id: `n_recall_${entry.id}`,
      x: occupied ? occupied.maxX + 80 : 80,
      y: occupied ? occupied.minY + 220 : 80,
      w: 220,
      h: 180,
      text: `EARLIER\n${entry.answer}${entry.quotes[0] ? `\n“${entry.quotes[0].text.slice(0, 120)}”` : ""}`,
      color: "blue",
    } as SketchPrimitive;
    setShapes((current) => (current.some((s) => s.id === note.id) ? current : [...current, note]));
    publishCanvasRows([{
      room_id: roomId, op: note, t_offset_ms: Date.now() - startedAtRef.current,
      source: "recall", transcript_span: { origin: "recall", client_id: clientIdRef.current }, confidence: 1,
    }]);
    toast.success("Pinned to canvas");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids: [note.id] } }));
    }
  }, [publishCanvasRows, roomId]);

  const pinReference = useCallback((ref: WebReference) => {
    const occupied = bboxOf(shapesRef.current);
    const shape = referenceToShape(ref, {
      x: occupied ? occupied.maxX + 80 : 80,
      y: occupied ? occupied.minY + 80 : 80,
    });
    const event = referenceCanvasEvent(roomId, shape, ref, Date.now() - startedAtRef.current);
    setShapes((current) => (current.some((s) => s.id === shape.id) ? current : [...current, shape]));
    setThreads((prev) => {
      if (prev.some((t) => t.id === event.thread_id || t.shapeIds.includes(shape.id))) return prev;
      return [...prev.slice(-49), {
        id: event.thread_id,
        latest: ref.title,
        modality: "reference",
        shapeIds: [shape.id],
        at: Date.now(),
        source: "mediator",
        relation: null,
      }];
    });
    publishCanvasRows([event as unknown as Record<string, unknown>]);
    void webRefs.save(ref, shape.id);
    toast.success("Pinned to canvas");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids: [shape.id] } }));
    }
  }, [publishCanvasRows, roomId, webRefs.save]);

  const pinRisk = useCallback((risk: DevilRisk) => {
    const occupied = bboxOf(shapesRef.current);
    const note: SketchPrimitive = {
      type: "note",
      id: `n_risk_${risk.id}`,
      x: occupied ? occupied.maxX + 80 : 80,
      y: occupied ? occupied.minY : 80,
      w: 220,
      h: 180,
      text: `${risk.kind.toUpperCase()}\n${risk.text}`,
      color: "pink",
    } as SketchPrimitive;
    setShapes((current) => (current.some((s) => s.id === note.id) ? current : [...current, note]));
    publishCanvasRows([{
      room_id: roomId, op: note, t_offset_ms: Date.now() - startedAtRef.current,
      source: "risk", transcript_span: { origin: "risk", client_id: clientIdRef.current }, confidence: 1,
    }]);
    devil.markPinned(risk.id);
    toast.success("Pinned to canvas");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids: [note.id] } }));
    }
  }, [devil, publishCanvasRows, roomId]);




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
    let pid: string | null = null;
    if (!isAdd) {
      try {
        pid = await joinParticipant(roomId, window.localStorage,
          async (id) => {
            const { error } = await supabase.from("participants").insert({
              id, room_id: roomId, display_name: data.name, role: data.role,
              personality: data.personality, color: data.color, input_mode: inputMode,
              voice_sample_path: data.voiceSamplePath,
            } as never);
            if (error) throw error;
          },
          async (id) => {
            const { data: found, error } = await supabase.from("participants")
              .select("id").eq("room_id", roomId).eq("id", id).maybeSingle();
            if (error) throw error;
            return Boolean(found);
          }, crypto.randomUUID.bind(crypto), navigator.locks,
        );
      } catch (error) {
        console.error("[canvas] participant join failed", error);
        setJoined(false);
        setIntroOpen(true);
        toast.error("Could not join the meeting.");
        return;
      }
    }
    if (isAdd) {
      const { data: ins, error } = await supabase.from("participants").insert({
        room_id: roomId, display_name: data.name, role: data.role,
        personality: data.personality, color: data.color, input_mode: inputMode,
        voice_sample_path: data.voiceSamplePath,
      } as never).select("id").maybeSingle();
      if (error) console.error("[canvas] participant join failed", error);
      pid = ins?.id ?? null;
    } else if (pid) {
      const { error } = await supabase.from("participants").update({
        display_name: data.name, role: data.role, personality: data.personality,
        color: data.color, input_mode: inputMode, voice_sample_path: data.voiceSamplePath,
      } as never).eq("room_id", roomId).eq("id", pid);
      if (error) console.error("[canvas] participant update failed", error);
    }
    if (!pid) {
      if (!isAdd) {
        setJoined(false);
        setIntroOpen(true);
      }
      toast.error("Could not join the meeting.");
      return;
    }
    toast.success(isAdd ? `${data.name} added` : `Welcome, ${data.name}`);

    if (isAdd) {
      setParticipants((prev) => [...prev, { id: pid, name: data.name, role: data.role, color: data.color }]);
      // In kiosk mode, immediately walk this new person through their check-in.
      if (kioskMode) {
        setCheckInInitial(EMPTY_HUMAN_LAYER);
        setCheckInPid(pid);
        setCheckInName(data.name);
        setCheckInOpen(true);
      }
    } else {
      window.localStorage.setItem(`cartoonist_participant_${roomId}`, pid);
      setSelfPid(pid);
      setParticipants((current) => current.some((person) => person.id === pid)
        ? current : [...current, { id: pid, name: data.name, role: data.role, color: data.color }]);
      // v2.P1 — right after they finish self-intro, prompt the human-layer check-in.
      setCheckInInitial(EMPTY_HUMAN_LAYER);
      setCheckInPid(pid);
      setCheckInName(data.name);
      setCheckInOpen(true);
    }
  }, [roomId, inputMode, introMode, kioskMode]);

  const promptAddNextInKiosk = useCallback(() => {
    setCheckInOpen(false);
    setCheckInPid(null);
    setCheckInName(null);
    setIntroMode("add");
    setIntroOpen(true);
    toast.info("Add the next person, or close to end kiosk.");
  }, []);

  const advanceKiosk = useCallback((remaining: string[], inKiosk: boolean) => {
    if (remaining.length === 0) {
      setKioskQueue([]);
      if (inKiosk) {
        promptAddNextInKiosk();
      } else {
        setCheckInPid(null);
        setCheckInName(null);
        setCheckInOpen(false);
        toast.success("Check-ins done");
      }
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
  }, [promptAddNextInKiosk]);

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
      allow_voice_mention: hl.allow_voice_mention,
      human_layer_complete: true,
    };
    await supabase.from("participants").update(patch).eq("id", pid);
    setParticipants((prev) => prev.map((p) => p.id === pid ? { ...p, ...patch } : p));
    toast.success("Checked in");
    if (kioskQueue.length > 0) {
      advanceKiosk(kioskQueue, kioskMode);
    } else if (kioskMode) {
      promptAddNextInKiosk();
    } else {
      setCheckInOpen(false);
      setCheckInPid(null);
      setCheckInName(null);
    }
  }, [checkInPid, selfPid, kioskQueue, kioskMode, advanceKiosk, promptAddNextInKiosk]);

  const handleCheckInSkip = useCallback(() => {
    if (kioskQueue.length > 0) {
      advanceKiosk(kioskQueue, kioskMode);
    } else if (kioskMode) {
      promptAddNextInKiosk();
    } else {
      setCheckInOpen(false);
      setCheckInPid(null);
      setCheckInName(null);
    }
  }, [kioskQueue, kioskMode, advanceKiosk, promptAddNextInKiosk]);

  const openCheckInFor = useCallback((pid: string) => {
    const p = participants.find((x) => x.id === pid);
    setCheckInInitial(p ? humanLayerFromParticipant(p) : EMPTY_HUMAN_LAYER);
    setCheckInPid(pid);
    setCheckInName(p?.name ?? null);
    setCheckInOpen(true);
  }, [participants]);

  const startKiosk = useCallback(() => {
    if (kioskMode) {
      // Toggle off — end the kiosk loop.
      setKioskMode(false);
      setKioskQueue([]);
      setCheckInOpen(false);
      setIntroOpen(false);
      setIntroMode("self");
      toast.info("Kiosk ended");
      return;
    }
    setKioskMode(true);
    const pending = participants.filter((p) => !p.human_layer_complete).map((p) => p.id);
    if (pending.length === 0) {
      promptAddNextInKiosk();
    } else {
      advanceKiosk(pending, true);
    }
  }, [kioskMode, participants, advanceKiosk, promptAddNextInKiosk]);

  const endKiosk = useCallback(() => {
    setKioskMode(false);
    setKioskQueue([]);
  }, []);


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
      <header className="z-10 flex items-center justify-between gap-4 border-b border-border bg-background px-5 py-2.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="eyebrow shrink-0 text-foreground">Cartoonist</span>
          {sessionCtx?.name && (
            <span className="truncate text-foreground" style={{ fontSize: "var(--step-1)" }}>{sessionCtx.name}</span>
          )}
          
          {speech.listening && (
            <span className="eyebrow flex shrink-0 items-center gap-1.5 bg-primary px-1.5 py-0.5 text-primary-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
              Listening
            </span>
          )}
          {thinking && (
            <span className="eyebrow flex shrink-0 items-center gap-1.5 bg-foreground px-1.5 py-0.5 text-background">
              <Sparkles className="h-3 w-3" />
              Drawing
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { setPanelTab("people"); setPanelOpen(true); }}
            title="People in this room"
            className="flex items-center gap-1"
          >
            {participants.slice(0, 5).map((p) => (
              <span key={p.id} className="flex h-6 w-6 items-center justify-center border border-border font-medium uppercase text-background" style={{ backgroundColor: p.color, fontSize: "var(--step-0)" }} title={p.name}>
                {p.name.slice(0, 1)}
              </span>
            ))}
            {participants.length > 5 && (
              <span className="eyebrow tabular-nums text-muted-foreground">+{participants.length - 5}</span>
            )}
          </button>
          <Button size="sm" variant="outline" onClick={copyLink} className="h-8 gap-1.5 rounded-none border-border">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="eyebrow max-[900px]:sr-only">Share</span>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 rounded-none border-border p-0" aria-label="Session menu">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-60 rounded-none border-foreground p-1.5 [&_button]:w-full [&_button]:justify-start"
            >
              <Button size="sm" variant="ghost" onClick={openAddPerson} className="h-8 gap-2 rounded-none">
                <UserPlus className="h-3.5 w-3.5" /><span className="eyebrow">Add someone here</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPanelTab("artifacts"); setPanelOpen(true); void generateArtifacts(); }} className="h-8 gap-2 rounded-none">
                <FileDown className="h-3.5 w-3.5" /><span className="eyebrow">Export artifacts</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-testid="memory-trigger"
                onClick={() => { setPanelTab("memory"); setPanelOpen(true); }}
                className="h-8 gap-2 rounded-none"
              >
                <Brain className="h-3.5 w-3.5" /><span className="eyebrow">Memory</span>
              </Button>
              <SessionRecap
                roomId={roomId}
                buildRequest={() => ({
                  transcript: speech.finals.length ? speech.finals.join("\n") : "",
                  canvasSummary: summarizeCanvas(),
                  sessionContext: sessionCtx ? { name: sessionCtx.name, goal: sessionCtx.goal, outputs: sessionCtx.outputs } : null,
                  participants: participants.map((p) => ({ name: p.name, role: p.role ?? null })),
                })}
              />
              <span className="my-1 block h-px bg-border" />
              <Button size="sm" variant="ghost" onClick={clearCanvas} className="h-8 gap-2 rounded-none text-destructive hover:text-destructive">
                <Eraser className="h-3.5 w-3.5" /><span className="eyebrow">Clear canvas</span>
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {(speech.error || !speech.supported) && (
        <div className="flex items-center gap-3 border-b border-border bg-background px-5 py-1.5">
          <span className="eyebrow shrink-0 text-muted-foreground">{speech.error ? "Mic error" : "Mic"}</span>
          <span className="truncate text-foreground/80" style={{ fontSize: "var(--step-0)" }}>
            {speech.error ? speech.error : "Voice transcription works in Chrome / Edge. Use the prompt below to draw."}
          </span>
        </div>
      )}

      {(drawError || devil.error || liveArtifacts.error) && (
        <div className="border-b border-border bg-background px-5 py-1.5">
          <span className="eyebrow text-primary">Room error</span>{" "}
          <span className="text-foreground/80" style={{ fontSize: "var(--step-0)" }}>{drawError || devil.error || liveArtifacts.error}</span>
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
        <div ref={canvasStageRef} className="relative flex-1 overflow-hidden">
          {eventsLoaded && <CanvasProvider>
            <Canvas
              shapes={replayShapes ?? shapes}
              drawingEnabled={drawing && replayShapes === null}
              participantRecords={participantRecords}
              onParticipantOps={onParticipantOps}
              onGeneratedInteraction={onGeneratedInteraction}
            />
          </CanvasProvider>}
          <CursorsOverlay cursors={remoteCursors} />
          <ReactionsOverlay reactions={reactions} />

          {eventsLoaded && <CanvasToolbar drawing={drawing} onToggleDraw={toggleDraw} onKeepDrawing={() => window.dispatchEvent(new Event("cartoonist:keep-selected"))} />}

          {replayShapes === null && frames.length > 0 && (
            <div className="absolute left-4 top-16 z-30 flex max-w-[60%] items-center gap-1 overflow-x-auto border border-border bg-background/90 px-2 py-1.5">
              <span className="eyebrow mr-1 shrink-0 text-muted-foreground">frames</span>
              {frames.map((f) => (
                <button
                  key={f.index}
                  type="button"
                  onClick={() => jumpToFrame(f.index)}
                  title={f.topic}
                  className={`shrink-0 border px-2 py-1 text-[12px] transition-colors ${
                    f.index === activeFrame
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="tabular-nums">{f.index + 1}</span>
                  <span className="ml-1.5 hidden max-w-[120px] truncate align-middle md:inline-block">{f.topic}</span>
                </button>
              ))}
            </div>
          )}



          {handQueue.length > 0 && (
            <div className="absolute bottom-24 right-4 z-30 max-w-[200px] border border-border bg-background/90 px-2.5 py-2">
              <div className="eyebrow mb-1 text-muted-foreground">hands up · {handQueue.length}</div>
              <ul className="flex flex-col gap-1">
                {handQueue.map((h, i) => (
                  <li key={h.pid} className="flex items-center gap-2 text-[13px]">
                    <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                    <span className="inline-block h-2 w-2 shrink-0" style={{ background: h.color }} aria-hidden />
                    <span className="truncate" style={{ color: h.color }}>{h.name}</span>
                    {h.pid === handPid && (
                      <button type="button" onClick={() => lowerHand()} className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                        lower
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reopenPeek && (
            <div
              className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 border border-primary bg-background px-4 py-2"
              style={{ animation: "cartoonistPeek 4.2s ease-out forwards" }}
            >
              <p className="eyebrow text-primary">↺ {reopenPeek.relation ? reopenPeek.relation : "returning"} — earlier thread</p>
              <p className="mt-1 max-w-sm truncate" style={{ fontSize: "var(--step-0)" }}>{reopenPeek.oldLatest}</p>
            </div>
          )}

          {memory.peek && (
            <div
              data-testid="memory-peek"
              className="absolute right-6 top-6 z-20 max-w-sm border border-dashed bg-background/95 px-4 py-3"
              style={{ borderColor: "var(--accent-warm, #E07A3E)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow" style={{ color: "var(--accent-warm, #E07A3E)" }}>↗ this came up before — {memory.peek.roomName}</p>
                <button type="button" onClick={memory.dismissPeek} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  dismiss
                </button>
              </div>
              <p className="mt-1.5" style={{ fontSize: "var(--step-1)", lineHeight: 1.35 }}>{memory.peek.text}</p>
              <a href={`/r/${memory.peek.roomId}`} className="mt-2 inline-block text-[11px] uppercase tracking-wider underline underline-offset-4">
                open that session
              </a>
            </div>
          )}

          {shapes.length === 0 && freehand.length === 0 && (
            <div className="pointer-events-none absolute left-4 top-16 max-w-md border border-border bg-background p-5">
              <p className="eyebrow text-primary">Whiteboard ready</p>
              <p className="mt-2" style={{ fontSize: "var(--step-3)", lineHeight: 1.15 }}>
                Talk, or ask Cartoonist to draw.
              </p>
              <p className="mt-2 text-foreground/70" style={{ fontSize: "var(--step-0)" }}>
                Try: "draw the signup flow with email, Google, and a verify-email step."
              </p>
            </div>
          )}

          {/* One control zone: Cartoonist prompt with the meeting controls attached. */}
          <div className="absolute bottom-4 left-1/2 z-20 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
            {speech.listening && (
              <div className="mb-1.5 flex items-center gap-2 border border-border bg-background px-3 py-1.5">
                <div className="flex h-4 items-end gap-[2px]">
                  {micBars.map((_, i) => {
                    const threshold = (i + 1) / micBarCount;
                    const active = speech.level > threshold * 0.8;
                    const h = active ? 4 + Math.min(12, speech.level * 16) : 3;
                    return <span key={i} className="w-[3px] bg-foreground/80 transition-[height,opacity] duration-75" style={{ height: `${h}px`, opacity: active ? 1 : 0.25 }} />;
                  })}
                </div>
                <span className="truncate text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                  {recentTranscript || "hearing the room…"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-px border border-foreground bg-background">
              <button
                type="button"
                onClick={() => {
                  if (speech.listening) { speech.stop(); return; }
                  if (inputMode !== "voice") {
                    setInputMode("voice");
                    window.localStorage.setItem(`cartoonist_input_mode_${roomId}`, "voice");
                    if (selfPid) void supabase.from("participants").update({ input_mode: "both" } as never).eq("id", selfPid);
                  }
                  void speech.start();
                }}
                title={speech.listening ? "Stop listening to the room" : "Let Cartoonist hear the room"}
                className={`flex h-10 items-center gap-1.5 px-3 transition active:scale-[0.98] ${speech.listening ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="eyebrow">{speech.listening ? "Stop" : "Hear room"}</span>
              </button>
              <span className="h-6 w-px bg-border" aria-hidden />
              <form onSubmit={(e) => { e.preventDefault(); void askDraw(); }} className="flex min-w-0 flex-1 items-center gap-2 px-3">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <input
                  value={askText}
                  onChange={(e) => setAskText(e.target.value)}
                  placeholder="Ask Cartoonist to draw something…"
                  className="h-10 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: "var(--step-1)" }}
                />
                <button type="submit" disabled={!askText.trim() || thinking} className="text-muted-foreground transition hover:text-foreground disabled:opacity-30">
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <span className="h-6 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={handleToggleHand}
                title={isRaised ? "Lower hand" : "Raise hand"}
                className={`flex h-10 w-10 items-center justify-center transition active:scale-[0.98] ${isRaised ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Hand className="h-4 w-4" />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" title="React" className="flex h-10 w-10 items-center justify-center text-muted-foreground transition hover:text-foreground active:scale-[0.98]">
                    <Smile className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" sideOffset={8} className="flex w-auto gap-1 rounded-none border-foreground p-1.5">
                  {(["👍", "💡", "❓", "🔥", "❤️", "😂"] as const).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => emitReaction(e)}
                      aria-label={`React ${e}`}
                      className="h-8 w-8 text-lg leading-none transition motion-safe:hover:scale-125"
                      style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif' }}
                    >
                      {e}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => {
                  setMediatorMuted((v) => {
                    const next = !v;
                    if (next && typeof window !== "undefined") {
                      playbackEpochRef.current++;
                      stopStreamingTTS();
                      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
                      if (ttsAudioRef.current) { try { ttsAudioRef.current.pause(); } catch { /* noop */ } }
                    }
                    return next;
                  });
                }}
                title={mediatorMuted ? "Cartoonist voice is off" : "Cartoonist speaks back"}
                className={`flex h-10 w-10 items-center justify-center transition active:scale-[0.98] ${mediatorMuted ? "text-muted-foreground hover:text-foreground" : "bg-foreground text-background"}`}
              >
                {mediatorMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <CostMeter roomId={roomId} />
        </div>

        <RoomPanel
          open={panelOpen}
          onOpen={setPanelOpen}
          active={panelTab}
          onActive={(id) => setPanelTab(id as typeof panelTab)}
          tabs={[
            {
              id: "people",
              label: "People",
              icon: Users,
              count: participants.length,
              node: (
                <TeamDesk
                  embedded
                  roomId={roomId}
                  participants={participants}
                  selfPid={selfPid}
                  selfSpeaking={speech.listening}
                  selfTyping={false}
                  onInferredStates={(s) => { inferredStatesRef.current = s; }}
                  onEditProfile={() => { if (selfPid) openCheckInFor(selfPid); }}
                  onCheckInAs={openCheckInFor}
                  onStartKiosk={startKiosk}
                  kioskActive={kioskMode}
                />
              ),
            },
            {
              id: "transcript",
              label: "Transcript",
              icon: MessageSquare,
              node: (
                <div className="h-full min-h-0">
                  <ChatPanel
                    roomId={roomId}
                    selfParticipantId={selfPid}
                    selfName={participants[0]?.name ?? "You"}
                    selfColor={participants[0]?.color ?? "#E07A3E"}
                    onChatMessage={handleChatMessage}
                  />
                </div>
              ),
            },
            {
              id: "threads",
              label: "Threads",
              icon: Layers,
              count: threads.length,
              node: <ThreadList threads={threads} echoes={memory.echoes} />,
            },
            {
              id: "risks",
              label: "Risks",
              icon: ShieldAlert,
              count: devil.risks.length,
              node: (
                <RisksPanel
                  risks={devil.risks}
                  thinking={devil.thinking}
                  checkedAt={devil.checkedAt}
                  onCheckNow={devil.checkNow}
                  onPin={pinRisk}
                  onDismiss={devil.dismiss}
                />
              ),
            },
            {
              id: "recall",
              label: "Recall",
              icon: Search,
              node: (
                <><label className="flex items-center gap-2 border-b border-border px-2.5 py-2 text-[13px]">
                  <input type="checkbox" checked={pausePrompts} onChange={e => { setPausePrompts(e.target.checked); window.localStorage.setItem(`cartoonist_pause_prompts_${roomId}`, String(e.target.checked)); }} />
                  Spoken pause prompts
                </label><RecallPanel
                  entries={historian.entries}
                  asking={historian.asking}
                  error={historian.error}
                  onFocus={(threadId, shapeIds) => {
                    const ids = shapeIds.length ? shapeIds : threads.find(t => t.id === threadId)?.shapeIds ?? [];
                    if (ids.length) window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids } }));
                    else toast.info("This drawing is no longer on the canvas.");
                  }}
                  onAsk={historian.ask}
                  onPin={pinRecall}
                /></>
              ),
            },
            {
              id: "refs",
              label: "Refs",
              icon: Globe,
              count: webRefs.saved.length,
              node: (
                <ReferencesPanel
                  results={webRefs.results}
                  saved={webRefs.saved}
                  looking={webRefs.looking}
                  looked={webRefs.looked}
                  error={webRefs.error}
                  onLookup={webRefs.lookup}
                  onPin={pinReference}
                />
              ),
            },
            {
              id: "memory",
              label: "Memory",
              icon: Brain,
              node: (
                <MemoryPanel
                  roomId={roomId}
                  buildRequest={() => ({
                    transcript: speech.finals.length ? speech.finals.join("\n") : "",
                    participants: participants.map((p) => ({ id: p.id, name: p.name, role: p.role ?? null })),
                  })}
                />
              ),
            },
            {
              id: "replay",
              label: "Replay",
              icon: History,
              node: <SessionReplay embedded roomId={roomId} onFrame={setReplayShapes} />,
            },
            {
              id: "artifacts",
              label: "Artifacts",
              icon: FileDown,
              node: (
                <div className="space-y-4 px-2.5 py-2.5">
                  <SessionPack
                    build={() => ({
                      roomId,
                      sessionName: sessionCtx?.name ?? null,
                      goal: sessionCtx?.goal ?? null,
                      outputs: Array.isArray(sessionCtx?.outputs) ? sessionCtx.outputs.join(", ") : (sessionCtx?.outputs ?? null),
                      participants: participants.map((p) => ({ name: p.name, role: p.role ?? null })),
                      threads: threads.map((t) => ({ id: t.id, latest: t.latest, modality: t.modality })),
                      transcript: speech.finals.join("\n"),
                      canvasSummary: summarizeCanvas(),
                      artifacts,
                    })}
                  />
                  <ArtifactTabs
                    artifacts={artifacts}
                    loading={generating}
                    drafting={liveArtifacts.drafting}
                    draftedAt={liveArtifacts.draftedAt}
                  />

                </div>
              ),
            },
          ] satisfies RoomPanelTab[]}
        />
      </div>

      <IntroModal
        open={introOpen}
        mode={introMode}
        roomId={roomId}
        onClose={() => { setIntroOpen(false); setIntroMode("self"); if (kioskMode) endKiosk(); }}
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
