import { useCallback, useEffect, useRef, useState } from "react";
import { compressLegacySegments, getIndices, Tldraw, type Editor, type TLShapePartial } from "tldraw";
import "tldraw/tldraw.css";
import { useCanvas } from "./canvas-context";
import type { SketchPrimitive } from "@/lib/sketch-types";
import { useRenderStyle, type Fidelity, type RenderStyle } from "@/lib/render-style";

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

type CanvasTone = NonNullable<SketchPrimitive["tone"]>;

// Color depends on fidelity: lo-fi is a pure graphite sketch, mid keeps one
// accent plus state colors, hi-fi uses the full semantic palette.
const toneColor = (tone: CanvasTone | undefined, fidelity: Fidelity) => {
  if (fidelity === "lofi") return tone === "surface" ? "white" : tone === "muted" || tone === "subtle" ? "grey" : "black";
  if (tone === "accent") return "orange";
  if (tone === "muted") return "grey";
  if (tone === "success") return fidelity === "hifi" ? "green" : "black";
  if (tone === "danger") return "red";
  if (tone === "subtle") return "grey";
  if (tone === "surface") return "white";
  return "black";
};

// Never "semi" — tldraw's semi fill is the translucent wash that made shapes
// look like ghosts. Fills are either fully opaque or absent.
const toneFill = (shape: SketchPrimitive, fidelity: Fidelity): "none" | "solid" => {
  if (fidelity === "lofi") return "none";
  const tone = shape.tone;
  const explicit = "fill" in shape && Boolean(shape.fill);
  if (fidelity === "mid") {
    return explicit || tone === "accent" || tone === "danger" || tone === "success" ? "solid" : "none";
  }
  return explicit || tone === "surface" || tone === "subtle" || tone === "accent" || tone === "success" || tone === "danger"
    ? "solid"
    : "none";
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

function toTldrawShapes(shape: SketchPrimitive, rs: RenderStyle): TLShapePartial[] {
  const common = { id: shapeId(shape.id), opacity: 1, isLocked: false };
  // "clean" ink always draws geometric shapes; "pencil" always draws by hand,
  // regardless of what the AI tagged the primitive as.
  const isUi = rs.ink === "clean";
  const color = toneColor(shape.tone, rs.fidelity);
  const dash = isUi ? "solid" : "draw";
  const font = isUi ? "sans" : "draw";

  if (shape.type === "rect" || shape.type === "ellipse" || shape.type === "diamond") {
    // A label that can't fit the box gets wrapped one letter per line by
    // tldraw. In dense wireframes that reads as garbage, so any label too
    // wide for its box is lifted out into a free text primitive beside it.
    const label = (shape.label ?? "").trim();
    // Hard guard: the model occasionally omits w/h or emits NaN, and tldraw's
    // validator throws (crashing the whole canvas) instead of skipping it.
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    const bw = Math.max(2, num(shape.w, 160));
    const bh = Math.max(2, num(shape.h, 60));
    const fitsInside = label.length > 0 && bw >= label.length * 6.2 + 14 && bh >= 22;
    const box: TLShapePartial = {
      ...common,
      type: "geo",
      x: num(shape.x, 0),
      y: num(shape.y, 0),
      props: {
        geo: shape.type === "rect" ? "rectangle" : shape.type,
        w: bw,
        h: bh,
        color,
        fill: toneFill(shape, rs.fidelity),
        dash,
        size: "s",
        scale: isUi ? 1 : 0.72,
        font,
        align: "start",
        verticalAlign: "start",
        labelColor: shape.tone === "accent" ? "white" : color,
        richText: toRichText(fitsInside ? label : ""),
      },
    };
    if (label && !fitsInside) {
      return [box, {
        id: shapeId(`${shape.id}-lbl`),
        type: "text",
        x: num(shape.x, 0) + bw + 6,
        y: num(shape.y, 0) + Math.max(0, bh / 2 - 8),
        props: { color, size: "s", font, textAlign: "start", w: 260, scale: isUi ? 0.72 : 0.5, richText: toRichText(label), autoSize: true },
      } as TLShapePartial];
    }
    return [box];
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
        color: rs.fidelity === "lofi" ? "grey" : geoNoteColor(shape.color),
        fill: "solid",
        dash,
        size: "s",
        scale: 0.64,
        font,
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
        dash,
        size: "s",
        scale: 0.64,
        font,
        align: "start",
        verticalAlign: "start",
        labelColor: "black",
        richText: toRichText(""),
      },
    });
    // Clean ink gets a single crisp border; pencil ink gets the multi-stroke wobble.
    return isUi ? [fill, outline("a", 0, 0, 0)] : [fill, outline("a", -1.5, -1, -0.006), outline("b", 1, 1.5, 0.008)];

  }
  if (shape.type === "text") {
    return [{
      ...common,
      type: "text",
      x: shape.x,
      y: shape.y,
      props: { color, size: textSize(shape.size), font, textAlign: shape.align === "center" ? "middle" : shape.align === "right" ? "end" : "start", w: 360, scale: isUi ? 0.72 : 0.58, richText: toRichText(shape.text), autoSize: true },
    }];
  }
  if (shape.type === "arrow") {
    return [{
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color: "black", fill: "none", dash: shape.dashed ? "dashed" : dash, size: "s", arrowheadStart: "none", arrowheadEnd: "arrow", font, labelColor: "black", start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(shape.label ?? ""), labelPosition: 0.5, scale: 0.82, elbowMidPoint: 0.5 },
    }];
  }
  if (shape.type === "line") {
    if (!isUi) return [sketchLine(shape.id, shape.x1, shape.y1, shape.x2, shape.y2, shape.dashed)];
    return [{
      ...common,
      type: "arrow",
      x: shape.x1,
      y: shape.y1,
      props: { kind: "arc", color, fill: "none", dash: shape.dashed ? "dashed" : "solid", size: "s", arrowheadStart: "none", arrowheadEnd: "none", font: "sans", labelColor: color, start: { x: 0, y: 0 }, end: { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 }, bend: 0, richText: toRichText(""), labelPosition: 0.5, scale: 1, elbowMidPoint: 0.5 },
    }];
  }
  if (shape.type === "path") {
    return pathToLine(shape);
  }
  if (shape.type === "stroke") {
    return strokeToDraw(shape);
  }
  if (shape.type === "icon") {
    const size = shape.size ?? 52;
    // Small icons are glyphs, not labelled boxes. Cramming a word into a
    // 16px square makes tldraw wrap it one letter per line ("i-c-o-n"), which
    // is what made dense wireframes look broken. Label goes beside it instead.
    const label = (shape.label ?? "").trim();
    const showInside = size >= 44 && label.length > 0 && label.length <= 10;
    const out: TLShapePartial[] = [{
      ...common,
      type: "geo",
      x: shape.x,
      y: shape.y,
      props: { geo: shape.kind === "cloud" || shape.kind === "heart" || shape.kind === "star" ? shape.kind : shape.kind === "user" || shape.kind === "users" ? "ellipse" : "rectangle", w: size, h: size, color, fill: "none", dash, size: "s", scale: isUi ? 1 : 0.7, font, align: "middle", verticalAlign: "middle", labelColor: color, richText: toRichText(showInside ? label : "") },
    }];
    if (label && !showInside && size >= 26) {
      out.push({
        id: shapeId(`${shape.id}-lbl`),
        type: "text",
        x: shape.x + size + 6,
        y: shape.y + size / 2 - 8,
        props: { color, size: "s", font, textAlign: "start", w: 260, scale: isUi ? 0.72 : 0.5, richText: toRichText(label), autoSize: true },
      } as TLShapePartial);
    }
    return out;
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
  // id → serialized shape, so incremental batches only touch what changed.
  const shapeSigRef = useRef(new Map<string, string>());
  const [mounted, setMounted] = useState(false);
  // v2.P6 — glow overlay: rects positioned over the shape bounds of a
  // reopened thread, pulse for ~3s so people can see the mediator returning
  // to an older idea instead of piling a fresh one beside it.
  // We keep the reopened shape IDs + tone here and reproject to viewport
  // coords every frame during the pulse, so the rings stay glued to the
  // shapes even while the camera is animating from zoomToSelection.
  const [glowTargets, setGlowTargets] = useState<Array<{ id: string; tone: "old" | "new" }>>([]);
  const [glow, setGlow] = useState<Array<{ id: string; x: number; y: number; w: number; h: number; tone: "old" | "new" }>>([]);
  // v2.P6 — persistent relation chips. Populated from a `cartoonist:relations`
  // event fired by canvas-room whenever threads change. Positions reproject
  // every animation frame so chips stay glued to shapes as the camera moves.
  const [relationTargets, setRelationTargets] = useState<Array<{ id: string; threadId: string; relation: string; peer: string }>>([]);
  const [relations, setRelations] = useState<Array<{ id: string; threadId: string; relation: string; peer: string; x: number; y: number }>>([]);
  const [openRelation, setOpenRelation] = useState<{ threadId: string; relation: string; peer: string; x: number; y: number } | null>(null);


  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setEditor(editor);
      setMounted(true);
      // Expose for E2E/debug harnesses. Cheap and safe in prod.
      if (typeof window !== "undefined") {
        (window as unknown as { __cartoonistEditor?: Editor }).__cartoonistEditor = editor;
      }
      // Light theme to match the editorial warm-paper surface.
      editor.user.updateUserPreferences({ colorScheme: "light" });
      editor.updateInstanceState({ isGridMode: true }, { history: "ignore" });
      // Sweep corrupt shapes left behind by older sessions (NaN geometry in
      // the local store hydrates before us and crashes the whole board).
      try {
        const bad: string[] = [];
        for (const id of editor.getCurrentPageShapeIds()) {
          const s = editor.getShape(id) as { x?: number; y?: number; props?: Record<string, unknown> } | undefined;
          if (!s) continue;
          const nums = [s.x, s.y, ...Object.values(s.props ?? {})];
          if (nums.some((v) => typeof v === "number" && !Number.isFinite(v))) bad.push(String(id));
        }
        if (bad.length) editor.deleteShapes(bad as unknown as Parameters<Editor["deleteShapes"]>[0]);
      } catch {
        /* nothing to sweep */
      }
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
      const toTargets = (raw: string[], tone: "old" | "new") =>
        raw.map((rid) => ({ id: String(shapeId(rid)), tone }));
      const targets = [...toTargets(oldRaw, "old"), ...toTargets(newRaw, "new")];
      // Only keep targets that actually exist on the page.
      const page = editor.getCurrentPageShapeIds();
      const present = new Set<string>();
      for (const id of page) present.add(String(id));
      const alive = targets.filter((t) => present.has(t.id));
      if (!alive.length) return;
      setGlowTargets(alive);
      // Select union and zoom so both regions are on-screen. Rings track
      // via the rAF projection loop below.
      editor.setCurrentTool("select");
      editor.select(...(alive.map((t) => t.id) as unknown as Parameters<Editor["select"]>));
      try { editor.zoomToSelection({ animation: { duration: 380 } }); } catch { /* noop */ }
      window.setTimeout(() => { setGlowTargets([]); setGlow([]); }, 3200);
    };

    window.addEventListener("cartoonist:reopen", handler as EventListener);
    return () => window.removeEventListener("cartoonist:reopen", handler as EventListener);
  }, [mounted]);

  // Reproject glow rings from page → viewport on each animation frame while
  // the pulse is active. This keeps rings glued to shapes during the
  // zoomToSelection camera animation. Perf: only commit to React state when
  // the projected geometry actually moved — otherwise a 60fps setState storm
  // re-renders the whole canvas subtree while the room sits idle.
  useEffect(() => {
    if (!glowTargets.length) { setGlow([]); return; }
    const editor = editorRef.current;
    if (!editor) return;
    let raf = 0;
    let prevKey = "";
    const tick = () => {
      const next: Array<{ id: string; x: number; y: number; w: number; h: number; tone: "old" | "new" }> = [];
      for (const t of glowTargets) {
        const bounds = editor.getShapePageBounds(t.id as unknown as Parameters<Editor["getShapePageBounds"]>[0]);
        if (!bounds) continue;
        const tl = editor.pageToViewport({ x: bounds.x, y: bounds.y });
        const br = editor.pageToViewport({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });
        next.push({ id: t.id, x: Math.round(tl.x), y: Math.round(tl.y), w: Math.round(br.x - tl.x), h: Math.round(br.y - tl.y), tone: t.tone });
      }
      const key = next.map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`).join("|");
      if (key !== prevKey) { prevKey = key; setGlow(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [glowTargets]);

  // v2.P6 — listen for relation updates from canvas-room. We map raw shape
  // ids to prefixed tldraw ids and store the list; positions are reprojected
  // per-frame in the effect below.
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: Array<{ id: string; threadId: string; relation: string; peer: string }> }>).detail;
      const items = Array.isArray(detail?.items) ? detail!.items : [];
      setRelationTargets(items.map((it) => ({ id: String(shapeId(it.id)), threadId: it.threadId, relation: it.relation, peer: it.peer })));
    };
    window.addEventListener("cartoonist:relations", handler as EventListener);
    return () => window.removeEventListener("cartoonist:relations", handler as EventListener);
  }, [mounted]);

  // Reproject relation chips per frame. Perf: `getCurrentPageShapeIds()` on a
  // 170-shape wireframe every frame plus an unconditional setState was the
  // single biggest source of idle jank — recompute the present-set at most
  // ~7x/sec and only commit when a chip actually moved.
  useEffect(() => {
    if (!mounted || !relationTargets.length) { setRelations([]); return; }
    const editor = editorRef.current;
    if (!editor) return;
    let raf = 0;
    let prevKey = "";
    let present = new Set<string>();
    let lastScan = 0;
    const tick = () => {
      const now = performance.now();
      if (now - lastScan > 140) {
        lastScan = now;
        const scan = new Set<string>();
        for (const id of editor.getCurrentPageShapeIds()) scan.add(String(id));
        present = scan;
      }
      const next: Array<{ id: string; threadId: string; relation: string; peer: string; x: number; y: number }> = [];
      for (const t of relationTargets) {
        if (!present.has(t.id)) continue;
        const bounds = editor.getShapePageBounds(t.id as unknown as Parameters<Editor["getShapePageBounds"]>[0]);
        if (!bounds) continue;
        const tr = editor.pageToViewport({ x: bounds.x + bounds.w, y: bounds.y });
        next.push({ id: t.id, threadId: t.threadId, relation: t.relation, peer: t.peer, x: Math.round(tr.x), y: Math.round(tr.y) });
      }
      const key = next.map((n) => `${n.id}:${n.x},${n.y}`).join("|");
      if (key !== prevKey) { prevKey = key; setRelations(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mounted, relationTargets]);





  useEffect(() => {
    const editor = editorRef.current;
    if (!mounted || !editor) return;
    // Guard: a single malformed primitive (NaN coords from legacy/replayed
    // events) must never take the whole board down.
    const finite = (v: unknown): boolean =>
      typeof v !== "number" || Number.isFinite(v);
    const isSane = (s: TLShapePartial): boolean => {
      if (!finite(s.x) || !finite(s.y)) return false;
      const props = (s.props ?? {}) as Record<string, unknown>;
      return Object.values(props).every((v) => finite(v));
    };
    const desired = shapes.flatMap(toTldrawShapes).filter(isSane);
    const desiredById = new Map(desired.map((s) => [String(s.id), s]));
    // Current AI-authored shapes on the page (anything we created before).
    const currentAiIds = new Set<string>();
    for (const id of editor.getCurrentPageShapeIds()) {
      if (String(id).startsWith("shape:cartoonist-")) currentAiIds.add(String(id));
    }
    const toCreate: TLShapePartial[] = [];
    const toUpdate: TLShapePartial[] = [];
    const nextSig = new Map<string, string>();
    for (const [id, shape] of desiredById) {
      const sig = JSON.stringify(shape);
      nextSig.set(id, sig);
      if (!currentAiIds.has(id)) { toCreate.push(shape); continue; }
      // Perf: only push shapes whose serialized form actually changed. Before
      // this, every incremental batch re-updated all ~170 wireframe shapes.
      if (shapeSigRef.current.get(id) !== sig) toUpdate.push(shape);
    }
    const toDelete: string[] = [];
    for (const id of currentAiIds) {
      if (!desiredById.has(id)) toDelete.push(id);
    }
    shapeSigRef.current = nextSig;
    if (!toCreate.length && !toUpdate.length && !toDelete.length) return;
    try {
      editor.run(() => {
        if (toDelete.length) editor.deleteShapes(toDelete as unknown as Parameters<Editor["deleteShapes"]>[0]);
        if (toUpdate.length) editor.updateShapes(toUpdate);
        if (toCreate.length) editor.createShapes(toCreate);
        toCreate.forEach((s) => createdShapeIdsRef.current.add(String(s.id)));
        // AI batches don't belong in the user's undo stack — recording 170
        // shape creations made every subsequent interaction sluggish.
      }, { history: "ignore" });
    } catch (err) {
      console.warn("[canvas] skipped a bad shape batch", err);
    }
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
      {relations.length > 0 && (
        <div className="absolute inset-0 z-10" style={{ pointerEvents: "none" }}>
          {relations.map((r) => (
            <button
              key={`rel-${r.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenRelation({ threadId: r.threadId, relation: r.relation, peer: r.peer, x: r.x, y: r.y });
              }}
              title={`${r.relation} — click to see linked thread`}
              className="cartoonist-relation-chip"
              style={{ left: r.x - 10, top: r.y - 12, pointerEvents: "auto" }}
            >
              ↗
            </button>
          ))}
        </div>
      )}
      {openRelation && (
        <div
          className="cartoonist-relation-peek"
          style={{ left: Math.min(openRelation.x + 6, (typeof window !== "undefined" ? window.innerWidth : 1200) - 320), top: openRelation.y + 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--primary)" }}>
            ↗ {openRelation.relation} — linked thread
          </div>
          <div className="font-serif text-foreground" style={{ fontSize: "var(--step-0)", lineHeight: 1.4 }}>
            {openRelation.peer || "(no transcript)"}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="border border-border px-2 py-0.5 text-[11px] hover:border-foreground"
              onClick={() => {
                setOpenRelation(null);
              }}
            >
              Close
            </button>
            <button
              type="button"
              className="border border-border px-2 py-0.5 text-[11px] hover:border-foreground"
              onClick={() => {
                if (typeof window === "undefined") return;
                // Focus the thread that has this shape's threadId → find its shape ids.
                const targets = relationTargets.filter((rt) => rt.threadId === openRelation.threadId).map((rt) => rt.id.replace(/^shape:cartoonist-/, ""));
                window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids: targets } }));
                setOpenRelation(null);
              }}
            >
              Jump to thread
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
