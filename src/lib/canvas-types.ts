export type CardType =
  | "sticky"
  | "flowStep"
  | "journeyStep"
  | "decision"
  | "actionItem"
  | "participant"
  | "section";

export type Card = {
  id: string;
  type: CardType;
  text: string;
  author?: string;
  category?: string;
  owner?: string | null;
  persona?: string;
  kind?: string;
  x: number;
  y: number;
  color?: string;
  createdAtMs: number;
};

export type Connection = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type Participant = {
  id: string;
  name: string;
  role?: string;
  color: string;
};

// v2.P1 — full row shape for Team Desk cards + mediator context.
export type ParticipantWithHumanLayer = Participant & {
  role_today?: string | null;
  strengths?: string[] | null;
  contribution_modes?: string[] | null;
  feedback_style?: string | null;
  blockers?: string | null;
  needs_today?: string | null;
  can_help_with?: string | null;
  share_blockers?: boolean | null;
  share_needs?: boolean | null;
  human_layer_complete?: boolean | null;
};