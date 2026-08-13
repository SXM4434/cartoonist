import { useEffect, useState } from "react";

export const STAGES = ["listening", "interpreting", "drawing", "resolving"] as const;
export type Stage = (typeof STAGES)[number];

const TRANSCRIPT: { who: string; text: string; mark?: boolean }[] = [
  { who: "MAYA", text: "So onboarding drops people straight into an empty room." },
  { who: "DEV", text: "Right — nobody knows what to do first.", mark: true },
  { who: "PRIYA", text: "Could we walk them through one real session instead?", mark: true },
  { who: "MAYA", text: "Then the room is already full of their own stuff." },
];

/** Cycles through the four working states; pauses for reduced-motion users. */
export function useStageCycle(ms = 2600) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setI(STAGES.length - 1);
      return;
    }
    const t = setInterval(() => setI((v) => (v + 1) % STAGES.length), ms);
    return () => clearInterval(t);
  }, [ms]);
  return { stage: STAGES[i], index: i };
}

/**
 * The hero *is* the product: a transcript enters, phrases get marked,
 * a rough construction appears, and it resolves into structure.
 */
export function WorkingSurface({ stage, index }: { stage: Stage; index: number }) {
  const resolved = index >= 3;
  const drawing = index >= 2;
  const interpreting = index >= 1;

  return (
    <div className="grid gap-px bg-border md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
      {/* Transcript column */}
      <div className="bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow font-mono text-muted-foreground">Transcript · live</span>
          <span className="flex items-center gap-1.5 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            <i className="block h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
            REC
          </span>
        </div>
        <ol className="mt-5 space-y-4">
          {TRANSCRIPT.map((line, li) => (
            <li key={line.who + li} className="fade-up-in" style={{ animationDelay: `${li * 90}ms` }}>
              <span className="eyebrow tnum text-muted-foreground">{line.who}</span>
              <p className="mt-1 max-w-[38ch] leading-relaxed" style={{ fontSize: "var(--step-2)" }}>
                <span className="marker" data-on={interpreting && line.mark ? "true" : "false"}>{line.text}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* Canvas column */}
      <figure className="relative bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow font-mono text-muted-foreground">Canvas</span>
          <span
            className="border border-foreground px-2 py-0.5 font-mono uppercase tracking-[0.18em]"
            style={{ fontSize: "var(--step-0)" }}
            aria-live="polite"
          >
            {stage}
          </span>
        </div>

        <svg viewBox="0 0 420 260" fill="none" role="img" aria-label={`Cartoonist canvas, currently ${stage}`} className="mt-4 w-full text-foreground">
          {/* tracing grid */}
          <g stroke="currentColor" opacity="0.07">
            {Array.from({ length: 8 }).map((_, i) => (
              <path key={`h${i}`} d={`M0 ${i * 32 + 16}H420`} />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <path key={`v${i}`} d={`M${i * 32 + 12} 0V260`} />
            ))}
          </g>

          <g
            stroke="currentColor"
            strokeWidth={resolved ? 2 : 1}
            className={resolved ? "rough resolved" : "rough"}
            fill="none"
          >
            <rect x="24" y="40" width="112" height="56" />
            <rect x="168" y="40" width="112" height="56" />
            <rect x="96" y="150" width="150" height="66" />
            <rect x="304" y="150" width="94" height="66" />
          </g>

          {/* connectors — the Cartoonist line */}
          {drawing && (
            <g stroke="var(--color-primary)" strokeWidth="2" fill="none" strokeLinecap="round">
              <path className="trace-draw" style={{ ["--len" as string]: 40 }} d="M136 68h32" />
              <path className="trace-draw" style={{ ["--len" as string]: 140, animationDelay: "120ms" }} d="M80 96c0 34 46 22 76 54" />
              <path className="trace-draw" style={{ ["--len" as string]: 140, animationDelay: "220ms" }} d="M224 96c0 30-24 26-24 54" />
              {resolved && <path className="trace-draw" style={{ ["--len" as string]: 80 }} d="M246 183h58" />}
            </g>
          )}

          {/* labels appear only once structure resolves */}
          {resolved && (
            <g fill="currentColor" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.08em">
              <text x="36" y="72">EMPTY ROOM</text>
              <text x="180" y="72">NO FIRST STEP</text>
              <text x="108" y="186">GUIDED SESSION</text>
              <text x="316" y="186">PRD DRAFT</text>
            </g>
          )}
          {!resolved && (
            <g fill="currentColor" opacity="0.35" fontSize="11" fontFamily="var(--font-mono)">
              <text x="36" y="72">…</text>
              <text x="180" y="72">…</text>
              <text x="108" y="186">…</text>
            </g>
          )}

          {/* participant cursor */}
          <g className="text-primary" style={{ transform: `translate(${drawing ? 250 : 150}px, ${drawing ? 108 : 132}px)`, transition: "transform 900ms cubic-bezier(0.32,0.72,0,1)" }}>
            <path d="M0 0l4 20 5-8 9 2z" fill="currentColor" />
            <rect x="10" y="18" width="46" height="16" fill="currentColor" />
            <text x="15" y="30" fontSize="9" letterSpacing="0.1em" fill="var(--color-background)" fontFamily="var(--font-mono)">PRIYA</text>
          </g>
        </svg>

        {/* margin annotation */}
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
          <span>{resolved ? "2 decisions inferred" : "interpreting 2 phrases"}</span>
          <span aria-hidden>·</span>
          <span>1 unresolved question</span>
        </figcaption>
      </figure>
    </div>
  );
}
