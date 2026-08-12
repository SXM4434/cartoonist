import { setRenderStyle, useRenderStyle, type Fidelity, type Ink } from "@/lib/render-style";

const FIDELITY: Array<{ id: Fidelity; label: string; hint: string }> = [
  { id: "lofi", label: "Lo", hint: "Lo-fi — graphite outlines, no fills" },
  { id: "mid", label: "Mid", hint: "Mid — one accent, flat emphasis fills" },
  { id: "hifi", label: "Hi", hint: "Hi-fi — full semantic surfaces" },
];

const INK: Array<{ id: Ink; label: string; hint: string }> = [
  { id: "pencil", label: "Pencil", hint: "Hand-drawn strokes" },
  { id: "clean", label: "Shapes", hint: "Crisp geometric shapes" },
];

/** Header control: how the canvas renders, independent of what the AI drew. */
export function StyleSwitch() {
  const rs = useRenderStyle();
  const cell = (active: boolean) =>
    `h-8 px-2 eyebrow transition ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center border border-border">
        {FIDELITY.map((f) => (
          <button key={f.id} type="button" title={f.hint} onClick={() => setRenderStyle({ fidelity: f.id })} className={cell(rs.fidelity === f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex items-center border border-border">
        {INK.map((i) => (
          <button key={i.id} type="button" title={i.hint} onClick={() => setRenderStyle({ ink: i.id })} className={cell(rs.ink === i.id)}>
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}
