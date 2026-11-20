import type { SketchPrimitive } from "./sketch-types";
import { fitText, textHeight } from "./text-fit";

/**
 * Diagrams (outlines, flows, trees, cycles, comparisons) are planned by the AI
 * as content only. This module owns every coordinate so boxes never overlap,
 * labels always fit, and arrows always meet box edges.
 */
export type DiagramKind = "outline" | "flow" | "hierarchy" | "cycle" | "compare" | "decision";
export type DiagramNode = { id: string; label: string; detail: string[]; emphasis?: boolean };
export type DiagramPlan = {
  kind: DiagramKind;
  title: string;
  subtitle?: string;
  nodes: DiagramNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
};

export const DIAGRAM_W = 1100;
const GUTTER = 24;
const PAD = 16;
const HEAD = 15;
const BODY = 13;
const KINDS: DiagramKind[] = ["outline", "flow", "hierarchy", "cycle", "compare", "decision"];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseDiagramPlan(value: unknown): DiagramPlan | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const kind = KINDS.find((k) => k === v.kind) ?? "outline";
  const rawNodes = Array.isArray(v.nodes) ? v.nodes : [];
  const seen = new Set<string>();
  const nodes: DiagramNode[] = [];
  rawNodes.slice(0, 10).forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const n = raw as Record<string, unknown>;
    const label = str(n.label, 60);
    if (!label) return;
    let id = str(n.id, 40) || `n${i}`;
    if (seen.has(id)) id = `${id}_${i}`;
    seen.add(id);
    const detail = (Array.isArray(n.detail) ? n.detail : []).map((d) => str(d, 90)).filter(Boolean).slice(0, 4);
    nodes.push({ id, label, detail, emphasis: n.emphasis === true });
  });
  if (!nodes.length) return null;
  const edges = (Array.isArray(v.edges) ? v.edges : []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const e = raw as Record<string, unknown>;
    const from = str(e.from, 40), to = str(e.to, 40);
    if (!seen.has(from) || !seen.has(to) || from === to) return [];
    return [{ from, to, label: str(e.label, 24) || undefined }];
  }).slice(0, 16);
  return { kind, title: str(v.title, 90) || nodes[0].label, subtitle: str(v.subtitle, 140) || undefined, nodes, edges };
}

type Card = { node: DiagramNode; x: number; y: number; w: number; h: number };

function cardHeight(node: DiagramNode, w: number, maxDetail = 4): number {
  const inner = w - PAD * 2;
  let h = PAD + textHeight(fitText(node.label, inner, HEAD, 3), inner, HEAD);
  const details = node.detail.slice(0, maxDetail);
  if (details.length) h += 10;
  for (const d of details) h += textHeight(`• ${fitText(d, inner - 12, BODY, 3)}`, inner, BODY) + 6;
  return h + PAD;
}

/** Point on a card's border along the line toward (tx, ty), pushed out by `gap`. */
function edgePoint(c: Card, tx: number, ty: number, gap = 8): [number, number] {
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min(dx ? (c.w / 2) / Math.abs(dx) : Infinity, dy ? (c.h / 2) / Math.abs(dy) : Infinity);
  const len = Math.hypot(dx, dy);
  return [cx + dx * t + (dx / len) * gap, cy + dy * t + (dy / len) * gap];
}

/** Follow edges from the start node so steps read in order; fall back to given order. */
function flowOrder(plan: DiagramPlan): DiagramNode[] {
  if (!plan.edges.length) return plan.nodes;
  const incoming = new Set(plan.edges.map((e) => e.to));
  const start = plan.nodes.find((x) => !incoming.has(x.id)) ?? plan.nodes[0];
  const order: DiagramNode[] = [];
  const seen = new Set<string>();
  let cur: DiagramNode | undefined = start;
  while (cur && !seen.has(cur.id)) {
    order.push(cur);
    seen.add(cur.id);
    const next = plan.edges.find((e) => e.from === cur!.id && !seen.has(e.to));
    cur = next ? plan.nodes.find((x) => x.id === next.to) : undefined;
  }
  return [...order, ...plan.nodes.filter((x) => !seen.has(x.id))];
}

