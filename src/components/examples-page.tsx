import { useEffect, useMemo, useState } from "react";
import { Canvas } from "./canvas/Canvas";
import { CanvasProvider, useCanvas } from "./canvas/canvas-context";
import { BLUEPRINTS } from "@/lib/blueprints";
import { setRenderStyle, useRenderStyle, type Fidelity, type Ink } from "@/lib/render-style";

function Stage({ blueprintId }: { blueprintId: string }) {
  const { editor } = useCanvas();
  const rs = useRenderStyle();
  const shapes = useMemo(() => {
    const bp = BLUEPRINTS.find((b) => b.id === blueprintId) ?? BLUEPRINTS[0];
    return bp.build(80, 80);
  }, [blueprintId]);

  useEffect(() => {
    if (!editor) return;
    const t = setTimeout(() => {
      try {
        editor.zoomToFit({ animation: { duration: 220 } });
      } catch {
        /* editor not ready */
      }
    }, 160);
    return () => clearTimeout(t);
  }, [editor, blueprintId, rs.fidelity, rs.ink]);

  return <Canvas shapes={shapes} drawingEnabled={false} />;
}

const FIDELITY: Array<{ id: Fidelity; label: string }> = [
  { id: "lofi", label: "Low" },
  { id: "mid", label: "Mid" },
  { id: "hifi", label: "High" },
];

const INK: Array<{ id: Ink; label: string }> = [
  { id: "pencil", label: "pencil" },
  { id: "clean", label: "clean" },
];

export default function ExamplesPage() {
  const [active, setActive] = useState(BLUEPRINTS[0].id);
  const rs = useRenderStyle();
  const current = BLUEPRINTS.find((b) => b.id === active) ?? BLUEPRINTS[0];

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* 1 — small page header. No boxes: alignment and weight do the work. */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-8 gap-y-3 px-6 pb-3 pt-4">
        <div className="flex items-baseline gap-4">
          <a href="/" className="font-display font-bold no-underline" style={{ fontSize: "var(--step-3)" }}>
            Cartoonist
          </a>
          <span className="text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
            One output per example, drawn from a real session.
          </span>
        </div>

        {/* 3 — one rendering control. Fidelity is the idea. */}
        <div className="flex items-center gap-2">
          <span className="eyebrow font-mono text-muted-foreground">FIDELITY</span>
          <div className="flex items-center border border-foreground">
            {FIDELITY.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRenderStyle({ fidelity: f.id })}
                aria-pressed={rs.fidelity === f.id}
                className={`press h-7 px-3 uppercase tracking-[0.16em] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  rs.fidelity === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontSize: "var(--step-0)" }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 2 — one restrained example selector */}
      <nav className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-1 border-b border-foreground px-6 pb-2">
        {BLUEPRINTS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActive(b.id)}
            aria-current={active === b.id ? "true" : undefined}
            className={`press -mb-px border-b-2 pb-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active === b.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontSize: "var(--step-2)" }}
          >
            {b.label}
          </button>
        ))}
      </nav>

      {/* 4 — the artifact takes everything that's left */}
      <div className="relative flex-1">
        <CanvasProvider>
          <Stage blueprintId={active} />
        </CanvasProvider>
      </div>

      {/* 5 — small metadata caption */}
      <footer className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-t border-border px-6 py-2 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
        <span className="uppercase tracking-[0.16em] text-foreground">{current.label}</span>
        <span>{current.blurb}</span>
        <span className="uppercase tracking-[0.16em]">{current.output}</span>
        <span className="uppercase tracking-[0.16em]">fidelity {rs.fidelity}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="uppercase tracking-[0.16em]">line</span>
          {INK.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setRenderStyle({ ink: i.id })}
              aria-pressed={rs.ink === i.id}
              className={`press underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                rs.ink === i.id ? "text-foreground underline" : "hover:text-foreground"
              }`}
            >
              {i.label}
            </button>
          ))}
        </span>
      </footer>
    </main>
  );
}
