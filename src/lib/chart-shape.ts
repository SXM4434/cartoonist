import type { SketchPrimitive } from "./sketch-types";

/**
 * v1 P2.5 — visualization variety, maxed.
 * The renderer emits a compact chart SPEC instead of dozens of hand-placed
 * coordinates; we lay it out deterministically so axes stay square, labels
 * never collide, and a "2x2 cost vs power" ask becomes a real quadrant chart.
 */
export type ChartKind =
  | "quadrant"
  | "bar"
  | "hbar"
  | "stacked"
  | "line"
  | "area"
  | "scatter"
  | "bubble"
  | "pie"
  | "donut"
  | "funnel"
  | "pyramid"
  | "timeline"
  | "gantt"
  | "heatmap"
  | "radar"
  | "venn"
  | "waterfall"
  | "gauge"
  | "matrix";

export type ChartItem = {
  label: string;
  /** quadrant/scatter/bubble: 0..1 */
  x?: number;
  y?: number;
  /** bar/hbar/pie/funnel/line/gauge: 0..1 */
  value?: number;
  /** bubble radius, 0..1 */
  size?: number;
  /** stacked / grouped / radar / heatmap rows: 0..1 each */
  values?: number[];
  /** gantt / timeline: 0..1 along the axis */
  start?: number;
  end?: number;
  /** venn / matrix / annotation text */
  note?: string;
  tone?: SketchPrimitive["tone"];
};

export type ChartSpec = {
  kind: ChartKind;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  xLow?: string;
  xHigh?: string;
  yLow?: string;
  yHigh?: string;
  /** column/series names for stacked, heatmap, radar, matrix */
  series?: string[];
  /** matrix row headers when items are not used */
  rows?: string[];
  unit?: string;
  items?: ChartItem[];
};

const KINDS: ChartKind[] = [
  "quadrant","bar","hbar","stacked","line","area","scatter","bubble","pie","donut",
  "funnel","pyramid","timeline","gantt","heatmap","radar","venn","waterfall","gauge","matrix",
];

const clamp01 = (v: unknown) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

export function isChartSpec(value: unknown): value is ChartSpec {
  if (!value || typeof value !== "object") return false;
  return KINDS.includes((value as ChartSpec).kind);
}

const TONES: SketchPrimitive["tone"][] = ["accent", "ink", "success", "danger", "muted", "subtle"];

