import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, type Editor, type TLShapePartial } from "tldraw";
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
  w: Math.min(Math.max(w ?? 156, 120), 320),
  h: Math.min(Math.max(h ?? 118, 86), 128),
});

function toTldrawShape(shape: SketchPrimitive): TLShapePartial | null {
  const common = { id: shapeId(shape.id), opacity: 1, isLocked: false };
  if (shape.type === "rect" || shape.type === "ellipse" || shape.type === "diamond") {
    return {
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
    };
  }
  if (shape.type === "note") {
    // Render notes as filled geo rectangles so we control w/h and text size.
    const { w, h } = clampNoteSize(shape.w, shape.h);
    return {
      ...common,
      type: "geo",
      x: shape.x,
      y: shape.y,
      props: {
        geo: "rectangle",
        w,
        h,
        color: geoNoteColor(shape.color),
        fill: "semi",
        dash: "draw",
        size: "s",
        scale: 0.58,
        font: "draw",
        align: "middle",
        verticalAlign: "middle",
        labelColor: "black",
        richText: toRichText(shape.text),
      },
    };
  }
  if (shape.type === "text") {
    return {
      ...common,
      type: "text",
      x: shape.x,
      y: shape.y,
      props: { color: "black", size: textSize(shape.size), font: "draw", textAlign: shape.align === "center" ? "middle" : shape.align === "right" ? "end" : "start", w: 360, scale: 0.62, richText: toRichText(shape.text), autoSize: true },
    };
  }
  if (shape.type === "arrow") {
    return {
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color: "black", fill: "none", dash: shape.dashed ? "dashed" : "draw", size: "s", arrowheadStart: "none", arrowheadEnd: "arrow", font: "draw", labelColor: "black", start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(shape.label ?? ""), labelPosition: 0.5, scale: 0.82, elbowMidPoint: 0.5 },
    };
  }
  if (shape.type === "line") {
    return {
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color: "black", fill: "none", dash: shape.dashed ? "dashed" : "draw", size: "s", arrowheadStart: "none", arrowheadEnd: "none", font: "draw", labelColor: "black", start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(""), labelPosition: 0.5, scale: 0.82, elbowMidPoint: 0.5 },
    };
  }
  return null;
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

  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor) return;
    const nextShapes = shapes.map(toTldrawShape).filter((s): s is TLShapePartial => Boolean(s));
    const fresh = nextShapes.filter((shape) => !createdShapeIdsRef.current.has(String(shape.id)));
    if (!fresh.length) return;
    editor.createShapes(fresh);
    fresh.forEach((shape) => createdShapeIdsRef.current.add(String(shape.id)));
    onHasContentChange?.(editor.getCurrentPageShapeIds().size > 0);
  }, [mounted, onHasContentChange, shapes]);

  return (
    <div className="absolute inset-0 bg-background">
      <Tldraw hideUi onMount={handleMount} />
    </div>
  );
}
