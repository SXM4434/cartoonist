import { useEffect, useRef, useState } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import type { SketchPrimitive, FreehandStroke } from "@/lib/sketch-types";

const WIDTH = 1600;
const HEIGHT = 1000;

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

  // Resolve real color from CSS var (rough.js needs literal colors as SVG attributes)
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

    const addLabel = (cx: number, cy: number, label: string, size = 16, weight = "regular") => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(cx));
      t.setAttribute("y", String(cy));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("font-family", "Inter, ui-sans-serif, system-ui, sans-serif");
      t.setAttribute("font-size", String(size));
      t.setAttribute("font-weight", weight === "bold" ? "600" : "500");
      t.setAttribute("fill", inkColor);
      t.textContent = label;
      layer.appendChild(t);
    };

    for (const s of shapes) {
      const seed = seedFor(s.id);
      const opts = {
        seed,
        stroke: inkColor,
        strokeWidth: 1.8,
        roughness: 1.8,
        bowing: 1.6,
      };
      if (s.type === "rect") {
        layer.appendChild(rc.rectangle(s.x, s.y, s.w, s.h, opts));
        if (s.label) addLabel(s.x + s.w / 2, s.y + s.h / 2, s.label, 15, "bold");
      } else if (s.type === "ellipse") {
        layer.appendChild(rc.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, opts));
        if (s.label) addLabel(s.x + s.w / 2, s.y + s.h / 2, s.label, 15, "bold");
      } else if (s.type === "diamond") {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        layer.appendChild(
          rc.polygon(
            [
              [cx, s.y],
              [s.x + s.w, cy],
              [cx, s.y + s.h],
              [s.x, cy],
            ],
            opts,
          ),
        );
        if (s.label) addLabel(cx, cy, s.label, 13, "bold");
      } else if (s.type === "line") {
        layer.appendChild(rc.line(s.x1, s.y1, s.x2, s.y2, opts));
      } else if (s.type === "arrow") {
        layer.appendChild(rc.line(s.x1, s.y1, s.x2, s.y2, opts));
        const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        const ah = 14;
        const ax1 = s.x2 - ah * Math.cos(angle - Math.PI / 7);
        const ay1 = s.y2 - ah * Math.sin(angle - Math.PI / 7);
        const ax2 = s.x2 - ah * Math.cos(angle + Math.PI / 7);
        const ay2 = s.y2 - ah * Math.sin(angle + Math.PI / 7);
        layer.appendChild(rc.line(s.x2, s.y2, ax1, ay1, { ...opts, roughness: 0.8 }));
        layer.appendChild(rc.line(s.x2, s.y2, ax2, ay2, { ...opts, roughness: 0.8 }));
        if (s.label) addLabel((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 12, s.label, 12);
      } else if (s.type === "text") {
        addLabel(s.x, s.y, s.text, s.size ?? 16, s.weight ?? "regular");
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
      className="relative h-full w-full overflow-hidden"
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
