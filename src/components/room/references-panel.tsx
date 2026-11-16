import { useState } from "react";
import { Pin, Search } from "lucide-react";
import type { WebReference } from "@/lib/web-reference";
import { Button } from "@/components/ui/button";

export function ReferencesPanel({
  results,
  saved,
  looking,
  looked,
  error,
  onLookup,
  onPin,
}: {
  results: WebReference[];
  saved: WebReference[];
  looking: boolean;
  looked?: boolean;
  error?: string | null;
  onLookup: (query: string) => void;
  onPin: (ref: WebReference) => void;
}) {
  const [q, setQ] = useState("");
  const submit = () => {
    if (!q.trim() || looking) return;
    onLookup(q);
    setQ("");
  };
  const pinnedUrls = new Set(saved.filter((item) => item.shapeId).map((item) => item.url));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Linear command bar"
          className="h-7 min-w-0 flex-1 border border-border bg-background px-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={submit}
          disabled={looking || !q.trim()}
          title="Look up a source"
          className="flex h-7 items-center gap-1 border border-border px-1.5 text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98] disabled:opacity-40"
        >
          <Search className={`h-3 w-3 ${looking ? "animate-pulse" : ""}`} />
          <span className="eyebrow">Look up</span>
        </Button>
      </div>

      {error && <p role="alert" className="px-2.5 py-2 text-[13px] text-destructive">{error}</p>}

      {results.length === 0 && saved.length === 0 ? (
        <p className="px-2.5 py-4 text-[13px] leading-[1.5] text-muted-foreground">
          {looked
            ? "No public source for that."
            : "Ask for a page, product, or article. Each result keeps its source URL."}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.length > 0 && (
            <ul>
              {results.map((ref) => (
                <ReferenceRow
                  key={ref.id}
                  refItem={ref}
                  pinned={pinnedUrls.has(ref.url)}
                  onPin={onPin}
                />
              ))}
            </ul>
          )}
          {saved.filter((item) => !results.some((result) => result.url === item.url)).length > 0 && (
            <>
              <p className="border-t border-border px-2.5 py-2 eyebrow text-muted-foreground">Saved</p>
              <ul>
                {saved
                  .filter((item) => !results.some((result) => result.url === item.url))
                  .map((ref) => (
                    <ReferenceRow
                      key={ref.id}
                      refItem={ref}
                      pinned={!!ref.shapeId}
                      onPin={onPin}
                    />
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReferenceRow({
  refItem,
  pinned,
  onPin,
}: {
  refItem: WebReference;
  pinned: boolean;
  onPin: (ref: WebReference) => void;
}) {
  return (
    <li className="border-b border-border px-2.5 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] leading-[1.5] text-foreground">{refItem.title}</span>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => onPin(refItem)}
          disabled={pinned}
          title={pinned ? "On the canvas" : "Pin to canvas"}
          className="flex h-6 w-6 shrink-0 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98] disabled:opacity-40"
        >
          <Pin className="h-3 w-3" />
        </Button>
      </div>
      {refItem.snippet ? (
        <p className="mt-1 text-[13px] leading-[1.5] text-muted-foreground">{refItem.snippet}</p>
      ) : null}
      <a
        href={refItem.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block truncate border-l-2 border-border pl-2 text-[13px] leading-[1.5] text-muted-foreground underline-offset-2 hover:underline"
      >
        {refItem.source ? `${refItem.source} · ` : ""}{refItem.url}
      </a>
    </li>
  );
}