export function buildDiagram(plan: DiagramPlan, prefix = "dg"): SketchPrimitive[] {
  const out: SketchPrimitive[] = [];
  let seq = 0;
  const id = (k: string) => `${prefix}_${k}${seq++}`;
  const text = (x: number, y: number, w: number, value: string, size: number, tone: SketchPrimitive["tone"] = "ink") =>
    out.push({ type: "text", id: id("t"), x, y, w, text: value, size, style: "ui", tone });

  text(0, 0, DIAGRAM_W, fitText(plan.title, DIAGRAM_W, 22, 2), 22);
  let top = textHeight(fitText(plan.title, DIAGRAM_W, 22, 2), DIAGRAM_W, 22) + 8;
  if (plan.subtitle) {
    const sub = fitText(plan.subtitle, 760, BODY, 2);
    text(0, top, 760, sub, BODY, "muted");
    top += textHeight(sub, 760, BODY);
  }
  top += 28;

  const drawCard = (c: Card, maxDetail = 4) => {
    const accent = c.node.emphasis;
    out.push({ type: "rect", id: id("r"), x: c.x, y: c.y, w: c.w, h: c.h, style: "ui", tone: accent ? "accent" : "surface", fill: "solid" });
    const inner = c.w - PAD * 2;
    const label = fitText(c.node.label, inner, HEAD, 3);
    text(c.x + PAD, c.y + PAD, inner, label, HEAD);
    let y = c.y + PAD + textHeight(label, inner, HEAD);
    const details = c.node.detail.slice(0, maxDetail);
    if (details.length) y += 10;
    for (const d of details) {
      const line = `• ${fitText(d, inner - 12, BODY, 3)}`;
      text(c.x + PAD, y, inner, line, BODY, "muted");
      y += textHeight(line, inner, BODY) + 6;
    }
  };
  const arrow = (a: Card, b: Card, label?: string) => {
    const [x1, y1] = edgePoint(a, b.x + b.w / 2, b.y + b.h / 2);
    const [x2, y2] = edgePoint(b, a.x + a.w / 2, a.y + a.h / 2);
    out.push({ type: "arrow", id: id("a"), x1, y1, x2, y2, label, style: "ui", tone: "ink" });
  };

  /** Uniform-height rows of cards, left-aligned to the title. */
  const grid = (nodes: DiagramNode[], y0: number, cols: number, w = (DIAGRAM_W - GUTTER * (cols - 1)) / cols): Card[] => {
    const cards: Card[] = [];
    let y = y0;
    for (let r = 0; r * cols < nodes.length; r++) {
      const row = nodes.slice(r * cols, r * cols + cols);
      const h = Math.max(...row.map((n) => cardHeight(n, w)));
      row.forEach((node, i) => cards.push({ node, x: i * (w + GUTTER), y, w, h }));
      y += h + GUTTER;
    }
    return cards;
  };
  const byId = (cards: Card[]) => new Map(cards.map((c) => [c.node.id, c]));
  const n = plan.nodes.length;

  if (plan.kind === "flow") {
    plan = { ...plan, nodes: flowOrder(plan) };
    if (n <= 5) {
      const gap = 56;
      const w = Math.min(260, (DIAGRAM_W - gap * (n - 1)) / n);
      const h = Math.max(...plan.nodes.map((node) => cardHeight(node, w)));
      const cards = plan.nodes.map((node, i) => ({ node, x: i * (w + gap), y: top, w, h }));
      cards.forEach((c) => drawCard(c));
      // No arrow labels here: the gutter is too narrow and labels wrapped into stacks.
      cards.slice(1).forEach((c, i) => arrow(cards[i], c));
    } else {
      const w = 640;
      let y = top;
      const cards = plan.nodes.map((node) => { const h = cardHeight(node, w); const c = { node, x: 0, y, w, h }; y += h + 64; return c; });
      cards.forEach((c) => drawCard(c));
      cards.slice(1).forEach((c, i) => arrow(cards[i], c));
    }
    return out;
  }

  if (plan.kind === "hierarchy" || plan.kind === "decision") {
    const incoming = new Set(plan.edges.map((e) => e.to));
    const root = plan.nodes.find((x) => !incoming.has(x.id) && plan.edges.some((e) => e.from === x.id)) ?? plan.nodes[0];
    const childIds = plan.edges.filter((e) => e.from === root.id).map((e) => e.to);
    const children = childIds.length ? plan.nodes.filter((x) => childIds.includes(x.id)) : plan.nodes.filter((x) => x !== root);
    const kidsOf = (c: DiagramNode) => plan.edges.filter((e) => e.from === c.id).map((e) => plan.nodes.find((x) => x.id === e.to)).filter((x): x is DiagramNode => !!x && x.id !== root.id);
    // Org charts with up to four branches draw a real third level: each
    // branch's reports hang beneath it on an indented spine. Otherwise
    // grandchildren fold into their parent's bullets so the tree stays legible.
    const thirdLevel = plan.kind === "hierarchy" && children.length <= 4 && children.some((c) => kidsOf(c).length > 0);
    const folded = thirdLevel ? children : children.map((c) => {
      const kids = kidsOf(c).map((k) => k.label);
      return { ...c, detail: [...c.detail, ...kids].slice(0, 4) };
    });
    const rootW = 360;
    const rootCard: Card = { node: { ...root, emphasis: true }, x: 0, y: top, w: rootW, h: cardHeight(root, rootW, 2) };
    drawCard(rootCard, 2);
    if (!folded.length) return out;
    const cols = Math.min(4, folded.length);
    const cards = grid(folded, rootCard.y + rootCard.h + 72, cols);
    const busY = rootCard.y + rootCard.h + 36;
    const firstRow = cards.filter((c) => c.y === cards[0].y);
    const rootX = rootCard.x + rootCard.w / 2;
    const centers = firstRow.map((c) => c.x + c.w / 2);
    out.push({ type: "line", id: id("l"), x1: rootX, y1: rootCard.y + rootCard.h, x2: rootX, y2: busY, style: "ui", tone: "ink" });
    out.push({ type: "line", id: id("l"), x1: Math.min(rootX, ...centers), y1: busY, x2: Math.max(rootX, ...centers), y2: busY, style: "ui", tone: "ink" });
    firstRow.forEach((c) => {
      const cx = c.x + c.w / 2;
      const label = plan.edges.find((e) => e.from === root.id && e.to === c.node.id)?.label;
      out.push({ type: "arrow", id: id("a"), x1: cx, y1: busY, x2: cx, y2: c.y - 6, style: "ui", tone: "ink" });
      if (label) text(cx + 8, busY + 6, c.w / 2 - 12, fitText(label, c.w / 2 - 12, 11, 1), 11, "muted");
    });
    cards.forEach((c) => drawCard(c));
    if (thirdLevel) {
      cards.forEach((c) => {
        const kids = kidsOf(c.node).slice(0, 4);
        if (!kids.length) return;
        const spineX = c.x + 24;
        const kx = c.x + 48, kw = c.w - 48;
        let y = c.y + c.h + 24;
        let lastMid = y;
        kids.forEach((k) => {
          const node = { ...k, detail: k.detail.slice(0, 1), emphasis: false };
          const kc: Card = { node, x: kx, y, w: kw, h: cardHeight(node, kw, 1) };
          drawCard(kc, 1);
          lastMid = y + kc.h / 2;
          out.push({ type: "line", id: id("l"), x1: spineX, y1: lastMid, x2: kx, y2: lastMid, style: "ui", tone: "ink" });
          y += kc.h + 16;
        });
        out.push({ type: "line", id: id("l"), x1: spineX, y1: c.y + c.h, x2: spineX, y2: lastMid, style: "ui", tone: "ink" });
      });
    }
    return out;
  }

  if (plan.kind === "cycle" && n >= 3) {
    const nodes = plan.nodes.slice(0, 6);
    const w = 240;
    const h = Math.max(...nodes.map((node) => cardHeight(node, w, 2)));
    const rx = (DIAGRAM_W - w) / 2 - 20, ry = Math.max(170, h + 60);
    const cx = DIAGRAM_W / 2, cy = top + ry + h / 2;
    const cards = nodes.map((node, i) => {
      const a = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      return { node, x: Math.round(cx + Math.cos(a) * rx - w / 2), y: Math.round(cy + Math.sin(a) * ry - h / 2), w, h };
    });
    cards.forEach((c) => drawCard(c, 2));
    cards.forEach((c, i) => arrow(c, cards[(i + 1) % cards.length]));
    return out;
  }

  // outline / compare (and tiny cycles): aligned card grid.
  const cols = n <= 4 ? n : n === 5 || n === 6 || n === 9 ? 3 : 4;
  const cards = grid(plan.nodes, top, cols);
  cards.forEach((c) => drawCard(c));
  const map = byId(cards);
  if (plan.kind === "outline") {
    // Only draw edges between horizontal neighbours — anything else would cross cards.
    for (const e of plan.edges) {
      const a = map.get(e.from), b = map.get(e.to);
      if (a && b && a.y === b.y && Math.abs(a.x - b.x) <= a.w + GUTTER + 1) arrow(a, b, e.label);
    }
  }
  return out;
}

