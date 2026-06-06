import { useEffect, useRef } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import type { SketchPrimitive, FreehandStroke } from "@/lib/sketch-types";

const WIDTH = 1600;
const HEIGHT = 1000;

function strokePath(points: Array<[number, number, number]>) {
  const stroke = getStroke(points, { size: 4, thinning: 0.6, smoothing: 0.5, streamline: 0.5 });
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x, y], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(`${x.toFixed(1)},${y.toFixed(1)} ${((x + x1) / 2).toFixed(1)},${((y + y1) / 2).toFixed(1)}`);
      return acc;
    },
    ["M"] as string[],
  );
  d.splice(1, 0, ` ${stroke[0][0].toFixed(1)},${stroke[0][1].toFixed(1)} Q`);
  return d.join(" ") + " Z";
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

  // Re-render AI shapes with rough.js whenever shapes change
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

    const addLabel = (cx: number, cy: number, label: string, size = 14, weight = "regular") => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(cx));
      t.setAttribute("y", String(cy));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("font-family", "Fraunces, ui-serif, serif");
      t.setAttribute("font-size", String(size));
      t.setAttribute("font-weight", weight === "bold" ? "600" : "500");
      t.setAttribute("fill", "hsl(var(--foreground))");
      t.style.fill = "hsl(var(--foreground))";
      t.textContent = label;
      layer.appendChild(t);
    };

    for (const s of shapes) {
      const seed = seedFor(s.id);
      const opts = {
        seed,
        stroke: "hsl(var(--foreground))",
        strokeWidth: 1.4,
        roughness: 1.6,
        bowing: 1.4,
        fill: undefined as string | undefined,
        fillStyle: "hachure",
        hachureGap: 6,
      };
      if (s.type === "rect") {
        const node = rc.rectangle(s.x, s.y, s.w, s.h, opts);
        layer.appendChild(node);
        if (s.label) addLabel(s.x + s.w / 2, s.y + s.h / 2, s.label, 14, "bold");
      } else if (s.type === "ellipse") {
        const node = rc.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, opts);
        layer.appendChild(node);
        if (s.label) addLabel(s.x + s.w / 2, s.y + s.h / 2, s.label, 14, "bold");
      } else if (s.type === "diamond") {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        const node = rc.polygon(
          [
            [cx, s.y],
            [s.x + s.w, cy],
            [cx, s.y + s.h],
            [s.x, cy],
          ],
          opts,
        );
        layer.appendChild(node);
        if (s.label) addLabel(cx, cy, s.label, 13, "bold");
      } else if (s.type === "line") {
        layer.appendChild(rc.line(s.x1, s.y1, s.x2, s.y2, opts));
      } else if (s.type === "arrow") {
        layer.appendChild(rc.line(s.x1, s.y1, s.x2, s.y2, opts));
        // arrowhead
        const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        const ah = 12;
        const ax1 = s.x2 - ah * Math.cos(angle - Math.PI / 7);
        const ay1 = s.y2 - ah * Math.sin(angle - Math.PI / 7);
        const ax2 = s.x2 - ah * Math.cos(angle + Math.PI / 7);
        const ay2 = s.y2 - ah * Math.sin(angle + Math.PI / 7);
        layer.appendChild(rc.line(s.x2, s.y2, ax1, ay1, { ...opts, roughness: 1 }));
        layer.appendChild(rc.line(s.x2, s.y2, ax2, ay2, { ...opts, roughness: 1 }));
        if (s.label) addLabel((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 10, s.label, 11);
      } else if (s.type === "text") {
        addLabel(s.x, s.y, s.text, s.size ?? 14, s.weight ?? "regular");
      } else if (s.type === "stroke") {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        path.setAttribute("points", s.points.map(([x, y]) => `${x},${y}`).join(" "));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", s.color ?? "hsl(var(--foreground))");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        layer.appendChild(path);
      }
    }
  }, [shapes]);

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
    path.setAttribute("fill", "hsl(var(--foreground))");
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
      onFreehandComplete({ id: activeIdRef.current, points, color: "hsl(var(--foreground))" });
    }
  };

  return (
    <div className="relative h-full w-full overflow-auto bg-[hsl(var(--background))]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        style={{
          display: "block",
          touchAction: "none",
          cursor: drawingEnabled ? "crosshair" : "default",
          backgroundImage:
            "radial-gradient(circle, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      >
        {/* Persisted freehand */}
        <g>
          {freehand.map((fh) => (
            <path key={fh.id} d={strokePath(fh.points)} fill={fh.color} />
          ))}
        </g>
        {/* AI shapes layer (mutated by effect) */}
        <g ref={aiLayerRef} />
      </svg>
    </div>
  );
}
