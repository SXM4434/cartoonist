import { Mic, MicOff } from "lucide-react";

export function TranscriptPanel({
  partial,
  committed,
  isLive,
}: {
  partial: string;
  committed: string[];
  isLive: boolean;
}) {
  const hasContent = committed.length > 0 || partial.length > 0;

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
        <h3 className="font-serif text-lg font-semibold tracking-tight">Transcript</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <Mic className="h-3.5 w-3.5" /> Listening
            </>
          ) : (
            <>
              <MicOff className="h-3.5 w-3.5" /> Idle
            </>
          )}
        </div>
      </div>

      <div className="max-h-72 min-h-32 space-y-2 overflow-y-auto pr-2 leading-relaxed">
        {!hasContent && (
          <p className="text-sm italic text-muted-foreground">
            Press <span className="font-medium text-foreground">Start session</span> and speak —
            or load a sample transcript to skip the mic.
          </p>
        )}
        {committed.map((line, i) => (
          <p key={i} className="text-foreground">
            {line}
          </p>
        ))}
        {partial && (
          <p className="italic text-muted-foreground">{partial}</p>
        )}
      </div>
    </div>
  );
}
