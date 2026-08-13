import { useEffect, useMemo, useState } from "react";
import { Canvas } from "./canvas/Canvas";
import { CanvasProvider, useCanvas } from "./canvas/canvas-context";
import { StyleSwitch } from "./canvas/style-switch";
import { BLUEPRINTS } from "@/lib/blueprints";
import { useRenderStyle } from "@/lib/render-style";

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

export default function ExamplesPage() {
  const [active, setActive] = useState(BLUEPRINTS[0].id);
  const current = BLUEPRINTS.find((b) => b.id === active) ?? BLUEPRINTS[0];

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-6 py-3">
        <div>
          <div className="eyebrow text-muted-foreground">RENDER SYSTEM</div>
          <h1 className="font-serif text-[22px] leading-tight">Fidelity &amp; ink, pushed to the max</h1>
        </div>
        <nav className="flex flex-wrap items-center border border-border">
          {BLUEPRINTS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActive(b.id)}
              title={b.blurb}
              className={`h-8 px-3 text-[11px] uppercase tracking-wider transition ${
                active === b.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <p className="hidden max-w-[38ch] text-[11px] leading-snug text-muted-foreground md:block">{current.blurb}</p>
          <StyleSwitch />
        </div>
      </header>
      <div className="relative flex-1">
        <CanvasProvider>
          <Stage blueprintId={active} />
        </CanvasProvider>
      </div>
    </main>
  );
}
