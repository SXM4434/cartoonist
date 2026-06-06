export type IconKind =
  | "user"
  | "users"
  | "phone"
  | "laptop"
  | "server"
  | "database"
  | "cloud"
  | "gear"
  | "lightbulb"
  | "lightning"
  | "lock"
  | "key"
  | "star"
  | "heart"
  | "check"
  | "cross"
  | "warning"
  | "envelope"
  | "doc"
  | "folder"
  | "chat"
  | "search"
  | "eye"
  | "calendar"
  | "clock"
  | "money"
  | "chart"
  | "sun"
  | "moon"
  | "tree"
  | "house";

export type SketchPrimitive =
  | { type: "rect"; id: string; x: number; y: number; w: number; h: number; label?: string; fill?: string }
  | { type: "ellipse"; id: string; x: number; y: number; w: number; h: number; label?: string; fill?: string }
  | { type: "diamond"; id: string; x: number; y: number; w: number; h: number; label?: string; fill?: string }
  | { type: "arrow"; id: string; x1: number; y1: number; x2: number; y2: number; label?: string; dashed?: boolean }
  | { type: "line"; id: string; x1: number; y1: number; x2: number; y2: number; dashed?: boolean }
  | { type: "text"; id: string; x: number; y: number; text: string; size?: number; weight?: "regular" | "bold"; italic?: boolean; align?: "left" | "center" | "right" }
  | { type: "note"; id: string; x: number; y: number; w?: number; h?: number; text: string; color?: "yellow" | "pink" | "blue" | "green" }
  | { type: "path"; id: string; points: Array<[number, number]>; closed?: boolean; fill?: string; color?: string }
  | { type: "icon"; id: string; kind: IconKind; x: number; y: number; size?: number; label?: string }
  | { type: "stroke"; id: string; points: Array<[number, number]>; color?: string };

export type FreehandStroke = { id: string; points: Array<[number, number, number]>; color: string };
