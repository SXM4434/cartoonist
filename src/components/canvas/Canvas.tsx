import { useCallback, useEffect, useRef, useState } from "react";
import { compressLegacySegments, getIndices, Tldraw, type Editor, type TLShapePartial } from "tldraw";
import "tldraw/tldraw.css";
import { useCanvas } from "./canvas-context";
import type { SketchPrimitive } from "@/lib/sketch-types";
import "@/styles/tldraw.css";

type RichText = { type: "doc"; content: Array<{ type: "paragraph"; content?: Array<{ type: "text"; text: string }> }> };

const toRichText = (text: string): RichText => ({
  type: "doc",
  content: (text || " ").split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : undefined,
  })),
});

const shapeId = (id: string) => `shape:cartoonist-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}` as TLShapePartial["id"];

// Map a SketchCanvas "note" color to a tldraw geo fill color. We use geo
// rectangles (not tldraw notes) so we can honor the w/h the AI sends and
// keep text from auto-scaling to jumbo. Colors are deliberately the pale
// variants from our CSS — yellow/blue/green/red light tones.
const geoNoteColor = (color?: "yellow" | "pink" | "blue" | "green") => {
  if (color === "pink") return "light-red";
  if (color === "blue") return "light-blue";
  if (color === "green") return "light-green";
  return "yellow"; // we re-map this in CSS to a soft warm cream
};

// Cap text shape size to our ladder. tldraw only exposes s/m/l/xl tokens —
// "xl" is jumbo and breaks layout. Use "l" for true headings, "m" for
// subheads, "s" for body/captions.
const textSize = (size?: number): "s" | "m" | "l" => {
  if (!size) return "s";
  if (size >= 34) return "l";
  if (size >= 24) return "m";
  return "s";
};

const clampNoteSize = (w?: number, h?: number) => ({
  w: Math.min(Math.max(w ?? 154, 120), 178),
  h: Math.min(Math.max(h ?? 104, 82), 116),
});

const sketchLine = (id: string, x1: number, y1: number, x2: number, y2: number, dashed?: boolean): TLShapePartial => ({
  id: shapeId(id),
  type: "arrow",
  x: x1,
  y: y1,
  opacity: 1,
  isLocked: false,
  props: { kind: "arc", color: "black", fill: "none", dash: dashed ? "dashed" : "draw", size: "s", arrowheadStart: "none", arrowheadEnd: "none", font: "draw", labelColor: "black", start: { x: 0, y: 0 }, end: { x: x2 - x1, y: y2 - y1 }, bend: 0, richText: toRichText(""), labelPosition: 0.5, scale: 0.72, elbowMidPoint: 0.5 },
});

const pathToLine = (shape: Extract<SketchPrimitive, { type: "path" }>): TLShapePartial[] => {
  const rawPoints = shape.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (rawPoints.length < 2) return [];
  const closedPoints = shape.type === "path" && shape.closed ? [...rawPoints, rawPoints[0]] : rawPoints;
  const minX = Math.min(...closedPoints.map(([x]) => x));
  const minY = Math.min(...closedPoints.map(([, y]) => y));
  const indices = getIndices(closedPoints.length);
  const points = Object.fromEntries(closedPoints.map(([x, y], i) => {
    const index = indices[i];
    return [index, { id: index, index, x: x - minX, y: y - minY }];
  }));
  return [{
    id: shapeId(shape.id),
    type: "line",
    x: minX,
    y: minY,
    opacity: 1,
    isLocked: false,
    props: { color: "black", dash: "draw", size: "s", spline: "cubic", points, scale: 1 },
  }];
};

const strokeToDraw = (shape: Extract<SketchPrimitive, { type: "stroke" }>): TLShapePartial[] => {
  const rawPoints = shape.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (rawPoints.length < 2) return [];
  const minX = Math.min(...rawPoints.map(([x]) => x));
  const minY = Math.min(...rawPoints.map(([, y]) => y));
  const points = rawPoints.map(([x, y]) => ({ x: x - minX, y: y - minY, z: 0.5 }));
  return [{
    id: shapeId(shape.id),
    type: "draw",
    x: minX,
    y: minY,
    opacity: 1,
    isLocked: false,
    props: {
      color: "black",
      fill: "none",
      dash: "draw",
      size: "s",
      segments: compressLegacySegments([{ type: "free", points }]),
      isComplete: true,
      isClosed: false,
      isPen: false,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
    },
  }];
};