/** Salvage a model that hand-placed boxes anyway: keep its words, drop its geometry. */
export function planFromShapes(shapes: unknown[], fallbackTitle: string): DiagramPlan | null {
  type Box = { id: string; label: string; detail: string[]; x: number; y: number; w: number; h: number };
  const boxes: Box[] = [];
  let title = "";
  for (const raw of shapes) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const x = Number(s.x) || 0, y = Number(s.y) || 0;
    const body = str(s.label, 400) || (typeof s.text === "string" ? s.text.trim() : "");
    if (!body) continue;
    if (s.type === "text" && Number(s.size) >= 20 && !title) { title = body.split("\n")[0]; continue; }
    if (["rect", "ellipse", "diamond", "note", "text"].includes(String(s.type))) {
      const lines = body.split(/\n|•/).map((l) => l.replace(/^[\s\-–*]+/, "").trim()).filter(Boolean);
      boxes.push({ id: String(s.id ?? `b${boxes.length}`), label: lines[0], detail: lines.slice(1), x, y, w: Number(s.w) || 160, h: Number(s.h) || 60 });
    }
  }
  if (!boxes.length) return null;
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);
  const nearest = (px: number, py: number) => boxes.reduce((best, b) => {
    const d = Math.hypot(b.x + b.w / 2 - px, b.y + b.h / 2 - py);
    return d < best.d ? { b, d } : best;
  }, { b: boxes[0], d: Infinity }).b;
  const edges = shapes.flatMap((raw) => {
    const s = raw as Record<string, unknown> | null;
    if (!s || s.type !== "arrow") return [];
    const a = nearest(Number(s.x1), Number(s.y1)), b = nearest(Number(s.x2), Number(s.y2));
    return a === b ? [] : [{ from: a.id, to: b.id, label: str(s.label, 24) || undefined }];
  });
  return parseDiagramPlan({
    kind: edges.length >= boxes.length - 1 && boxes.length > 1 ? "flow" : "outline",
    title: title || fallbackTitle,
    nodes: boxes.map((b) => ({ id: b.id, label: b.label, detail: b.detail })),
    edges,
  });
}
