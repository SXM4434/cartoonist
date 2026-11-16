import { useCallback, useEffect, useRef, useState } from "react";

/**
 * v1 P2.4 — partial artifacts while listening.
 *
 * Watches the running transcript and quietly re-drafts the artifact set in the
 * background so the Artifacts tab is already populated when someone opens it,
 * instead of being a cold "click to generate" surface. Drafts are cheap and
 * throttled: never more than once per `minIntervalMs`, and only after enough
 * new speech has landed to change the answer.
 */

const INTENT_RE =
  /\b(prd|spec|requirements?|user journey|journey map|wireframes?|action items?|next steps?|decisions?|roadmap|flow)\b/i;

export type LiveArtifactsOptions = {
  roomId: string;
  /** Full transcript so far (joined finals). */
  transcript: string;
  /** Per-user agent block, built lazily at draft time. */
  buildParticipantsBlock: () => Promise<string> | string;
  onDraft: (artifacts: unknown) => void;
  enabled?: boolean;
  /** Minimum new characters since the last draft before re-drafting. */
  minNewChars?: number;
  minIntervalMs?: number;
};

export function useLiveArtifacts({
  roomId,
  transcript,
  buildParticipantsBlock,
  onDraft,
  enabled = true,
  minNewChars = 450,
  minIntervalMs = 90_000,
}: LiveArtifactsOptions) {
  const [drafting, setDrafting] = useState(false);
  const [draftedAt, setDraftedAt] = useState<number | null>(null);
  const [draftCount, setDraftCount] = useState(0);

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const coveredRef = useRef(0);
  const lastRunRef = useRef(0);
  const busyRef = useRef(false);
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const buildRef = useRef(buildParticipantsBlock);
  buildRef.current = buildParticipantsBlock;

  const draftNow = useCallback(async () => {
    const text = transcriptRef.current.trim();
    if (busyRef.current || text.length < 120) return;
    busyRef.current = true;
    lastRunRef.current = Date.now();
    setDrafting(true);
    try {
      const participantsBlock = await buildRef.current();
      const res = await fetch("/api/generate-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, transcript: text.slice(-20_000), participantsBlock }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && typeof data === "object") {
        coveredRef.current = text.length;
        onDraftRef.current(data);
        setDraftedAt(Date.now());
        setDraftCount((n) => n + 1);
      }
    } catch {
      /* silent — this is a background nicety, not a user action */
    } finally {
      busyRef.current = false;
      setDrafting(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const text = transcriptRef.current;
      const fresh = text.length - coveredRef.current;
      const warm = coveredRef.current > 0;
      const wanted = warm ? fresh >= minNewChars : text.length >= 220 || INTENT_RE.test(text);
      if (!wanted) return;
      if (Date.now() - lastRunRef.current < minIntervalMs) return;
      void draftNow();
    };
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [enabled, draftNow, minNewChars, minIntervalMs]);

  return { drafting, draftedAt, draftCount, draftNow };
}
