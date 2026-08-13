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
          className="mb-1 flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </button>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => { onActive(t.id); onOpen(true); }}
            className="relative flex h-7 w-7 items-center justify-center border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground"
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
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-stretch border-b border-border">
        <div className="flex min-w-0 flex-1 items-stretch">
          {tabs.map((t) => {
            const on = t.id === current.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onActive(t.id)}
                aria-pressed={on}
                title={t.label}
                className={`flex flex-1 items-center justify-center gap-1 border-r border-border px-1 py-2 transition ${
                  on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                {on && <span className="eyebrow truncate">{t.label}</span>}
                {!!t.count && <span className="eyebrow tabular-nums opacity-70">{t.count}</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onOpen(false)}
          title="Collapse panel"
          className="flex w-8 items-center justify-center text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{current.node}</div>
    </aside>
  );
}
