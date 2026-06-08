import { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import type { IconKind, SketchPrimitive, FreehandStroke } from "@/lib/sketch-types";

const WIDTH = 1600;
const HEIGHT = 1000;

const NOTE_COLORS: Record<string, string> = {
  yellow: "#FFE9A8",
  pink: "#FBC9D4",
  blue: "#BFE0F2",
  green: "#CDE9C0",
};

function strokePath(points: Array<[number, number, number]>) {
  const stroke = getStroke(points, { size: 4, thinning: 0.6, smoothing: 0.5, streamline: 0.5 });
  if (!stroke.length) return "";
  const d: string[] = [`M ${stroke[0][0].toFixed(1)},${stroke[0][1].toFixed(1)} Q`];
  for (let i = 0; i < stroke.length; i++) {
    const [x, y] = stroke[i];
    const [x1, y1] = stroke[(i + 1) % stroke.length];
    d.push(`${x.toFixed(1)},${y.toFixed(1)} ${((x + x1) / 2).toFixed(1)},${((y + y1) / 2).toFixed(1)}`);
  }
  d.push("Z");
  return d.join(" ");
}

export function SketchCanvas({
  shapes,
  freehand,
  onFreehandComplete,
  drawingEnabled,
}: {
  shapes: readonly SketchPrimitive[];
  freehand: readonly FreehandStroke[];
  onFreehandComplete: (stroke: FreehandStroke) => void;
  drawingEnabled: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const aiLayerRef = useRef<SVGGElement | null>(null);
  const activeStrokeRef = useRef<Array<[number, number, number]> | null>(null);
  const activeIdRef = useRef<string>("");
  const tempPathRef = useRef<SVGPathElement | null>(null);
  const [inkColor, setInkColor] = useState("#1a1a1a");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const probe = document.createElement("div");
    probe.style.color = "hsl(var(--foreground))";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    if (c) setInkColor(c);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const svg = svgRef.current;
    const layer = aiLayerRef.current;
    if (!svg || !layer) return;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    const rc = rough.svg(svg);

    const seedFor = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      return Math.abs(h) % 2147483647 || 1;
    };

    const baseOpts = (seed: number, extra: Record<string, unknown> = {}) => ({
      seed,
      stroke: inkColor,
      strokeWidth: 1.8,
      roughness: 1.7,
      bowing: 1.4,
      ...extra,
    });

    const addText = (
      x: number,
      y: number,
      text: string,
      opts: { size?: number; weight?: "regular" | "bold"; italic?: boolean; align?: "left" | "center" | "right"; color?: string } = {},
    ) => {
      const size = opts.size ?? 15;
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(x));
      t.setAttribute("y", String(y));
      t.setAttribute("text-anchor", opts.align === "left" ? "start" : opts.align === "right" ? "end" : "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("font-family", '"Caveat", "Patrick Hand", "Comic Sans MS", cursive');
      t.setAttribute("font-size", String(size));
      t.setAttribute("font-weight", opts.weight === "bold" ? "700" : "500");
      if (opts.italic) t.setAttribute("font-style", "italic");
      t.setAttribute("fill", opts.color ?? inkColor);
      // wrap long text into <tspan>s
      const words = text.split(/\s+/);
      const maxChars = 22;
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        if ((line + " " + w).trim().length > maxChars) {
          if (line) lines.push(line);
          line = w;
        } else {
          line = (line + " " + w).trim();
        }
      }
      if (line) lines.push(line);
      const lh = size * 1.15;
      const startY = y - ((lines.length - 1) * lh) / 2;
      lines.forEach((ln, i) => {
        const ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        ts.setAttribute("x", String(x));
        ts.setAttribute("y", String(startY + i * lh));
        ts.textContent = ln;
        t.appendChild(ts);
      });
      layer.appendChild(t);
    };

    const drawIcon = (kind: IconKind, x: number, y: number, size: number, seed: number) => {
      const s = size;
      const cx = x + s / 2;
      const cy = y + s / 2;
      const opts = baseOpts(seed);
      switch (kind) {
        case "user":
          layer.appendChild(rc.circle(cx, y + s * 0.3, s * 0.36, opts));
          layer.appendChild(rc.path(`M ${x + s * 0.1} ${y + s} Q ${cx} ${y + s * 0.55} ${x + s * 0.9} ${y + s}`, opts));
          break;
        case "users":
          layer.appendChild(rc.circle(cx - s * 0.18, y + s * 0.32, s * 0.28, opts));
          layer.appendChild(rc.circle(cx + s * 0.18, y + s * 0.32, s * 0.28, opts));
          layer.appendChild(rc.path(`M ${x} ${y + s} Q ${cx} ${y + s * 0.6} ${x + s} ${y + s}`, opts));
          break;
        case "phone":
          layer.appendChild(rc.rectangle(x + s * 0.25, y + s * 0.05, s * 0.5, s * 0.9, opts));
          layer.appendChild(rc.line(x + s * 0.42, y + s * 0.86, x + s * 0.58, y + s * 0.86, opts));
          break;
        case "laptop":
          layer.appendChild(rc.rectangle(x + s * 0.1, y + s * 0.2, s * 0.8, s * 0.55, opts));
          layer.appendChild(rc.line(x, y + s * 0.85, x + s, y + s * 0.85, opts));
          break;
        case "server":
          layer.appendChild(rc.rectangle(x + s * 0.1, y + s * 0.15, s * 0.8, s * 0.3, opts));
          layer.appendChild(rc.rectangle(x + s * 0.1, y + s * 0.55, s * 0.8, s * 0.3, opts));
          layer.appendChild(rc.circle(x + s * 0.78, y + s * 0.3, s * 0.06, { ...opts, fill: inkColor, fillStyle: "solid" }));
          layer.appendChild(rc.circle(x + s * 0.78, y + s * 0.7, s * 0.06, { ...opts, fill: inkColor, fillStyle: "solid" }));
          break;
        case "database":
          layer.appendChild(rc.ellipse(cx, y + s * 0.18, s * 0.7, s * 0.2, opts));
          layer.appendChild(rc.path(`M ${x + s * 0.15} ${y + s * 0.18} L ${x + s * 0.15} ${y + s * 0.82}`, opts));
          layer.appendChild(rc.path(`M ${x + s * 0.85} ${y + s * 0.18} L ${x + s * 0.85} ${y + s * 0.82}`, opts));
          layer.appendChild(rc.ellipse(cx, y + s * 0.82, s * 0.7, s * 0.2, opts));
          layer.appendChild(rc.ellipse(cx, y + s * 0.5, s * 0.7, s * 0.2, opts));
          break;
        case "cloud":
          layer.appendChild(rc.path(
            `M ${x + s * 0.2} ${y + s * 0.7} Q ${x} ${y + s * 0.55} ${x + s * 0.2} ${y + s * 0.45} Q ${x + s * 0.2} ${y + s * 0.2} ${x + s * 0.5} ${y + s * 0.3} Q ${x + s * 0.7} ${y + s * 0.15} ${x + s * 0.8} ${y + s * 0.4} Q ${x + s} ${y + s * 0.45} ${x + s * 0.85} ${y + s * 0.7} Z`,
            opts,
          ));
          break;
        case "gear":
          layer.appendChild(rc.circle(cx, cy, s * 0.5, opts));
          layer.appendChild(rc.circle(cx, cy, s * 0.18, opts));
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const x1 = cx + Math.cos(a) * s * 0.28;
            const y1 = cy + Math.sin(a) * s * 0.28;
            const x2 = cx + Math.cos(a) * s * 0.45;
            const y2 = cy + Math.sin(a) * s * 0.45;
            layer.appendChild(rc.line(x1, y1, x2, y2, opts));
          }
          break;
        case "lightbulb":
          layer.appendChild(rc.circle(cx, y + s * 0.4, s * 0.5, opts));
          layer.appendChild(rc.rectangle(cx - s * 0.15, y + s * 0.65, s * 0.3, s * 0.2, opts));
          layer.appendChild(rc.line(cx - s * 0.1, y + s * 0.9, cx + s * 0.1, y + s * 0.9, opts));
          break;
        case "lightning":
          layer.appendChild(rc.polygon(
            [[cx - s * 0.1, y], [cx + s * 0.25, y + s * 0.45], [cx, y + s * 0.45], [cx + s * 0.1, y + s], [cx - s * 0.25, y + s * 0.55], [cx, y + s * 0.55]],
            opts,
          ));
          break;
        case "lock":
          layer.appendChild(rc.rectangle(x + s * 0.2, y + s * 0.45, s * 0.6, s * 0.45, opts));
          layer.appendChild(rc.path(`M ${x + s * 0.3} ${y + s * 0.45} Q ${x + s * 0.3} ${y + s * 0.1} ${cx} ${y + s * 0.1} Q ${x + s * 0.7} ${y + s * 0.1} ${x + s * 0.7} ${y + s * 0.45}`, opts));
          break;
        case "key":
          layer.appendChild(rc.circle(x + s * 0.25, cy, s * 0.3, opts));
          layer.appendChild(rc.line(x + s * 0.4, cy, x + s, cy, opts));
          layer.appendChild(rc.line(x + s * 0.85, cy, x + s * 0.85, cy + s * 0.15, opts));
          layer.appendChild(rc.line(x + s * 0.7, cy, x + s * 0.7, cy + s * 0.15, opts));
          break;
        case "star":
          {
            const pts: Array<[number, number]> = [];
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
              const r = i % 2 === 0 ? s * 0.45 : s * 0.2;
              pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
            }
            layer.appendChild(rc.polygon(pts, opts));
          }
          break;
        case "heart":
          layer.appendChild(rc.path(`M ${cx} ${y + s * 0.85} C ${x} ${y + s * 0.55} ${x + s * 0.1} ${y + s * 0.1} ${cx} ${y + s * 0.35} C ${x + s * 0.9} ${y + s * 0.1} ${x + s} ${y + s * 0.55} ${cx} ${y + s * 0.85} Z`, opts));
          break;
        case "check":
          layer.appendChild(rc.path(`M ${x + s * 0.15} ${cy} L ${cx - s * 0.05} ${y + s * 0.75} L ${x + s * 0.9} ${y + s * 0.25}`, { ...opts, strokeWidth: 2.6 }));
          break;
        case "cross":
          layer.appendChild(rc.line(x + s * 0.15, y + s * 0.15, x + s * 0.85, y + s * 0.85, { ...opts, strokeWidth: 2.6 }));
          layer.appendChild(rc.line(x + s * 0.85, y + s * 0.15, x + s * 0.15, y + s * 0.85, { ...opts, strokeWidth: 2.6 }));
          break;
        case "warning":
          layer.appendChild(rc.polygon([[cx, y + s * 0.1], [x + s * 0.95, y + s * 0.9], [x + s * 0.05, y + s * 0.9]], opts));
          layer.appendChild(rc.line(cx, y + s * 0.4, cx, y + s * 0.65, opts));
          layer.appendChild(rc.circle(cx, y + s * 0.78, s * 0.03, { ...opts, fill: inkColor, fillStyle: "solid" }));
          break;
        case "envelope":
          layer.appendChild(rc.rectangle(x + s * 0.05, y + s * 0.25, s * 0.9, s * 0.5, opts));
          layer.appendChild(rc.path(`M ${x + s * 0.05} ${y + s * 0.25} L ${cx} ${y + s * 0.55} L ${x + s * 0.95} ${y + s * 0.25}`, opts));
          break;
        case "doc":
          layer.appendChild(rc.polygon([[x + s * 0.2, y + s * 0.05], [x + s * 0.7, y + s * 0.05], [x + s * 0.85, y + s * 0.2], [x + s * 0.85, y + s * 0.95], [x + s * 0.2, y + s * 0.95]], opts));
          layer.appendChild(rc.line(x + s * 0.3, y + s * 0.4, x + s * 0.75, y + s * 0.4, opts));
          layer.appendChild(rc.line(x + s * 0.3, y + s * 0.55, x + s * 0.75, y + s * 0.55, opts));
          layer.appendChild(rc.line(x + s * 0.3, y + s * 0.7, x + s * 0.6, y + s * 0.7, opts));
          break;
        case "folder":
          layer.appendChild(rc.path(`M ${x + s * 0.05} ${y + s * 0.3} L ${x + s * 0.4} ${y + s * 0.3} L ${x + s * 0.5} ${y + s * 0.2} L ${x + s * 0.95} ${y + s * 0.2} L ${x + s * 0.95} ${y + s * 0.85} L ${x + s * 0.05} ${y + s * 0.85} Z`, opts));
          break;
        case "chat":
          layer.appendChild(rc.path(`M ${x + s * 0.05} ${y + s * 0.15} L ${x + s * 0.95} ${y + s * 0.15} L ${x + s * 0.95} ${y + s * 0.7} L ${x + s * 0.4} ${y + s * 0.7} L ${x + s * 0.25} ${y + s * 0.92} L ${x + s * 0.25} ${y + s * 0.7} L ${x + s * 0.05} ${y + s * 0.7} Z`, opts));
          break;
        case "search":
          layer.appendChild(rc.circle(x + s * 0.4, y + s * 0.4, s * 0.4, opts));
          layer.appendChild(rc.line(x + s * 0.65, y + s * 0.65, x + s * 0.95, y + s * 0.95, { ...opts, strokeWidth: 2.4 }));
          break;
        case "eye":
          layer.appendChild(rc.ellipse(cx, cy, s * 0.9, s * 0.5, opts));
          layer.appendChild(rc.circle(cx, cy, s * 0.18, opts));
          break;
        case "calendar":
          layer.appendChild(rc.rectangle(x + s * 0.1, y + s * 0.2, s * 0.8, s * 0.7, opts));
          layer.appendChild(rc.line(x + s * 0.1, y + s * 0.4, x + s * 0.9, y + s * 0.4, opts));
          layer.appendChild(rc.line(x + s * 0.3, y + s * 0.1, x + s * 0.3, y + s * 0.3, opts));
          layer.appendChild(rc.line(x + s * 0.7, y + s * 0.1, x + s * 0.7, y + s * 0.3, opts));
          break;
        case "clock":
          layer.appendChild(rc.circle(cx, cy, s * 0.45, opts));
          layer.appendChild(rc.line(cx, cy, cx, cy - s * 0.3, opts));
          layer.appendChild(rc.line(cx, cy, cx + s * 0.22, cy, opts));
          break;
        case "money":
          layer.appendChild(rc.circle(cx, cy, s * 0.45, opts));
          addText(cx, cy, "$", { size: s * 0.55, weight: "bold" });
          break;
        case "chart":
          layer.appendChild(rc.line(x + s * 0.1, y + s * 0.9, x + s * 0.9, y + s * 0.9, opts));
          layer.appendChild(rc.line(x + s * 0.1, y + s * 0.1, x + s * 0.1, y + s * 0.9, opts));
          layer.appendChild(rc.rectangle(x + s * 0.2, y + s * 0.6, s * 0.12, s * 0.3, opts));
          layer.appendChild(rc.rectangle(x + s * 0.4, y + s * 0.4, s * 0.12, s * 0.5, opts));
          layer.appendChild(rc.rectangle(x + s * 0.6, y + s * 0.25, s * 0.12, s * 0.65, opts));
          break;
        case "sun":
          layer.appendChild(rc.circle(cx, cy, s * 0.25, opts));
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            layer.appendChild(rc.line(cx + Math.cos(a) * s * 0.32, cy + Math.sin(a) * s * 0.32, cx + Math.cos(a) * s * 0.45, cy + Math.sin(a) * s * 0.45, opts));
          }
          break;
        case "moon":
          layer.appendChild(rc.path(`M ${cx + s * 0.2} ${y + s * 0.1} A ${s * 0.4} ${s * 0.4} 0 1 0 ${cx + s * 0.2} ${y + s * 0.9} A ${s * 0.3} ${s * 0.3} 0 1 1 ${cx + s * 0.2} ${y + s * 0.1} Z`, opts));
          break;
        case "tree":
          layer.appendChild(rc.circle(cx, y + s * 0.35, s * 0.4, opts));
          layer.appendChild(rc.rectangle(cx - s * 0.08, y + s * 0.65, s * 0.16, s * 0.3, opts));
          break;
        case "house":
          layer.appendChild(rc.polygon([[x + s * 0.1, y + s * 0.5], [cx, y + s * 0.1], [x + s * 0.9, y + s * 0.5], [x + s * 0.9, y + s * 0.95], [x + s * 0.1, y + s * 0.95]], opts));
          break;
        default:
          layer.appendChild(rc.rectangle(x, y, s, s, opts));
      }
    };

    for (const s of shapes) {
      const seed = seedFor(s.id);
      const opts = baseOpts(seed);
      if (s.type === "rect") {
        layer.appendChild(rc.rectangle(s.x, s.y, s.w, s.h, opts));
        if (s.label) addText(s.x + s.w / 2, s.y + s.h / 2, s.label, { size: 17, weight: "bold" });
      } else if (s.type === "ellipse") {
        layer.appendChild(rc.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, opts));
        if (s.label) addText(s.x + s.w / 2, s.y + s.h / 2, s.label, { size: 17, weight: "bold" });
      } else if (s.type === "diamond") {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        layer.appendChild(rc.polygon([[cx, s.y], [s.x + s.w, cy], [cx, s.y + s.h], [s.x, cy]], opts));
        if (s.label) addText(cx, cy, s.label, { size: 14, weight: "bold" });
      } else if (s.type === "line") {
        const lopts = s.dashed ? { ...opts, strokeLineDash: [8, 6] } : opts;
        layer.appendChild(rc.line(s.x1, s.y1, s.x2, s.y2, lopts));
      } else if (s.type === "arrow") {
        const lopts = s.dashed ? { ...opts, strokeLineDash: [8, 6] } : opts;
        layer.appendChild(rc.line(s.x1, s.y1, s.x2, s.y2, lopts));
        const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        const ah = 16;
        const ax1 = s.x2 - ah * Math.cos(angle - Math.PI / 7);
        const ay1 = s.y2 - ah * Math.sin(angle - Math.PI / 7);
        const ax2 = s.x2 - ah * Math.cos(angle + Math.PI / 7);
        const ay2 = s.y2 - ah * Math.sin(angle + Math.PI / 7);
        layer.appendChild(rc.line(s.x2, s.y2, ax1, ay1, { ...opts, roughness: 0.7 }));
        layer.appendChild(rc.line(s.x2, s.y2, ax2, ay2, { ...opts, roughness: 0.7 }));
        if (s.label) addText((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 14, s.label, { size: 14, italic: true });
      } else if (s.type === "text") {
        addText(s.x, s.y, s.text, { size: s.size ?? 18, weight: s.weight, italic: s.italic, align: s.align ?? "left" });
      } else if (s.type === "note") {
        const w = s.w ?? 160, h = s.h ?? 140;
        const color = NOTE_COLORS[s.color ?? "yellow"];
        layer.appendChild(rc.rectangle(s.x, s.y, w, h, { ...opts, fill: color, fillStyle: "solid", stroke: "rgba(0,0,0,0.25)", strokeWidth: 1 }));
        // text inside
        const t = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        t.setAttribute("x", String(s.x + 10));
        t.setAttribute("y", String(s.y + 10));
        t.setAttribute("width", String(w - 20));
        t.setAttribute("height", String(h - 20));
        const div = document.createElement("div");
        div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        div.style.fontFamily = '"Caveat", "Patrick Hand", cursive';
        div.style.fontSize = "18px";
        div.style.lineHeight = "1.2";
        div.style.color = "#1a1a1a";
        div.style.width = "100%";
        div.style.height = "100%";
        div.style.overflow = "hidden";
        div.style.wordBreak = "break-word";
        div.textContent = s.text;
        t.appendChild(div);
        layer.appendChild(t);
      } else if (s.type === "path") {
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + (s.closed ? " Z" : "");
        const popts = s.fill ? { ...opts, fill: s.fill, fillStyle: "hachure" } : opts;
        layer.appendChild(rc.path(d, popts));
      } else if (s.type === "icon") {
        drawIcon(s.kind, s.x, s.y, s.size ?? 80, seed);
        if (s.label) addText(s.x + (s.size ?? 80) / 2, s.y + (s.size ?? 80) + 14, s.label, { size: 14 });
      } else if (s.type === "stroke") {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        path.setAttribute("points", s.points.map(([x, y]) => `${x},${y}`).join(" "));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", s.color ?? inkColor);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        layer.appendChild(path);
      }
    }
  }, [shapes, inkColor]);

  const getPoint = (e: React.PointerEvent): [number, number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    const t = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
    return [t.x, t.y, (e as unknown as { pressure?: number }).pressure ?? 0.5];
  };

  const handleDown = (e: React.PointerEvent) => {
    if (!drawingEnabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activeStrokeRef.current = [getPoint(e)];
    activeIdRef.current = `fh_${Date.now()}`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", inkColor);
    path.setAttribute("d", strokePath(activeStrokeRef.current));
    svgRef.current?.appendChild(path);
    tempPathRef.current = path;
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current.push(getPoint(e));
    if (tempPathRef.current) tempPathRef.current.setAttribute("d", strokePath(activeStrokeRef.current));
  };
  const handleUp = () => {
    if (!activeStrokeRef.current) return;
    const points = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (tempPathRef.current && svgRef.current?.contains(tempPathRef.current)) {
      svgRef.current.removeChild(tempPathRef.current);
    }
    tempPathRef.current = null;
    if (points.length > 2) {
      onFreehandComplete({ id: activeIdRef.current, points, color: inkColor });
    }
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-background"
      style={{
        backgroundImage:
          "radial-gradient(circle, hsl(var(--foreground) / 0.10) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{
          display: "block",
          touchAction: "none",
          cursor: drawingEnabled ? "crosshair" : "default",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      >
        <g>
          {freehand.map((fh) => (
            <path key={fh.id} d={strokePath(fh.points)} fill={fh.color} />
          ))}
        </g>
        <g ref={aiLayerRef} />
      </svg>
    </div>
  );
}