function toTldrawShapes(shape: SketchPrimitive): TLShapePartial[] {
  const common = { id: shapeId(shape.id), opacity: 1, isLocked: false };
  if (shape.type === "rect" || shape.type === "ellipse" || shape.type === "diamond") {
    return [{
      ...common,
      type: "geo",
      x: shape.x,
      y: shape.y,
      props: {
        geo: shape.type === "rect" ? "rectangle" : shape.type,
        w: shape.w,
        h: shape.h,
        color: "black",
        fill: shape.fill ? "semi" : "none",
        dash: "draw",
        size: "s",
        scale: 0.72,
        font: "draw",
        align: "start",
        verticalAlign: "start",
        labelColor: "black",
        richText: toRichText(shape.label ?? ""),
      },
    }];
  }
  if (shape.type === "note") {
    // Render notes as a filled geo rect with TWO overlapping outline rects
    // on top — each at a tiny rotation — so the border reads as a
    // hand-drawn multi-stroke wobble instead of a single clean line.
    const { w, h } = clampNoteSize(shape.w, shape.h);
    const fill: TLShapePartial = {
      ...common,
      type: "geo",
      x: shape.x,
      y: shape.y,
      props: {
        geo: "rectangle",
        w,
        h,
        color: geoNoteColor(shape.color),
        fill: "solid",
        dash: "draw",
        size: "s",
        scale: 0.64,
        font: "draw",
        align: "start",
        verticalAlign: "start",
        labelColor: "black",
        richText: toRichText(shape.text),
      },
    };
    const outline = (suffix: string, dx: number, dy: number, rot: number): TLShapePartial => ({
      id: shapeId(`${shape.id}-stroke-${suffix}`),
      type: "geo",
      x: shape.x + dx,
      y: shape.y + dy,
      rotation: rot,
      opacity: 0.85,
      isLocked: false,
      props: {
        geo: "rectangle",
        w,
        h,
        color: "black",
        fill: "none",
        dash: "draw",
        size: "s",
        scale: 0.64,
        font: "draw",
        align: "start",
        verticalAlign: "start",
        labelColor: "black",
        richText: toRichText(""),
      },
    });
    return [fill, outline("a", -1.5, -1, -0.006), outline("b", 1, 1.5, 0.008)];
  }
  if (shape.type === "text") {
    return [{
      ...common,
      type: "text",
      x: shape.x,
      y: shape.y,
      props: { color: "black", size: textSize(shape.size), font: "draw", textAlign: shape.align === "center" ? "middle" : shape.align === "right" ? "end" : "start", w: 360, scale: 0.58, richText: toRichText(shape.text), autoSize: true },
    }];
  }
  if (shape.type === "arrow") {
    return [{
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color: "black", fill: "none", dash: shape.dashed ? "dashed" : "draw", size: "s", arrowheadStart: "none", arrowheadEnd: "arrow", font: "draw", labelColor: "black", start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(shape.label ?? ""), labelPosition: 0.5, scale: 0.82, elbowMidPoint: 0.5 },
    }];
  }
  if (shape.type === "line") {
    return [sketchLine(shape.id, shape.x1, shape.y1, shape.x2, shape.y2, shape.dashed)];
  }
  if (shape.type === "path") {
    return pathToLine(shape);
  }
  if (shape.type === "stroke") {
    return strokeToDraw(shape);
  }
  if (shape.type === "icon") {
    const size = shape.size ?? 52;
    return [{
      ...common,
      type: "geo",
      x: shape.x,
      y: shape.y,
      props: { geo: shape.kind === "cloud" || shape.kind === "heart" || shape.kind === "star" ? shape.kind : shape.kind === "user" || shape.kind === "users" ? "ellipse" : "rectangle", w: size, h: size, color: "black", fill: "none", dash: "draw", size: "s", scale: 0.7, font: "draw", align: "middle", verticalAlign: "middle", labelColor: "black", richText: toRichText(shape.label ?? shape.kind) },
    }];
  }
  return [];
}

