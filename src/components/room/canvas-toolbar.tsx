import { Check, Pencil, MousePointer2, SlidersHorizontal } from "lucide-react";
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
  onKeepDrawing,
}: {
  drawing: boolean;
  onToggleDraw: () => void;
  onKeepDrawing: () => void;
}) {
  const cell = (active: boolean) =>
    `flex h-8 items-center gap-1.5 px-2.5 max-[479px]:w-9 max-[479px]:justify-center max-[479px]:px-0 transition active:scale-[0.98] ${
      active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="absolute left-4 top-4 z-20 flex items-center gap-px border border-border bg-background">
      <button type="button" onClick={() => drawing && onToggleDraw()} className={cell(!drawing)} title="Select (Esc)" aria-label="Select">
        <MousePointer2 className="h-3.5 w-3.5" />
        <span className="eyebrow max-[479px]:hidden">Select</span>
      </button>
      <span className="h-8 w-px bg-border" aria-hidden />
      <button type="button" onClick={() => !drawing && onToggleDraw()} className={cell(drawing)} title="Draw on the canvas" aria-label="Draw">
        <Pencil className="h-3.5 w-3.5" />
        <span className="eyebrow max-[479px]:hidden">Draw</span>
      </button>
      <span className="h-8 w-px bg-border" aria-hidden />
      <button type="button" onClick={onKeepDrawing} className={cell(false)} title="Keep the selected Cartoonist drawing" aria-label="Keep selected">
        <Check className="h-3.5 w-3.5" />
        <span className="eyebrow max-[479px]:hidden">Keep selected</span>
      </button>
      <span className="h-8 w-px bg-border" aria-hidden />
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cell(false)} title="How Cartoonist renders what it draws" aria-label="Output style">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="eyebrow max-[479px]:hidden">Output style</span>
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
