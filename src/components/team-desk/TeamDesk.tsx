import { useEffect, useMemo, useState } from "react";
import { PanelRightClose, PanelRightOpen, ClipboardEdit, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParticipantWithHumanLayer } from "@/lib/canvas-types";
import { ParticipantCard } from "./ParticipantCard";
import { useParticipantState } from "./use-participant-state";
import { useInferredState, type InferredState } from "./use-inferred-state";
import { useRoomPresence } from "@/hooks/use-presence";

/**
 * TeamDesk — right rail that keeps the humans visible while the work happens.
 * Sits above the chat rail in the same column. Collapses to a 44px avatar strip.
 */
export function TeamDesk({
  roomId,
  participants,
  selfPid,
  selfSpeaking,
  selfTyping,
  onEditProfile,
  onInferredStates,
  onCheckInAs,
  onStartKiosk,
  kioskActive,
}: {
  roomId: string;
  participants: ParticipantWithHumanLayer[];
  selfPid: string | null;
  selfSpeaking: boolean;
  selfTyping: boolean;
  onEditProfile: () => void;
  onInferredStates?: (states: Record<string, InferredState>) => void;
  onCheckInAs?: (pid: string) => void;
  onStartKiosk?: () => void;
  kioskActive?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { modeFor } = useParticipantState({ roomId, selfPid, selfSpeaking, selfTyping });
  const participantIds = useMemo(() => participants.map((p) => p.id), [participants]);
  const inferred = useInferredState({ roomId, participantIds });
  const present = useRoomPresence({ roomId, selfPid });

  useEffect(() => {
    onInferredStates?.(inferred);
  }, [inferred, onInferredStates]);

  // Hotkey: T toggles Team Desk.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-border bg-background py-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand Team Desk (T)"
          className="mb-1 flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </button>
        {participants.map((p) => (
          <div
            key={p.id}
            className="relative flex h-7 w-7 items-center justify-center border border-border font-medium uppercase text-background"
            title={present.has(p.id) ? `${p.name} · here now` : p.name}
            style={{ backgroundColor: p.color, fontSize: "var(--step-0)" }}
          >
            {p.name.slice(0, 1)}
            {present.has(p.id) && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-background bg-[color:var(--accent,#3fb56b)]" />
            )}
          </div>
        ))}
      </aside>
    );
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
        <span className="eyebrow text-foreground">
          Team Desk
          {present.size > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground normal-case tracking-normal">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent,#3fb56b)]" />
              <span className="tabular-nums">{present.size}</span>
              <span>here</span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {onStartKiosk && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onStartKiosk}
              className="h-6 gap-1 rounded-none px-1.5 text-muted-foreground hover:text-foreground"
              title={kioskActive ? "End kiosk mode" : "Walk everyone through check-in on this device"}
            >
              <Users className="h-3 w-3" />
              <span className="eyebrow">{kioskActive ? "End kiosk" : "Kiosk"}</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onEditProfile}
            className="h-6 gap-1 rounded-none px-1.5 text-muted-foreground hover:text-foreground"
            title="Edit your check-in"
          >
            <ClipboardEdit className="h-3 w-3" />
            <span className="eyebrow">Check-in</span>
          </Button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse (T)"
            className="flex h-6 w-6 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background"
          >
            <PanelRightClose className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 py-2">
        {participants.length === 0 && (
          <p className="p-2 italic text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            Waiting for participants…
          </p>
        )}
        {participants.map((p) => (
          <ParticipantCard
            key={p.id}
            p={p}
            mode={modeFor(p.id)}
            inferred={inferred[p.id]}
            isSelf={p.id === selfPid}
            onCheckInAs={onCheckInAs ? () => onCheckInAs(p.id) : undefined}
          />
        ))}
      </div>
    </aside>
  );
}
