import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const STAGES = ["listening", "interpreting", "drawing", "resolving"] as const;
export type Stage = (typeof STAGES)[number];

type Line = { who: string; text: string; mark?: boolean; target?: { x: number; y: number } };

/** Marked phrases carry the canvas coordinate of the object they produced. */
const TRANSCRIPT: Line[] = [
  { who: "MAYA", text: "So onboarding drops people straight into an empty room." },
  { who: "DEV", text: "Right — nobody knows what to do first.", mark: true, target: { x: 176, y: 52 } },
  { who: "PRIYA", text: "Could we walk them through one real session instead?", mark: true, target: { x: 104, y: 158 } },
  { who: "MAYA", text: "Then the room is already full of their own stuff." },
];

const VB = { w: 420, h: 260 };

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

type Link = { from: { x: number; y: number }; to: { x: number; y: number }; len: number };

/**
 * The hero *is* the product: a transcript enters, phrases get marked, a thin
 * connector leaves the sentence and terminates at the object it produced, and
 * the translucent drafting layer lifts off the resolved interface underneath.
 */
export function WorkingSurface({ stage, index }: { stage: Stage; index: number }) {
  const resolved = index >= 3;
  const drawing = index >= 2;
  const interpreting = index >= 1;

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const phraseRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const svg = svgRef.current;
      if (!wrap || !svg) return;
      const w = wrap.getBoundingClientRect();
      const s = svg.getBoundingClientRect();
      if (s.width < 40) return setLinks([]);
      const k = s.width / VB.w;
      const next: Link[] = [];
      TRANSCRIPT.forEach((line, i) => {
        const el = phraseRefs.current[i];
        if (!line.target || !el) return;
        const r = el.getBoundingClientRect();
        const from = { x: r.right - w.left + 2, y: r.bottom - w.top - 2 };
        const to = { x: s.left - w.left + line.target.x * k, y: s.top - w.top + line.target.y * k };
        next.push({ from, to, len: Math.hypot(to.x - from.x, to.y - from.y) * 1.35 + 40 });
      });
      setLinks(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [index]);

  return (
    <div ref={wrapRef} className="relative grid gap-px bg-border md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
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
              <span className="eyebrow tnum font-mono text-muted-foreground">{line.who}</span>
              <p className="mt-1 max-w-[38ch] leading-relaxed" style={{ fontSize: "var(--step-2)" }}>
                <span
                  ref={(el) => { phraseRefs.current[li] = el; }}
                  className="marker"
                  data-on={interpreting && line.mark ? "true" : "false"}
                >
                  {line.text}
                </span>
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

        <svg
          ref={svgRef}
          viewBox="0 0 420 260"
          fill="none"
          role="img"
          aria-label={`Cartoonist canvas, currently ${stage}`}
          className="mt-4 w-full text-foreground"
        >
          {/* tracing grid */}
          <g stroke="currentColor" opacity="0.07">
            {Array.from({ length: 8 }).map((_, i) => (
              <path key={`h${i}`} d={`M0 ${i * 32 + 16}H420`} />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <path key={`v${i}`} d={`M${i * 32 + 12} 0V260`} />
            ))}
          </g>

          {/* ---- committed layer: the resolved interface underneath ---- */}
          <g opacity={resolved ? 1 : drawing ? 0.35 : 0}
             style={{ transition: "opacity 520ms cubic-bezier(0.32,0.72,0,1)" }}>
            <g stroke="currentColor" strokeWidth="1.5" fill="var(--color-background)">
              <rect x="24" y="40" width="112" height="56" />
              <rect x="168" y="40" width="112" height="56" />
              <rect x="96" y="150" width="150" height="66" />
              <rect x="304" y="150" width="94" height="66" />
            </g>
            <g stroke="currentColor" strokeWidth="1.5" opacity="0.35" strokeLinecap="round">
              <path d="M34 84h60M178 84h84M106 200h96M314 200h58" />
            </g>
            <rect x="106" y="162" width="60" height="9" fill="var(--color-primary)" />
            <rect x="314" y="162" width="34" height="9" fill="var(--color-foreground)" opacity="0.15" />
          </g>

          {/* ---- drafting layer: translucent construction sitting on top ---- */}
          <g className="drafting-sheet" data-lifted={resolved ? "true" : "false"}>
            <rect x="8" y="18" width="404" height="228" fill="var(--color-primary)" opacity="0.05" />
            <rect x="8" y="18" width="404" height="228" stroke="var(--color-primary)" strokeWidth="1" opacity="0.25" fill="none" />
            {/* raw construction marks, before anything is grouped */}
            <g stroke="var(--color-primary)" strokeWidth="1" opacity={interpreting ? 0.3 : 0.6} strokeLinecap="round">
              <path d="M24 34v-8M136 34v-8M168 34v-8M280 34v-8M18 40h-8M18 96h-8" />
              <path d="M96 144v-8M246 144v-8M304 144v-8" />
            </g>
            <g stroke="var(--color-primary)" strokeWidth="1" className={interpreting ? "rough" : "rough"} fill="none"
               opacity={interpreting ? 1 : 0.4}>
              <rect x="24" y="40" width="112" height="56" />
              <rect x="168" y="40" width="112" height="56" />
              <rect x="96" y="150" width="150" height="66" />
              <rect x="304" y="150" width="94" height="66" />
            </g>
            {drawing && (
              <g stroke="var(--color-primary)" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <path className="trace-draw" style={{ ["--len" as string]: 40 }} d="M136 68h32" />
                <path className="trace-draw" style={{ ["--len" as string]: 140, animationDelay: "120ms" }} d="M80 96c0 34 46 22 76 54" />
                <path className="trace-draw" style={{ ["--len" as string]: 140, animationDelay: "220ms" }} d="M224 96c0 30-24 26-24 54" />
              </g>
            )}
            <g fill="var(--color-primary)" opacity="0.55" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.1em">
              <text x="30" y="34">{interpreting ? "SCREEN?" : "…"}</text>
              <text x="174" y="34">{interpreting ? "STATE?" : "…"}</text>
              <text x="102" y="146">{drawing ? "FLOW" : "…"}</text>
            </g>
          </g>

          {/* labels commit only once the drafting sheet lifts */}
          {resolved && (
            <g fill="currentColor" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.08em" className="fade-up-in">
              <text x="36" y="60">EMPTY ROOM</text>
              <text x="180" y="60">NO FIRST STEP</text>
              <text x="108" y="186">GUIDED SESSION</text>
              <text x="316" y="186">PRD DRAFT</text>
              <path stroke="currentColor" strokeWidth="1.5" d="M246 183h58" />
            </g>
          )}

          {/* participant cursor */}
          <g className="text-primary" style={{ transform: `translate(${drawing ? 250 : 150}px, ${drawing ? 108 : 132}px)`, transition: "transform 900ms cubic-bezier(0.32,0.72,0,1)" }}>
            <path d="M0 0l4 20 5-8 9 2z" fill="currentColor" />
            <rect x="10" y="18" width="46" height="16" fill="currentColor" />
            <text x="15" y="30" fontSize="9" letterSpacing="0.1em" fill="var(--color-background)" fontFamily="var(--font-mono)">PRIYA</text>
          </g>
        </svg>

        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
          <span>{resolved ? "2 decisions inferred" : "interpreting 2 phrases"}</span>
          <span aria-hidden>·</span>
          <span>1 unresolved question</span>
        </figcaption>
      </figure>

      {/* ---- the connector: this language produced that structure ---- */}
      {drawing && links.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" aria-hidden>
          {links.map((l, i) => {
            const dx = l.to.x - l.from.x;
            // Asymmetric control points: the line leaves the phrase decisively
            // and eases into its target, rather than a symmetric textbook curve.
            const c1 = l.from.x + dx * 0.58;
            const c2 = l.from.x + dx * 0.82;
            const delay = i * 140;
            return (
              <g key={i}>
                {/* departure tick: the connector is anchored to the phrase */}
                <path
                  className="connector-anchor"
                  style={{ animationDelay: `${delay}ms` }}
                  d={`M${l.from.x - 1} ${l.from.y - 4}v8`}
                />
                <path
                  className="connector"
                  style={{ ["--len" as string]: l.len, animationDelay: `${delay + 90}ms` }}
                  d={`M${l.from.x} ${l.from.y} C ${c1} ${l.from.y}, ${c2} ${l.to.y}, ${l.to.x} ${l.to.y}`}
                />
                {/* landing: a ring settles onto the point it produced */}
                <circle
                  className="connector-land-ring"
                  cx={l.to.x}
                  cy={l.to.y}
                  r="6"
                  style={{ animationDelay: `${delay + 690}ms` }}
                />
                <circle
                  className="connector-land"
                  cx={l.to.x}
                  cy={l.to.y}
                  r="2.5"
                  style={{ animationDelay: `${delay + 690}ms` }}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
