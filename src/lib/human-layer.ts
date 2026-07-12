// Human Layer types + helpers (v2.P1).
// Compact per-session profile used by mediator + Team Desk.

export type FeedbackStyle = "direct" | "gentle" | "ask-first" | "written-only";
export type ContributionMode = "voice" | "chat" | "whiteboard" | "async";

export type HumanLayer = {
  role_today: string;
  strengths: string[];
  contribution_modes: ContributionMode[];
  feedback_style: FeedbackStyle | "";
  blockers: string;
  needs_today: string;
  can_help_with: string;
  share_blockers: boolean;
  share_needs: boolean;
  human_layer_complete: boolean;
};

export const EMPTY_HUMAN_LAYER: HumanLayer = {
  role_today: "",
  strengths: [],
  contribution_modes: [],
  feedback_style: "",
  blockers: "",
  needs_today: "",
  can_help_with: "",
  share_blockers: false,
  share_needs: false,
  human_layer_complete: false,
};

export const FEEDBACK_STYLES: { value: FeedbackStyle; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "gentle", label: "Gentle" },
  { value: "ask-first", label: "Ask first" },
  { value: "written-only", label: "Written only" },
];

export const CONTRIBUTION_MODES: { value: ContributionMode; label: string }[] = [
  { value: "voice", label: "Voice" },
  { value: "chat", label: "Chat" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "async", label: "Async notes" },
];

const clip = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};

// Compact one-liner per person for the mediator system prompt.
// Respects per-field share flags: blockers/needs are only exposed when opted in.
export function formatParticipantForPrompt(p: {
  name: string;
  role_today?: string | null;
  role?: string | null;
  strengths?: string[] | null;
  feedback_style?: string | null;
  contribution_modes?: string[] | null;
  needs_today?: string | null;
  blockers?: string | null;
  can_help_with?: string | null;
  share_blockers?: boolean | null;
  share_needs?: boolean | null;
}): string {
  const role = clip(p.role_today || p.role || "", 40);
  const strengths = (p.strengths ?? []).slice(0, 2).map((s) => clip(s, 22)).filter(Boolean).join(", ");
  const style = p.feedback_style ? `${p.feedback_style} feedback` : "";
  const modes = (p.contribution_modes ?? []).filter(Boolean).join("/");
  const need = p.share_needs && p.needs_today ? `need: ${clip(p.needs_today, 40)}` : "";
  const block = p.share_blockers && p.blockers ? `worry: ${clip(p.blockers, 40)}` : "";
  const help = p.can_help_with ? `help: ${clip(p.can_help_with, 30)}` : "";
  const parts = [role, strengths && `strong: ${strengths}`, style, modes && `prefers ${modes}`, need, block, help]
    .filter(Boolean)
    .join(" · ");
  return `- ${p.name}${parts ? ` (${parts})` : ""}`;
}