export function buildChart(spec: ChartSpec, originX = 80, originY = 80): SketchPrimitive[] {
  const s: SketchPrimitive[] = [];
  const uid = Math.random().toString(36).slice(2, 7);
  let n = 0;
  const id = (p: string) => `${p}_${uid}_${n++}`;
  const text = (x: number, y: number, value: string, size = 13, tone: SketchPrimitive["tone"] = "ink") =>
    s.push({ type: "text", id: id("t"), x, y, text: String(value).slice(0, 44), size, tone });
  const line = (x1: number, y1: number, x2: number, y2: number, tone: SketchPrimitive["tone"] = "muted", dashed = false) =>
    s.push({ type: "line", id: id("l"), x1, y1, x2, y2, tone, dashed });
  const rect = (x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "accent", fill: "solid" | "none" = "solid") =>
    s.push({ type: "rect", id: id("r"), x, y, w: Math.max(2, w), h: Math.max(2, h), tone, fill } as SketchPrimitive);
  const ellipse = (x: number, y: number, w: number, h: number, tone: SketchPrimitive["tone"] = "accent", fill: "solid" | "none" = "none") =>
    s.push({ type: "ellipse", id: id("e"), x, y, w, h, tone, fill } as SketchPrimitive);
  const path = (points: Array<[number, number]>, tone: SketchPrimitive["tone"] = "accent", closed = false, fill: "solid" | "none" = "none") =>
    s.push({ type: "path", id: id("p"), points, closed, tone, fill } as SketchPrimitive);

  const W = 560;
  const H = 440;
  const pad = 56;
  const plotX = originX + pad;
  const plotY = originY + 56;
  const plotW = W - pad - 24;
  const plotH = H - 56 - pad;
  const items = (spec.items ?? []).filter(Boolean);
  const toneAt = (i: number, item?: ChartItem) => item?.tone ?? TONES[i % TONES.length];
  const pct = (v: number) => `${Math.round(v * 100)}${spec.unit ? ` ${spec.unit}` : ""}`;

  if (spec.title) text(originX, originY + 8, spec.title, 22);
  const legend = (names: string[], x: number, y: number) => {
    names.slice(0, 6).forEach((name, i) => {
      const lx = x + i * 110;
      rect(lx, y, 10, 10, TONES[i % TONES.length], "solid");
      text(lx + 16, y - 3, name, 11, "muted");
    });
  };
  const axes = () => {
    line(plotX, plotY, plotX, plotY + plotH);
    line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
    if (spec.yLabel) text(originX - 8, plotY - 22, spec.yLabel, 11, "muted");
    if (spec.xLabel) text(plotX, plotY + plotH + 40, spec.xLabel, 11, "muted");
  };

  switch (spec.kind) {
    case "bar": {
      const list = items.slice(0, 8);
      axes();
      const slot = list.length ? plotW / list.length : plotW;
      const barW = Math.max(24, Math.min(72, slot - 20));
      list.forEach((item, i) => {
        const v = clamp01(item.value ?? item.y ?? 0.5);
        const h = Math.max(6, v * (plotH - 16));
        const x = plotX + i * slot + (slot - barW) / 2;
        rect(x, plotY + plotH - h, barW, h, toneAt(i, item), "solid");
        text(x, plotY + plotH - h - 20, pct(v), 11, "muted");
        text(x, plotY + plotH + 12, item.label, 11);
      });
      break;
    }

    case "hbar": {
      const list = items.slice(0, 9);
      const labelW = 130;
      const trackX = plotX + labelW;
      const trackW = plotW - labelW;
      const slot = list.length ? plotH / list.length : plotH;
      const barH = Math.max(16, Math.min(40, slot - 14));
      list.forEach((item, i) => {
        const v = clamp01(item.value ?? 0.5);
        const y = plotY + i * slot + (slot - barH) / 2;
        text(plotX, y + barH / 2 - 7, item.label, 11);
        rect(trackX, y, trackW, barH, "subtle", "none");
        rect(trackX, y, Math.max(4, v * trackW), barH, toneAt(i, item), "solid");
        text(trackX + trackW + 8, y + barH / 2 - 7, pct(v), 11, "muted");
      });
      break;
    }

    case "stacked": {
      const list = items.slice(0, 7);
      axes();
      const slot = list.length ? plotW / list.length : plotW;
      const barW = Math.max(28, Math.min(76, slot - 22));
      list.forEach((item, i) => {
        const vals = (item.values ?? [clamp01(item.value ?? 0.5)]).map(clamp01).slice(0, 5);
        const total = Math.max(0.0001, vals.reduce((a, b) => a + b, 0));
        const scale = Math.min(1, total) / total;
        let y = plotY + plotH;
        const x = plotX + i * slot + (slot - barW) / 2;
        vals.forEach((v, j) => {
          const h = Math.max(4, v * scale * (plotH - 16));
          y -= h;
          rect(x, y, barW, h, TONES[j % TONES.length], "solid");
        });
        text(x, plotY + plotH + 12, item.label, 11);
      });
      if (spec.series?.length) legend(spec.series, plotX, plotY + plotH + 40);
      break;
    }

    case "line":
    case "area": {
      const list = items.slice(0, 12);
      axes();
      for (let g = 1; g < 4; g++) line(plotX, plotY + (plotH * g) / 4, plotX + plotW, plotY + (plotH * g) / 4, "subtle", true);
      const step = list.length > 1 ? plotW / (list.length - 1) : plotW;
      const pts: Array<[number, number]> = list.map((item, i) => [
        plotX + i * step,
        plotY + (1 - clamp01(item.value ?? item.y ?? 0.5)) * plotH,
      ]);
      if (spec.kind === "area" && pts.length > 1) {
        path([[pts[0][0], plotY + plotH], ...pts, [pts[pts.length - 1][0], plotY + plotH]], "accent", true, "solid");
      }
      if (pts.length > 1) path(pts, "accent");
      pts.forEach(([px, py], i) => {
        rect(px - 5, py - 5, 10, 10, "ink", "solid");
        text(px - 12, plotY + plotH + 12, list[i].label, 11);
      });
      break;
    }

    case "scatter":
    case "bubble": {
      axes();
      line(plotX, plotY, plotX + plotW, plotY, "subtle", true);
      if (spec.xHigh) text(plotX + plotW - 90, plotY + plotH + 22, spec.xHigh, 11, "muted");
      if (spec.xLow) text(plotX, plotY + plotH + 22, spec.xLow, 11, "muted");
      items.slice(0, 14).forEach((item, i) => {
        const px = plotX + clamp01(item.x) * plotW;
        const py = plotY + (1 - clamp01(item.y)) * plotH;
        const r = spec.kind === "bubble" ? 12 + clamp01(item.size ?? 0.4) * 46 : 12;
        ellipse(px - r / 2, py - r / 2, r, r, toneAt(i, item), spec.kind === "bubble" ? "none" : "solid");
        text(px + r / 2 + 6, py - 7, item.label, 11);
      });
      break;
    }

    case "pie":
    case "donut": {
      const list = items.slice(0, 8);
      const cx = originX + 200;
      const cy = plotY + plotH / 2;
      const R = Math.min(plotH, 340) / 2;
      const total = Math.max(0.0001, list.reduce((a, b) => a + clamp01(b.value ?? 0), 0));
      let a0 = -Math.PI / 2;
      list.forEach((item, i) => {
        const frac = clamp01(item.value ?? 0) / total;
        const a1 = a0 + frac * Math.PI * 2;
        const arc: Array<[number, number]> = [];
        const steps = Math.max(3, Math.round(frac * 48));
        for (let k = 0; k <= steps; k++) {
          const a = a0 + ((a1 - a0) * k) / steps;
          arc.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
        }
        if (spec.kind === "donut") {
          const inner: Array<[number, number]> = [];
          for (let k = steps; k >= 0; k--) {
            const a = a0 + ((a1 - a0) * k) / steps;
            inner.push([cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55]);
          }
          path([...arc, ...inner], toneAt(i, item), true, "solid");
        } else {
          path([[cx, cy], ...arc], toneAt(i, item), true, "solid");
        }
        const mid = (a0 + a1) / 2;
        text(cx + Math.cos(mid) * (R + 22) - 20, cy + Math.sin(mid) * (R + 22) - 7, `${item.label} ${Math.round(frac * 100)}%`, 11);
        a0 = a1;
      });
      break;
    }

    case "funnel":
    case "pyramid": {
      const list = items.slice(0, 7);
      const rows = list.length || 1;
      const rowH = Math.min(64, plotH / rows - 10);
      list.forEach((item, i) => {
        const t = rows > 1 ? i / (rows - 1) : 0;
        const frac = item.value != null ? clamp01(item.value) : spec.kind === "pyramid" ? t : 1 - t * 0.75;
        const w = Math.max(60, frac * plotW);
        const x = plotX + (plotW - w) / 2;
        const y = plotY + i * (rowH + 12);
        rect(x, y, w, rowH, toneAt(i, item), "solid");
        text(plotX + plotW + 12, y + rowH / 2 - 7, item.label, 11);
        if (item.value != null) text(x + 8, y + rowH / 2 - 7, pct(clamp01(item.value)), 11, "surface");
      });
      break;
    }

    case "timeline": {
      const list = items.slice(0, 8);
      const y = plotY + plotH / 2;
      line(plotX, y, plotX + plotW, y, "ink");
      list.forEach((item, i) => {
        const t = item.start != null ? clamp01(item.start) : list.length > 1 ? i / (list.length - 1) : 0.5;
        const px = plotX + t * plotW;
        rect(px - 6, y - 6, 12, 12, toneAt(i, item), "solid");
        const up = i % 2 === 0;
        line(px, y, px, up ? y - 48 : y + 48, "muted", true);
        text(px - 40, up ? y - 74 : y + 56, item.label, 13);
        if (item.note) text(px - 40, up ? y - 56 : y + 74, item.note, 11, "muted");
      });
      if (spec.xLow) text(plotX, y + 110, spec.xLow, 11, "muted");
      if (spec.xHigh) text(plotX + plotW - 80, y + 110, spec.xHigh, 11, "muted");
      break;
    }

    case "gantt": {
      const list = items.slice(0, 8);
      const labelW = 130;
      const trackX = plotX + labelW;
      const trackW = plotW - labelW;
      const slot = list.length ? plotH / list.length : plotH;
      const barH = Math.max(16, Math.min(34, slot - 14));
      for (let g = 0; g <= 4; g++) line(trackX + (trackW * g) / 4, plotY, trackX + (trackW * g) / 4, plotY + plotH, "subtle", true);
      list.forEach((item, i) => {
        const a = clamp01(item.start ?? 0);
        const b = Math.max(a + 0.04, clamp01(item.end ?? a + 0.25));
        const y = plotY + i * slot + (slot - barH) / 2;
        text(plotX, y + barH / 2 - 7, item.label, 11);
        rect(trackX + a * trackW, y, (b - a) * trackW, barH, toneAt(i, item), "solid");
      });
      if (spec.xLow) text(trackX, plotY + plotH + 14, spec.xLow, 11, "muted");
      if (spec.xHigh) text(trackX + trackW - 70, plotY + plotH + 14, spec.xHigh, 11, "muted");
      break;
    }

    case "heatmap": {
      const cols = (spec.series ?? []).slice(0, 6);
      const list = items.slice(0, 8);
      const labelW = 120;
      const gridX = plotX + labelW;
      const cw = (plotW - labelW) / Math.max(1, cols.length || 1);
      const ch = Math.min(52, plotH / Math.max(1, list.length));
      cols.forEach((c, j) => text(gridX + j * cw + 4, plotY - 18, c, 11, "muted"));
      list.forEach((item, i) => {
        text(plotX, plotY + i * ch + ch / 2 - 7, item.label, 11);
        const vals = (item.values ?? []).map(clamp01);
        for (let j = 0; j < (cols.length || vals.length); j++) {
          const v = clamp01(vals[j] ?? 0);
          rect(gridX + j * cw + 2, plotY + i * ch + 2, cw - 6, ch - 6, v > 0.66 ? "accent" : v > 0.33 ? "muted" : "subtle", v > 0.15 ? "solid" : "none");
          text(gridX + j * cw + cw / 2 - 10, plotY + i * ch + ch / 2 - 7, `${Math.round(v * 100)}`, 11, v > 0.66 ? "surface" : "ink");
        }
      });
      break;
    }

    case "radar": {
      const axesNames = (spec.series ?? items.map((i) => i.label)).slice(0, 8);
      const k = Math.max(3, axesNames.length);
      const cx = originX + 280;
      const cy = plotY + plotH / 2;
      const R = Math.min(plotH, 320) / 2;
      const at = (i: number, r: number): [number, number] => {
        const a = -Math.PI / 2 + (i / k) * Math.PI * 2;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      };
      [0.33, 0.66, 1].forEach((ring) => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < k; i++) pts.push(at(i, R * ring));
        path(pts, "subtle", true);
      });
      for (let i = 0; i < k; i++) {
        const [px, py] = at(i, R);
        line(cx, cy, px, py, "subtle");
        text(px - 24, py - 8, axesNames[i] ?? "", 11, "muted");
      }
      const series = items.filter((it) => (it.values ?? []).length);
      (series.length ? series : [{ label: spec.title ?? "", values: items.map((it) => clamp01(it.value)) } as ChartItem]).slice(0, 3).forEach((serie, si) => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < k; i++) pts.push(at(i, R * clamp01((serie.values ?? [])[i] ?? 0.4)));
        path(pts, TONES[si % TONES.length], true);
      });
      break;
    }

    case "venn": {
      const list = items.slice(0, 3);
      const R = 150;
      const cy = plotY + plotH / 2 - R / 2;
      const centers: Array<[number, number]> = list.length >= 3
        ? [[plotX + 90, cy], [plotX + 240, cy], [plotX + 165, cy + 120]]
        : [[plotX + 90, cy], [plotX + 220, cy]];
      list.forEach((item, i) => {
        const [cx0, cy0] = centers[i] ?? centers[0];
        ellipse(cx0, cy0, R * 1.5, R * 1.5, toneAt(i, item), "none");
        text(cx0 + 10, cy0 - 16, item.label, 13);
        if (item.note) text(cx0 + 10, cy0 + 4, item.note, 11, "muted");
      });
      break;
    }

    case "waterfall": {
      const list = items.slice(0, 8);
      axes();
      const base = plotY + plotH;
      const slot = list.length ? plotW / list.length : plotW;
      const barW = Math.max(24, Math.min(64, slot - 20));
      let level = 0;
      list.forEach((item, i) => {
        const v = typeof item.value === "number" ? Math.max(-1, Math.min(1, item.value)) : 0;
        const x = plotX + i * slot + (slot - barW) / 2;
        const y0 = base - level * plotH;
        const y1 = base - (level + v) * plotH;
        rect(x, Math.min(y0, y1), barW, Math.abs(y1 - y0), v >= 0 ? "success" : "danger", "solid");
        text(x, Math.min(y0, y1) - 20, `${v >= 0 ? "+" : ""}${Math.round(v * 100)}`, 11, "muted");
        text(x, base + 12, item.label, 11);
        level += v;
        if (i < list.length - 1) line(x, y1, x + slot, y1, "subtle", true);
      });
      break;
    }

    case "gauge": {
      const v = clamp01(items[0]?.value ?? 0.5);
      const cx = originX + 260;
      const cy = plotY + plotH / 2 + 60;
      const R = 160;
      const arc = (from: number, to: number, tone: SketchPrimitive["tone"], radius: number) => {
        const pts: Array<[number, number]> = [];
        for (let k2 = 0; k2 <= 40; k2++) {
          const a = Math.PI + (from + ((to - from) * k2) / 40) * Math.PI;
          pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
        }
        path(pts, tone);
      };
      arc(0, 1, "subtle", R);
      arc(0, v, "accent", R);
      text(cx - 46, cy - 50, `${Math.round(v * 100)}%`, 52);
      if (items[0]?.label) text(cx - 60, cy + 16, items[0].label, 13, "muted");
      break;
    }

    case "matrix": {
      const cols = (spec.series ?? []).slice(0, 4);
      const list = items.slice(0, 6);
      const labelW = 140;
      const gridX = plotX + labelW;
      const cw = (plotW - labelW) / Math.max(1, cols.length || 1);
      const ch = Math.min(64, plotH / Math.max(1, list.length));
      cols.forEach((c, j) => text(gridX + j * cw + 6, plotY - 18, c, 11, "muted"));
      line(plotX, plotY, plotX + plotW, plotY, "muted");
      list.forEach((item, i) => {
        const y = plotY + i * ch;
        text(plotX, y + ch / 2 - 7, item.label, 13);
        line(plotX, y + ch, plotX + plotW, y + ch, "subtle");
        (item.values ?? []).slice(0, cols.length || 4).forEach((v, j) => {
          const val = clamp01(v);
          text(gridX + j * cw + 6, y + ch / 2 - 7, val >= 0.66 ? "strong" : val >= 0.33 ? "ok" : "weak", 11, val >= 0.66 ? "success" : val >= 0.33 ? "muted" : "danger");
        });
      });
      cols.forEach((_, j) => line(gridX + j * cw, plotY, gridX + j * cw, plotY + list.length * ch, "subtle"));
      break;
    }

    case "quadrant":
    default: {
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
      items.slice(0, 10).forEach((item, i) => {
        const fx = clamp01(item.x);
        const fy = clamp01(item.y);
        let px = plotX + fx * plotW;
        let py = plotY + (1 - fy) * plotH;
        let guard = 0;
        while (placed.some(([ax, ay]) => Math.abs(ax - px) < 60 && Math.abs(ay - py) < 24) && guard++ < 8) {
          py += 26;
        }
        px = Math.min(plotX + plotW - 16, Math.max(plotX + 8, px));
        py = Math.min(plotY + plotH - 12, Math.max(plotY + 8, py));
        placed.push([px, py]);
        rect(px - 6, py - 6, 12, 12, toneAt(i, item), "solid");
        text(px + 12, py - 7, item.label, 13);
      });
      break;
    }
  }

  return s;
}
