import { Pencil, MousePointer2, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StyleSwitch } from "@/components/canvas/style-switch";

/**
 * Floating canvas toolbar — top-left of the stage.
 * Only canvas-creation concerns live here. Everything about how Cartoonist
 * renders its output sits behind the single "Output style" popover.
 */
export function CanvasToolbar({
  drawing,
  onToggleDraw,
}: {
  drawing: boolean;
  onToggleDraw: () => void;
}) {
  const cell = (active: boolean) =>
    `flex h-8 items-center gap-1.5 px-2.5 transition ${
      active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="absolute left-4 top-4 z-20 flex items-center gap-px border border-border bg-background">
      <button type="button" onClick={() => drawing && onToggleDraw()} className={cell(!drawing)} title="Select (Esc)">
        <MousePointer2 className="h-3.5 w-3.5" />
        <span className="eyebrow">Select</span>
      </button>
      <span className="h-8 w-px bg-border" aria-hidden />
      <button type="button" onClick={() => !drawing && onToggleDraw()} className={cell(drawing)} title="Draw on the canvas">
        <Pencil className="h-3.5 w-3.5" />
        <span className="eyebrow">Draw</span>
      </button>
      <span className="h-8 w-px bg-border" aria-hidden />
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cell(false)} title="How Cartoonist renders what it draws">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="eyebrow">Output style</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-auto rounded-none border-foreground p-3">
          <p className="eyebrow text-foreground">Output style</p>
          <p className="mb-2.5 mt-1 max-w-[34ch] text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            Applies to everything Cartoonist draws — sketchy and loose through to production detail.
          </p>
          <StyleSwitch />
        </PopoverContent>
      </Popover>
    </div>
  );
}
