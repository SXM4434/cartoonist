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
const noteColor = (color?: "yellow" | "pink" | "blue" | "green") => {
  if (color === "pink") return "light-red";
  if (color === "blue") return "light-blue";
  if (color === "green") return "light-green";
  return "yellow";
};

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
        size: "m",
        font: "draw",
        align: "middle",
        verticalAlign: "middle",
        labelColor: "black",
        richText: toRichText(shape.label ?? ""),
      },
    };
  }
  if (shape.type === "note") {
    return {
      ...common,
      type: "note",
      x: shape.x,
      y: shape.y,
      props: { color: noteColor(shape.color), labelColor: "black", size: "m", font: "draw", richText: toRichText(shape.text) },
    };
  }
  if (shape.type === "text") {
    return {
      ...common,
      type: "text",
      x: shape.x,
      y: shape.y,
      props: { color: "black", size: shape.size && shape.size >= 22 ? "xl" : "m", font: "draw", textAlign: shape.align === "center" ? "middle" : shape.align === "right" ? "end" : "start", w: 420, richText: toRichText(shape.text), autoSize: true },
    };
  }
  if (shape.type === "arrow") {
    return {
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color: "black", fill: "none", dash: shape.dashed ? "dashed" : "draw", size: "m", arrowheadStart: "none", arrowheadEnd: "arrow", font: "draw", labelColor: "black", start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(shape.label ?? ""), labelPosition: 0.5, scale: 1, elbowMidPoint: 0.5 },
    };
  }
  if (shape.type === "line") {
    return {
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color: "black", fill: "none", dash: shape.dashed ? "dashed" : "draw", size: "m", arrowheadStart: "none", arrowheadEnd: "none", font: "draw", labelColor: "black", start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(""), labelPosition: 0.5, scale: 1, elbowMidPoint: 0.5 },
    };
  }
  return null;
}

export function Canvas({ shapes = [], onHasContentChange }: { shapes?: readonly SketchPrimitive[]; onHasContentChange?: (hasContent: boolean) => void }) {
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
      editor.setCurrentTool("draw");
      const off = editor.store.listen(() => {
        onHasContentChange?.(editor.getCurrentPageShapeIds().size > 0);
      }, { source: "user", scope: "document" });
      return () => off();
    },
    [onHasContentChange, setEditor],
  );

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
