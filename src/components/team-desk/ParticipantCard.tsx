import { useState } from "react";
import { ChevronRight, Lock, AlertCircle, Clock, MessageCircle, UserCheck } from "lucide-react";
import { ModeDot } from "./ModeDot";
import type { ParticipantMode } from "./use-participant-state";
import type { InferredState } from "./use-inferred-state";
import type { ParticipantWithHumanLayer } from "@/lib/canvas-types";

/**
 * ParticipantCard — right-rail card per person.
 * Collapsed: mode dot + name + role + one-line context.
 * Expanded (click): profile fields, respecting per-field share flags.
 */
export function ParticipantCard({
  p,
  mode,
  inferred,
  isSelf,
  onCheckInAs,
}: {
  p: ParticipantWithHumanLayer;
  mode: ParticipantMode;
  inferred?: InferredState;
  isSelf: boolean;
  onCheckInAs?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const role = p.role_today || p.role || "";
  const context = pickContext(p, mode);
  const focusChip = pickFocusChip(inferred);

  return (
    <div className="border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition hover:bg-muted/40"
      >
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-border font-medium uppercase text-background" style={{ backgroundColor: p.color, fontSize: "var(--step-0)" }}>
          {p.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <ModeDot mode={mode} color={p.color} />
            <span className="truncate font-medium text-foreground" style={{ fontSize: "var(--step-1)" }}>
              {p.name}
              {isSelf && <span className="ml-1 text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>· you</span>}
            </span>
          </div>
          {role && (
            <p className="eyebrow mt-0.5 truncate text-muted-foreground">{role}</p>
          )}
          {context && (
            <p className="mt-1 line-clamp-2 text-foreground/70" style={{ fontSize: "var(--step-0)" }}>{context}</p>
          )}
          {focusChip && (
            <div className={`mt-1 inline-flex items-center gap-1 border px-1.5 py-0.5 ${focusChip.tone}`} style={{ fontSize: "var(--step-0)" }} title={inferred?.unresolved_point ?? undefined}>
              {focusChip.icon}
              <span className="truncate">{focusChip.label}</span>
            </div>
          )}
        </div>
        <ChevronRight
          className={`mt-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 px-2.5 py-2.5 space-y-2">
          {p.strengths && p.strengths.length > 0 && (
            <Field label="Strong">
              <div className="flex flex-wrap gap-1">
                {p.strengths.map((s: string) => (
                  <span key={s} className="border border-border px-1.5 py-0.5" style={{ fontSize: "var(--step-0)" }}>{s}</span>
                ))}
              </div>
            </Field>
          )}
          {p.feedback_style && <Field label="Feedback"><span className="text-foreground" style={{ fontSize: "var(--step-0)" }}>{p.feedback_style}</span></Field>}
          {p.contribution_modes && p.contribution_modes.length > 0 && (
            <Field label="Prefers">
              <span className="text-foreground" style={{ fontSize: "var(--step-0)" }}>{p.contribution_modes.join(" · ")}</span>
            </Field>
          )}
          {p.can_help_with && <Field label="Can help"><span className="text-foreground" style={{ fontSize: "var(--step-0)" }}>{p.can_help_with}</span></Field>}
          {p.needs_today && (p.share_needs || isSelf) && (
            <Field label="Needs today"><span className="text-foreground" style={{ fontSize: "var(--step-0)" }}>{p.needs_today}</span></Field>
          )}
          {p.needs_today && !p.share_needs && !isSelf && (
            <Field label="Needs today"><PrivateSlot /></Field>
          )}
          {p.blockers && (p.share_blockers || isSelf) && (
            <Field label="Blocker"><span className="text-foreground" style={{ fontSize: "var(--step-0)" }}>{p.blockers}</span></Field>
          )}
          {p.blockers && !p.share_blockers && !isSelf && (
            <Field label="Blocker"><PrivateSlot /></Field>
          )}
          {!hasAnyHumanLayer(p) && (
            <p className="italic text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
              No check-in yet.
            </p>
          )}
          {onCheckInAs && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCheckInAs(); }}
              className="mt-1 flex w-full items-center justify-center gap-1 border border-border px-2 py-1 text-foreground transition hover:bg-foreground hover:text-background"
              style={{ fontSize: "var(--step-0)" }}
              title="Fill this person's check-in on this device"
            >
              <UserCheck className="h-3 w-3" />
              <span className="eyebrow">{isSelf ? "Edit my check-in" : `I'm ${p.name} — check in`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function PrivateSlot() {
  return (
    <span className="inline-flex items-center gap-1 italic text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
      <Lock className="h-3 w-3" /> private to mediator
    </span>
  );
}

function hasAnyHumanLayer(p: ParticipantWithHumanLayer): boolean {
  return !!(
    p.role_today || (p.strengths && p.strengths.length) || p.feedback_style ||
    (p.contribution_modes && p.contribution_modes.length) ||
    p.blockers || p.needs_today || p.can_help_with
  );
}

function pickContext(p: ParticipantWithHumanLayer, mode: ParticipantMode): string {
  if (mode === "speaking") return "speaking now";
  if (mode === "sketching") return "sketching";
  if (mode === "typing") return "typing";
  if (p.share_needs && p.needs_today) return `wants: ${p.needs_today}`;
  if (p.can_help_with) return `can help: ${p.can_help_with}`;
  return "";
}

function pickFocusChip(inferred?: InferredState): { label: string; icon: React.ReactNode; tone: string } | null {
  if (!inferred) return null;
  switch (inferred.focus) {
    case "unresolved-thread":
      return {
        label: inferred.unresolved_point ? `unresolved: "${inferred.unresolved_point.slice(0, 60)}${inferred.unresolved_point.length > 60 ? "…" : ""}"` : "unresolved ask",
        icon: <AlertCircle className="h-3 w-3" />,
        tone: "border-[color:var(--accent)] text-[color:var(--accent)]",
      };
    case "quiet-too-long":
      return { label: "quiet a while", icon: <Clock className="h-3 w-3" />, tone: "border-border text-muted-foreground" };
    case "repeated-ask":
      return { label: "carrying the thread", icon: <MessageCircle className="h-3 w-3" />, tone: "border-border text-muted-foreground" };
    default:
      return null;
  }
}
