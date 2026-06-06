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