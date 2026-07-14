// v2.P3 — Per-user agents seeded from Human Layer.
// Projects each participant into three tenses: past (what they bring), present
// (live state right now), future (what they still need). Cheap client-side
// projection — no LLM. Consumed by the mediator (cartoonist-draw) and drafter
// (generate-artifacts) so decisions and interjections can attribute back to
// stated strengths, worries, and needs.

import type { ParticipantWithHumanLayer } from "@/lib/canvas-types";
import type { InferredState, FocusLabel } from "@/components/team-desk/use-inferred-state";

export type UserAgent = {
  pid: string;
  name: string;
  role?: string | null;
  past: {
    role_today?: string | null;
    strengths?: string[] | null;
    feedback_style?: string | null;
    can_help_with?: string | null;
  };
  present: {
    // Only labels — never leaks quoted text unless already shared.
    focus: FocusLabel;
    detail?: string;
  };
  future: {
    needs_today?: string | null; // omitted if not shared
    blockers?: string | null;    // omitted if not shared
  };
};

export function buildUserAgents(
  participants: ParticipantWithHumanLayer[],
  inferred: Record<string, InferredState>,
): UserAgent[] {
  return participants.map((p) => {
    const state = inferred[p.id];
    const focus = (state?.kind ?? "idle") as UserAgent["present"]["focus"];
    return {
      pid: p.id,
      name: p.name,
      role: p.role,
      past: {
        role_today: p.role_today ?? null,
        strengths: p.strengths ?? null,
        feedback_style: p.feedback_style ?? null,
        can_help_with: p.can_help_with ?? null,
      },
      present: {
        focus,
        detail: state?.detail,
      },
      future: {
        needs_today: p.share_needs ? (p.needs_today ?? null) : null,
        blockers: p.share_blockers ? (p.blockers ?? null) : null,
      },
    };
  });
}

/** Compact markdown block for prompts. Skips empty agents. */
export function userAgentsPromptBlock(agents: UserAgent[]): string {
  const lines: string[] = [];
  for (const a of agents) {
    const past: string[] = [];
    if (a.past.role_today) past.push(`role today: ${a.past.role_today}`);
    if (a.past.strengths?.length) past.push(`strong at: ${a.past.strengths.join(", ")}`);
    if (a.past.feedback_style) past.push(`feedback style: ${a.past.feedback_style}`);
    if (a.past.can_help_with) past.push(`can help with: ${a.past.can_help_with}`);

    const future: string[] = [];
    if (a.future.needs_today) future.push(`needs: ${a.future.needs_today}`);
    if (a.future.blockers) future.push(`worry: ${a.future.blockers}`);

    if (past.length === 0 && future.length === 0 && a.present.focus === "idle") continue;

    lines.push(`- **${a.name}**`);
    if (past.length) lines.push(`  - past: ${past.join(" · ")}`);
    lines.push(`  - present: ${a.present.focus}${a.present.detail ? ` (${a.present.detail})` : ""}`);
    if (future.length) lines.push(`  - future: ${future.join(" · ")}`);
  }
  return lines.join("\n");
}
