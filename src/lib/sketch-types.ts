export type SketchPrimitive =
  | { type: "rect"; id: string; x: number; y: number; w: number; h: number; label?: string; fill?: string }
  | { type: "ellipse"; id: string; x: number; y: number; w: number; h: number; label?: string; fill?: string }
  | { type: "diamond"; id: string; x: number; y: number; w: number; h: number; label?: string; fill?: string }
  | { type: "arrow"; id: string; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: "line"; id: string; x1: number; y1: number; x2: number; y2: number }
  | { type: "text"; id: string; x: number; y: number; text: string; size?: number; weight?: "regular" | "bold" }
  | { type: "stroke"; id: string; points: Array<[number, number]>; color?: string };

export type FreehandStroke = { id: string; points: Array<[number, number, number]>; color: string };
