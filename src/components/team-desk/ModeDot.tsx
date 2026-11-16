import type { ParticipantMode } from "./use-participant-state";

// 6px solid disc in participant color; desaturated when quiet.
// Border + lightness only — no drop shadow (per design memory).
export function ModeDot({ mode, color }: { mode: ParticipantMode; color: string }) {
  const active = mode !== "quiet";
  const pulse = mode === "speaking";
  return (
    <span
      className="relative inline-flex h-2.5 w-2.5 items-center justify-center"
      title={mode}
      aria-label={`mode ${mode}`}
    >
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full animate-pulse"
          style={{ backgroundColor: color, opacity: 0.45 }}
        />
      )}
      <span
        className="relative inline-block h-1.5 w-1.5"
        style={{
          backgroundColor: color,
          opacity: active ? 1 : 0.3,
          filter: active ? "none" : "grayscale(0.6)",
        }}
      />
    </span>
  );
}
