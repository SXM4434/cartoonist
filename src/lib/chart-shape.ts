import type { SketchPrimitive } from "./sketch-types";

/**
 * v1 P2.5 — visualization variety.
 * The renderer emits a compact chart SPEC instead of dozens of hand-placed
 * coordinates; we lay it out deterministically so axes stay square, labels
 * never collide, and a "2x2 cost vs power" ask becomes a real quadrant chart.
 */
export type ChartSpec = {
  kind: "quadrant" | "bar";
  title?: string;
  xLabel?: string;
  yLabel?: string;
  xLow?: string;
  xHigh?: string;
  yLow?: string;
  yHigh?: string;
  /** quadrant: x/y are 0..1 (0 = low/left/bottom). bar: value is 0..1. */
  items?: Array<{ label: string; x?: number; y?: number; value?: number; tone?: SketchPrimitive["tone"] }>;
};

const clamp01 = (v: unknown) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

export function isChartSpec(value: unknown): value is ChartSpec {
  if (!value || typeof value !== "object") return false;
  const kind = (value as ChartSpec).kind;
  return kind === "quadrant" || kind === "bar";
}

export function buildChart(spec: ChartSpec, originX = 80, originY = 80): SketchPrimitive[] {
  const s: SketchPrimitive[] = [];
  const uid = Math.random().toString(36).slice(2, 7);
  let n = 0;
  const id = (p: string) => `${p}_${uid}_${n++}`;
  const text = (x: number, y: number, value: string, size = 13, tone: SketchPrimitive["tone"] = "ink") =>
    s.push({ type: "text", id: id("t"), x, y, text: value.slice(0, 40), size, tone });
  const line = (x1: number, y1: number, x2: number, y2: number, tone: SketchPrimitive["tone"] = "muted", dashed = false) =>
    s.push({ type: "line", id: id("l"), x1, y1, x2, y2, tone, dashed });

  const W = 560;
  const H = 440;
  const pad = 56;
  const plotX = originX + pad;
  const plotY = originY + 56;
  const plotW = W - pad - 24;
  const plotH = H - 56 - pad;

  if (spec.title) text(originX, originY + 8, spec.title, 22);

  if (spec.kind === "bar") {
    const items = (spec.items ?? []).slice(0, 8);
    line(plotX, plotY, plotX, plotY + plotH);
    line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
    if (spec.yLabel) text(originX, plotY - 22, spec.yLabel, 11, "muted");
    const slot = items.length ? plotW / items.length : plotW;
    const barW = Math.max(24, Math.min(72, slot - 20));
    items.forEach((item, i) => {
      const v = clamp01(item.value ?? item.y ?? 0.5);
      const h = Math.max(6, v * (plotH - 16));
      const x = plotX + i * slot + (slot - barW) / 2;
      const y = plotY + plotH - h;
      s.push({ type: "rect", id: id("r"), x, y, w: barW, h, tone: item.tone ?? "accent", fill: "solid" });
      text(x, y - 20, `${Math.round(v * 100)}`, 11, "muted");
      text(x, plotY + plotH + 12, item.label, 11);
    });
    if (spec.xLabel) text(plotX, plotY + plotH + 36, spec.xLabel, 11, "muted");
    return s;
  }

  // quadrant
  line(plotX, plotY, plotX, plotY + plotH);
  line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
  line(plotX + plotW / 2, plotY, plotX + plotW / 2, plotY + plotH, "muted", true);
  line(plotX, plotY + plotH / 2, plotX + plotW, plotY + plotH / 2, "muted", true);

  if (spec.yHigh) text(originX - 8, plotY - 20, spec.yHigh, 11, "muted");
  if (spec.yLow) text(originX - 8, plotY + plotH + 6, spec.yLow, 11, "muted");
  if (spec.xLow) text(plotX, plotY + plotH + 26, spec.xLow, 11, "muted");
  if (spec.xHigh) text(plotX + plotW - 90, plotY + plotH + 26, spec.xHigh, 11, "muted");
  if (spec.xLabel) text(plotX + plotW / 2 - 40, plotY + plotH + 48, spec.xLabel, 13);
  if (spec.yLabel) text(originX - 8, plotY + plotH / 2, spec.yLabel, 13);

  const placed: Array<[number, number]> = [];
  (spec.items ?? []).slice(0, 10).forEach((item) => {
    const fx = clamp01(item.x);
    const fy = clamp01(item.y);
    let px = plotX + fx * plotW;
    let py = plotY + (1 - fy) * plotH;
    // nudge apart so labels never stack
    let guard = 0;
    while (placed.some(([ax, ay]) => Math.abs(ax - px) < 60 && Math.abs(ay - py) < 24) && guard++ < 8) {
      py += 26;
    }
    px = Math.min(plotX + plotW - 16, Math.max(plotX + 8, px));
    py = Math.min(plotY + plotH - 12, Math.max(plotY + 8, py));
    placed.push([px, py]);
    s.push({ type: "rect", id: id("r"), x: px - 6, y: py - 6, w: 12, h: 12, tone: item.tone ?? "accent", fill: "solid" });
    text(px + 12, py - 7, item.label, 13);
  });

  return s;
}