export function Canvas({
  shapes = [],
  drawingEnabled,
  onHasContentChange,
}: {
  shapes?: readonly SketchPrimitive[];
  drawingEnabled: boolean;
  onHasContentChange?: (hasContent: boolean) => void;
}) {
  const { setEditor } = useCanvas();
  const editorRef = useRef<Editor | null>(null);
  const createdShapeIdsRef = useRef(new Set<string>());
  const [mounted, setMounted] = useState(false);
  // v2.P6 — glow overlay: rects positioned over the shape bounds of a
  // reopened thread, pulse for ~3s so people can see the mediator returning
  // to an older idea instead of piling a fresh one beside it.
  const [glow, setGlow] = useState<Array<{ id: string; x: number; y: number; w: number; h: number; tone: "old" | "new" }>>([]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setEditor(editor);
      setMounted(true);
      // Light theme to match the editorial warm-paper surface.
      editor.user.updateUserPreferences({ colorScheme: "light" });
      editor.updateInstanceState({ isGridMode: true }, { history: "ignore" });
      editor.setCurrentTool(drawingEnabled ? "draw" : "select");
      const off = editor.store.listen(() => {
        onHasContentChange?.(editor.getCurrentPageShapeIds().size > 0);
      }, { source: "user", scope: "document" });
      return () => off();
    },
    [drawingEnabled, onHasContentChange, setEditor],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor) return;
    editor.setCurrentTool(drawingEnabled ? "draw" : "select");
  }, [drawingEnabled, mounted]);

  // Listen for external "focus these shapes" events (e.g. Threads rail click).
  // We resolve string ids to their tldraw shape ids (prefixed) and select+zoom.
  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    const handler = (ev: Event) => {
      const editor = editorRef.current;
      if (!editor) return;
      const detail = (ev as CustomEvent<{ ids?: string[] }>).detail;
      const rawIds = Array.isArray(detail?.ids) ? detail!.ids : [];
      if (!rawIds.length) return;
      const wanted = new Set(rawIds.map((id) => String(shapeId(id))));
      const present: string[] = [];
      for (const id of editor.getCurrentPageShapeIds()) {
        if (wanted.has(String(id))) present.push(String(id));
      }
      if (!present.length) return;
      editor.setCurrentTool("select");
      editor.select(...(present as unknown as Parameters<Editor["select"]>));
      try { editor.zoomToSelection({ animation: { duration: 320 } }); } catch { /* noop */ }
    };
    window.addEventListener("cartoonist:focus", handler as EventListener);
    return () => window.removeEventListener("cartoonist:focus", handler as EventListener);
  }, [mounted]);

  // v2.P6 — reopen glow: when the mediator extends/references/contradicts an
  // older thread, we get { oldIds, newIds } here. Position accent rings over
  // both sets in viewport coords, pulse for ~3s, then fade. Also zoom to fit
  // both sets so the connection is visible.
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;


    const handler = (ev: Event) => {
      const editor = editorRef.current;
      if (!editor) return;
      const detail = (ev as CustomEvent<{ oldIds?: string[]; newIds?: string[] }>).detail;
      const oldRaw = Array.isArray(detail?.oldIds) ? detail!.oldIds : [];
      const newRaw = Array.isArray(detail?.newIds) ? detail!.newIds : [];
      if (!oldRaw.length && !newRaw.length) return;
      const toRing = (raw: string[], tone: "old" | "new") =>
        raw.map((rid) => {
          const sid = String(shapeId(rid));
          const bounds = editor.getShapePageBounds(sid as unknown as Parameters<Editor["getShapePageBounds"]>[0]);
          if (!bounds) return null;
          const tl = editor.pageToViewport({ x: bounds.x, y: bounds.y });
          const br = editor.pageToViewport({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });
          return { id: sid, x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y, tone };
        }).filter(Boolean) as Array<{ id: string; x: number; y: number; w: number; h: number; tone: "old" | "new" }>;
      const rings = [...toRing(oldRaw, "old"), ...toRing(newRaw, "new")];
      if (!rings.length) return;


      setGlow(rings);
      // Select union and zoom so both regions are on-screen.
      const union = [...oldRaw, ...newRaw].map((r) => String(shapeId(r)));
      const present: string[] = [];
      const page = editor.getCurrentPageShapeIds();
      const want = new Set(union);
      for (const id of page) if (want.has(String(id))) present.push(String(id));
      if (present.length) {
        editor.setCurrentTool("select");
        editor.select(...(present as unknown as Parameters<Editor["select"]>));
        try { editor.zoomToSelection({ animation: { duration: 380 } }); } catch { /* noop */ }
      }
      window.setTimeout(() => setGlow([]), 3200);
    };
    window.addEventListener("cartoonist:reopen", handler as EventListener);
    return () => window.removeEventListener("cartoonist:reopen", handler as EventListener);
  }, [mounted]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor) return;
    const desired = shapes.flatMap(toTldrawShapes);
    const desiredById = new Map(desired.map((s) => [String(s.id), s]));
    // Current AI-authored shapes on the page (anything we created before).
    const currentAiIds = new Set<string>();
    for (const id of editor.getCurrentPageShapeIds()) {
      if (String(id).startsWith("shape:cartoonist-")) currentAiIds.add(String(id));
    }
    const toCreate: TLShapePartial[] = [];
    const toUpdate: TLShapePartial[] = [];
    for (const [id, shape] of desiredById) {
      if (currentAiIds.has(id)) toUpdate.push(shape);
      else toCreate.push(shape);
    }
    const toDelete: string[] = [];
    for (const id of currentAiIds) {
      if (!desiredById.has(id)) toDelete.push(id);
    }
    if (!toCreate.length && !toUpdate.length && !toDelete.length) return;
    editor.run(() => {
      if (toDelete.length) editor.deleteShapes(toDelete as unknown as Parameters<Editor["deleteShapes"]>[0]);
      if (toUpdate.length) editor.updateShapes(toUpdate);
      if (toCreate.length) editor.createShapes(toCreate);
      toCreate.forEach((s) => createdShapeIdsRef.current.add(String(s.id)));
    }, { history: "record" });
    onHasContentChange?.(editor.getCurrentPageShapeIds().size > 0);
  }, [mounted, onHasContentChange, shapes]);

  return (
    <div className="absolute inset-0 bg-background">
      <Tldraw hideUi onMount={handleMount} />
      {glow.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {glow.map((r, i) => (
            <div
              key={`${r.id}-${i}`}
              className="cartoonist-glow-ring"
              data-tone={r.tone}
              style={{ left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
