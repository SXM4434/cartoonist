import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Eraser, FileDown, Mic, MicOff, MessageSquare, MoreHorizontal, Pencil, Send, Sparkles, UserPlus, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { ParticipantWithHumanLayer } from "@/lib/canvas-types";
import type { FreehandStroke, SketchPrimitive } from "@/lib/sketch-types";
import { bboxOf, placeBatchClear } from "@/lib/sketch-layout";
import { createProductionWireframe } from "@/lib/production-wireframe";

import { EMPTY_HUMAN_LAYER, type HumanLayer } from "@/lib/human-layer";
import { useSpeech } from "@/lib/use-speech";
import { useLiveDiarization } from "@/hooks/use-live-diarization";
import { SessionPack } from "./session-pack";
import { ArtifactTabs, type Artifacts } from "./artifact-tabs";
import { SessionRecap } from "./session-recap";
import { SessionReplay } from "./session-replay";
import { KnownAboutYou } from "./known-about-you";

import { IntroModal } from "./intro-modal";
import { Canvas } from "./canvas/Canvas";
import { StyleSwitch } from "./canvas/style-switch";
import { getRenderStyle } from "@/lib/render-style";

import { CanvasProvider } from "./canvas/canvas-context";
import { ChatPanel } from "./chat-panel";
import { CostMeter } from "./cost-meter";
import { CheckIn } from "./team-desk/CheckIn";
import { TeamDesk } from "./team-desk/TeamDesk";
import { ThreadRail, type CanvasThread } from "./team-desk/ThreadRail";
import type { InferredState } from "./team-desk/use-inferred-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { buildUserAgents, userAgentsPromptBlock } from "@/lib/user-agents";
import { playStreamingTTS } from "@/lib/tts-stream";
import { useLiveCursors } from "@/hooks/use-live-cursors";
import { useSharedFocus } from "@/hooks/use-shared-focus";
import { CursorsOverlay } from "./team-desk/CursorsOverlay";
import { ReactionsOverlay } from "./team-desk/ReactionsOverlay";
import { useReactions } from "@/hooks/use-reactions";
import { useHandQueue } from "@/hooks/use-hand-queue";
import { useCrossSessionMemory } from "@/hooks/use-cross-session-memory";
import { canvasEventsForRoom, roomGet } from "@/lib/db-rpc";

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
  const [exportOpen, setExportOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [sessionCtx, setSessionCtx] = useState<SessionContext | null>(null);
  const [inputMode, setInputMode] = useState<"voice" | "chat">("voice");
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [mediatorMuted, setMediatorMuted] = useState(false);
  const inferredStatesRef = useRef<Record<string, InferredState>>({});
  const lastSpokenRef = useRef<string>("");
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const [threads, setThreads] = useState<CanvasThread[]>([]);
  // v2.P6 — brief peek toast when the mediator returns to an older thread.
  const [reopenPeek, setReopenPeek] = useState<{ relation: string | null; latest: string; oldLatest: string } | null>(null);

  // v2.P6 — cross-session memory: does today's talk echo an older session?
  const memory = useCrossSessionMemory(roomId);
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  const lastThreadIdRef = useRef<string | null>(null);

  const speech = useSpeech();
  const startedAtRef = useRef(Date.now());
  const lastSentLenRef = useRef(0);
  const drawInFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const seededRef = useRef(false);

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
    void (async () => {
      try {
        const audio = await playStreamingTTS({ roomId, text: speak, volume: 0.95, onEnd: onDone });
        if (audio) ttsAudioRef.current = audio;
      } catch {
        playBrowserVoice();
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
        setParticipants(parts.map((p) => rowToParticipant(p as never)));
      }
    })();
  }, [roomId]);

  // v2.P6 — hydrate shapes + threads from canvas_events so reload survives.
  // Replays creates/edits/removes in insert order; groups by thread_id to
  // rebuild the Threads rail. Skips seed effect if anything hydrates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await canvasEventsForRoom(roomId, 2000);
      if (cancelled || !data || data.length === 0) return;
      if (seededRef.current) return;

      const byId = new Map<string, SketchPrimitive>();
      type ThreadAcc = { latest: string; modality: string | null; shapeIds: string[]; at: number; source: "seed" | "mediator"; relation: CanvasThread["relation"] };
      const threadMap = new Map<string, ThreadAcc>();

      for (const row of data as Array<{ op: unknown; source: string | null; transcript_span: unknown; thread_id: string | null; created_at: string }>) {
        const op = row.op as { id?: string; type?: string; kind?: string; patch?: Record<string, unknown> } | null;
        if (!op || typeof op !== "object") continue;
        const tid = row.thread_id ?? null;
        const span = (row.transcript_span ?? {}) as { latest?: string; modality?: string | null; relation?: string | null; goal?: string | null; origin?: string };
        const at = new Date(row.created_at).getTime();

        // Apply op to shape map.
        if (op.kind === "remove" && typeof op.id === "string") {
          byId.delete(op.id);
        } else if (op.kind === "edit" && typeof op.id === "string" && op.patch) {
          const prev = byId.get(op.id);
          if (prev) byId.set(op.id, { ...prev, ...op.patch, id: prev.id, type: prev.type } as SketchPrimitive);
        } else if (typeof op.id === "string" && typeof op.type === "string") {
          byId.set(op.id, op as unknown as SketchPrimitive);
        }

        // Group into threads.
        if (tid) {
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

      if (byId.size > 0) {
        seededRef.current = true;
        setShapes(Array.from(byId.values()));
        setThreads(rebuiltThreads);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // v2.P6 — realtime canvas sync. Any device inserting into canvas_events
  // publishes to the room channel; every other device applies the op to
  // local shapes + threads. Skips ids already known locally so we don't
  // fight our own writes.
  useEffect(() => {
    const ch = supabase
      .channel(`canvas_events:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "canvas_events", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as { op: unknown; source: string | null; transcript_span: unknown; thread_id: string | null; created_at: string };
        const op = row.op as { id?: string; type?: string; kind?: string; patch?: Record<string, unknown> } | null;
        if (!op || typeof op !== "object") return;
        const span = (row.transcript_span ?? {}) as { latest?: string; modality?: string | null; relation?: string | null; goal?: string | null; origin?: string };
        const tid = row.thread_id ?? null;

        setShapes((current) => {
          const byId = new Map(current.map((s) => [s.id, s]));
          if (op.kind === "remove" && typeof op.id === "string") {
            if (!byId.has(op.id)) return current;
            byId.delete(op.id);
          } else if (op.kind === "edit" && typeof op.id === "string" && op.patch) {
            const prev = byId.get(op.id);
            if (!prev) return current;
            byId.set(op.id, { ...prev, ...op.patch, id: prev.id, type: prev.type } as SketchPrimitive);
          } else if (typeof op.id === "string" && typeof op.type === "string") {
            if (byId.has(op.id)) return current; // already local
            byId.set(op.id, op as unknown as SketchPrimitive);
          } else {
            return current;
          }
          return Array.from(byId.values());
        });

        if (tid && typeof op.id === "string" && op.kind !== "remove" && op.kind !== "edit") {
          const rel = (span.relation as CanvasThread["relation"]) ?? null;
          const src: "seed" | "mediator" = row.source === "seed" ? "seed" : "mediator";
          setThreads((prev) => {
            const idx = prev.findIndex((t) => t.id === tid);
            if (idx >= 0) {
              const t = prev[idx];
              if (t.shapeIds.includes(op.id!)) return prev;
              const merged: CanvasThread = {
                ...t,
                shapeIds: [...t.shapeIds, op.id!],
                latest: span.latest ?? t.latest,
                modality: span.modality ?? t.modality,
                at: Date.now(),
                relation: rel ?? t.relation ?? null,
              };
              return [...prev.slice(0, idx), ...prev.slice(idx + 1), merged];
            }
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
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
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
  }, [sessionCtx, shapes.length, roomId]);


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
    if (!cleanLatest || NON_SPEECH_TRANSCRIPT.test(cleanLatest) || drawInFlightRef.current) return false;
    const requestsUi = /\b(high[-\s]?fi(?:delity)?|wireframes?|mockups?|ui screens?|interface|dashboard|editor|app (?:screen|page)|website (?:screen|page)|production[-\s]?ready)\b/i.test(cleanLatest);
    // Put a complete production shell on canvas synchronously. This is not a
    // loading skeleton: it is an editable 100+ primitive screen with semantic
    // hierarchy. The AI request that follows personalizes and enriches it.
    if (enrichPass === 0 && requestsUi) {
      const occupied = bboxOf(shapesRef.current);
      const seed = createProductionWireframe(cleanLatest, occupied ? occupied.maxX + 280 : 80, 80);
      setShapes((current) => {
        const ids = new Set(current.map((shape) => shape.id));
        const unique = seed.map((shape) => ({ ...shape, id: `${shape.id}_${crypto.randomUUID().slice(0, 6)}` })).filter((shape) => !ids.has(shape.id));
        return [...current, ...unique];
      });
    }
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
      const controller = new AbortController();
      // Stay beyond the server's dense-wireframe allowance. A shorter client
      // timer previously aborted the response while the detail model was still
      // producing valid structured geometry.
      const timeout = window.setTimeout(() => controller.abort(), 225000);
      const res = await fetch("/api/cartoonist-draw", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, transcript: fullContext, latest: cleanLatest, existing: summarizeCanvas(), occupied: bboxOf(shapesRef.current), sessionContext: sessionCtx, participants: participants.map(participantForPrompt), liveStates, agentsBlock, voiceAllowedNames, openThreads, handsUp, enrichPass, maxFidelity, fidelity: getRenderStyle().fidelity, ink: getRenderStyle().ink }),
      });
      window.clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setDrawError(data?.error ?? "AI draw failed");
        return false;
      }
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
      // Fresh drawings must never land on top of existing marks. Enrichment
      // passes (enrichPass > 0) intentionally draw *inside* existing frames.
      if (enrichPass === 0 && incoming.length > 0) {
        incoming = placeBatchClear(shapesRef.current, incoming);
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
        };
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
        for (let i = 0; i < rows.length; i += 100) {
          void supabase.from("canvas_events").insert(rows.slice(i, i + 100) as never);
        }
        // Track thread client-side for the Threads rail (jump-to on canvas).
        if (fresh.length || edits.length) {
          const modality = span.modality;
          const newIds = [
            ...fresh.map((s) => s.id),
            ...edits.map((e) => e.id).filter((id) => byId.has(id)),
          ];
          if (newIds.length) {
            setThreads((prev) => {
              if (threadRef) {
                // Merge into existing thread — mark reopened.
                const idx = prev.findIndex((t) => t.id === threadRef);
                if (idx >= 0) {
                  const existing = prev[idx];
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
                  return [...prev.slice(0, idx), ...prev.slice(idx + 1), merged];
                }
              }
              return [
                ...prev.slice(-49),
                { id: threadId, latest: cleanLatest.slice(0, 240), modality, shapeIds: newIds, at: Date.now(), source: "mediator", relation: relation ?? null },
              ];
            });
          }
        }
        return Array.from(byId.values());
      });
      // v2.P6 — cross-session recall: if this utterance echoes a thread from an
      // earlier session, persist the edge and ghost-surface it in the room.
      try {
        const hit = memoryRef.current.recall(cleanLatest);
        if (hit && lastThreadIdRef.current) void memoryRef.current.record(hit, lastThreadIdRef.current);
      } catch { /* memory is best-effort */ }
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
  }, [roomId, speech.finals, summarizeCanvas, sessionCtx, participants, handQueue, threads, playMediatorLine]);

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
      const { buildUserAgents, userAgentsPromptBlock } = await import("@/lib/user-agents");
      const agents = buildUserAgents(participants, inferredStatesRef.current);
      const participantsBlock = userAgentsPromptBlock(agents);
      const res = await fetch("/api/generate-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, transcript, participantsBlock }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");
      setArtifacts(data as Artifacts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }, [speech.finals, participants]);

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
      // In kiosk mode, immediately walk this new person through their check-in.
      if (kioskMode) {
        setCheckInInitial(EMPTY_HUMAN_LAYER);
        setCheckInPid(pid);
        setCheckInName(data.name);
        setCheckInOpen(true);
      }
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
          <StyleSwitch />
          <Button size="sm" variant="outline" onClick={toggleDraw} className={`h-8 gap-1.5 rounded-none border-border ${drawing ? "bg-foreground text-background" : ""}`}>

            <Pencil className="h-3.5 w-3.5" /><span className="eyebrow max-[1150px]:sr-only">Draw</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChatOpen((v) => !v)} className={`h-8 gap-1.5 rounded-none border-border ${chatOpen ? "bg-foreground text-background" : ""}`}>
            <MessageSquare className="h-3.5 w-3.5" /><span className="eyebrow max-[1150px]:sr-only">Chat</span>
          </Button>
          <ThreadRail threads={threads} echoes={memory.echoes} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMediatorMuted((v) => {
                const next = !v;
                if (next && typeof window !== "undefined") {
                  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
                  if (ttsAudioRef.current) { try { ttsAudioRef.current.pause(); } catch { /* noop */ } }
                }
                return next;
              });
            }}
            title={mediatorMuted ? "Unmute mediator voice" : "Mute mediator voice"}
            className={`h-8 gap-1.5 rounded-none border-border ${mediatorMuted ? "" : "bg-foreground text-background"}`}
          >
            {mediatorMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span className="eyebrow">{mediatorMuted ? "Muted" : "Voice"}</span>
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
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-none border-border" aria-label="More session tools">
                <MoreHorizontal className="h-3.5 w-3.5" /><span className="eyebrow">More</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-56 rounded-none border-foreground p-1.5 [&_button]:w-full [&_button]:justify-start"
            >
              <Button size="sm" variant="ghost" onClick={clearCanvas} className="h-8 gap-2 rounded-none">
                <Eraser className="h-3.5 w-3.5" /><span className="eyebrow">Clear canvas</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={copyLink} className="h-8 gap-2 rounded-none">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}<span className="eyebrow">Share link</span>
              </Button>
              <Sheet open={exportOpen} onOpenChange={setExportOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={generateArtifacts} className="h-8 gap-2 rounded-none">
                    <FileDown className="h-3.5 w-3.5" /><span className="eyebrow">Export artifacts</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-2xl">
                  <SheetHeader>
                    <SheetTitle className="font-display" style={{ fontSize: "var(--step-3)" }}>Meeting artifacts</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
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
                  </div>
                  <div className="mt-4"><ArtifactTabs artifacts={artifacts} loading={generating} /></div>
                </SheetContent>
              </Sheet>
              <KnownAboutYou
                roomId={roomId}
                buildRequest={() => ({
                  transcript: speech.finals.length ? speech.finals.join("\n") : "",
                  participants: participants.map((p) => ({ id: p.id, name: p.name, role: p.role ?? null })),
                })}
              />
              <SessionReplay roomId={roomId} onFrame={setReplayShapes} />
              <SessionRecap
                roomId={roomId}
                buildRequest={() => ({
                  transcript: speech.finals.length ? speech.finals.join("\n") : "",
                  canvasSummary: summarizeCanvas(),
                  sessionContext: sessionCtx ? { name: sessionCtx.name, goal: sessionCtx.goal, outputs: sessionCtx.outputs } : null,
                  participants: participants.map((p) => ({ name: p.name, role: p.role ?? null })),
                })}
              />
            </PopoverContent>
          </Popover>
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
        <div ref={canvasStageRef} className="relative flex-1 overflow-hidden">
          <CanvasProvider>
            <Canvas shapes={replayShapes ?? shapes} drawingEnabled={drawing && replayShapes === null} />
          </CanvasProvider>
          <CursorsOverlay cursors={remoteCursors} />
          <ReactionsOverlay reactions={reactions} />

          {/* Live reactions strip — click an emoji to broadcast a floating burst */}
          <div className="absolute bottom-20 right-5 z-30 flex items-center gap-1 border border-border bg-background/95 px-2 py-1.5 shadow-sm">
            <span className="eyebrow mr-1 text-muted-foreground">react</span>
            {(["👍", "💡", "❓", "🔥", "❤️", "😂"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => emitReaction(e)}
                aria-label={`React ${e}`}
                className="h-7 w-7 text-lg leading-none transition hover:scale-125"
                style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif' }}
              >
                {e}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" />
            <button
              type="button"
              onClick={handleToggleHand}
              aria-label={isRaised ? "Lower hand" : "Raise hand"}
              title={isRaised ? "Lower hand" : "Raise hand"}
              className={`h-7 px-2 text-lg leading-none transition hover:scale-110 ${isRaised ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]" : ""}`}
              style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif' }}
            >
              ✋
            </button>
          </div>

          {/* Raise-hand queue: quieter voices get a lane. Ordered by ts. */}
          {handQueue.length > 0 && (
            <div className="absolute bottom-32 right-5 z-30 max-w-[240px] border border-border bg-background/95 px-2.5 py-2 shadow-sm">
              <div className="eyebrow mb-1 flex items-center justify-between text-muted-foreground">
                <span>hands up · {handQueue.length}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {handQueue.map((h, i) => (
                  <li key={h.pid} className="flex items-center gap-2 text-[13px]">
                    <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: h.color }}
                      aria-hidden
                    />
                    <span className="truncate" style={{ color: h.color }}>{h.name}</span>
                    {h.pid === handPid && (
                      <button
                        type="button"
                        onClick={() => lowerHand()}
                        className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
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
              className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 border border-primary bg-background px-4 py-2 shadow-sm"
              style={{ animation: "cartoonistPeek 4.2s ease-out forwards" }}
            >
              <p className="eyebrow text-primary">
                ↺ {reopenPeek.relation ? reopenPeek.relation : "returning"} — earlier thread
              </p>
              <p className="mt-1 max-w-sm truncate font-serif" style={{ fontSize: "var(--step-0)" }}>
                {reopenPeek.oldLatest}
              </p>
            </div>
          )}

          {/* v2.P6 — cross-session ghost callback. */}
          {memory.peek && (
            <div
              data-testid="memory-peek"
              className="absolute right-6 top-6 z-20 max-w-sm border border-dashed bg-background/95 px-4 py-3 shadow-sm"
              style={{ borderColor: "var(--accent-warm, #E07A3E)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow" style={{ color: "var(--accent-warm, #E07A3E)" }}>
                  ↗ this came up before — {memory.peek.roomName}
                </p>
                <button
                  type="button"
                  onClick={memory.dismissPeek}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  dismiss
                </button>
              </div>
              <p className="mt-1.5 font-serif" style={{ fontSize: "var(--step-1)", lineHeight: 1.35 }}>
                {memory.peek.text}
              </p>
              <a
                href={`/r/${memory.peek.roomId}`}
                className="mt-2 inline-block text-[11px] uppercase tracking-wider underline underline-offset-4"
              >
                open that session
              </a>
            </div>
          )}



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
            kioskActive={kioskMode}
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
