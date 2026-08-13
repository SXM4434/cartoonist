import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RoomPanelTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  node: ReactNode;
};

/**
 * One right panel for every reference surface in the room.
 * It never dims or covers the canvas — opening Threads just switches the tab.
 * The tab strip is explicit navigation for a major region, so labels stay
 * visible; icons only take over once the panel is collapsed to the rail.
 */
export function RoomPanel({
  tabs,
  active,
  onActive,
  open,
  onOpen,
}: {
  tabs: RoomPanelTab[];
  active: string;
  onActive: (id: string) => void;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  if (!open) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-border bg-background py-2">
        <button
          type="button"
          onClick={() => onOpen(true)}
          title="Open panel"
          className="mb-1 flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98]"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </button>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => { onActive(t.id); onOpen(true); }}
            className="relative flex h-7 w-7 items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground active:scale-[0.98]"
          >
            <t.icon className="h-3.5 w-3.5" />
            {!!t.count && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 bg-primary" aria-hidden />
            )}
          </button>
        ))}
      </aside>
    );
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border pl-2.5 pr-1">
        <span className="eyebrow py-2 text-muted-foreground">Session panel</span>
        <button
          type="button"
          onClick={() => onOpen(false)}
          title="Collapse panel"
          className="flex h-7 w-7 items-center justify-center text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-[0.98]"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <nav className="flex flex-wrap items-stretch border-b border-border" aria-label="Panel sections">
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onActive(t.id)}
              aria-pressed={on}
              className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap border-b border-r border-border px-2 py-1.5 transition active:scale-[0.98] ${
                on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="eyebrow">{t.label}</span>
              {!!t.count && <span className="eyebrow tabular-nums opacity-70">{t.count}</span>}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">{current.node}</div>
    </aside>
  );
}
