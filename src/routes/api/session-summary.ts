import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

/**
 * v1 P2.2 — rolling session memory.
 * Cheap model folds the previous summary + the newest transcript into an
 * updated running state: topics, decisions, open questions, entities.
 * Persisted per room so the mediator (and a reload) keeps full-session context
 * without shipping the whole transcript on every draw call.
 */
const SYSTEM_PROMPT = `You maintain the running memory of a live working session.

You get the PREVIOUS memory (may be empty) and the NEWEST transcript since it was written.
Fold them into one updated memory. Carry forward anything still true; drop nothing that was decided.

Return STRICT JSON only:
{
  "summary": "<3-6 sentences, plain, what this session is about and where it stands>",
  "topics": ["<short noun phrase>"],
  "decisions": ["<decision as stated, past tense>"],
  "open_questions": ["<unanswered question, in the room's own words>"],
  "entities": ["<person, product, feature or tool actually named>"]
}

RULES:
- Never invent facts, names, numbers or decisions. Only what was said.
- Max 8 topics, 8 decisions, 6 open questions, 12 entities. Shortest wording that stays accurate.
- Remove an open question once the transcript answers it.
- If the newest transcript adds nothing, return the previous memory unchanged.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const clampList = (v: unknown, max: number, len = 160): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.replace(/\s+/g, " ").trim().slice(0, len))
        .slice(0, max)
    : [];

const tail = (v: string | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(-max);
};

export const Route = createFileRoute("/api/session-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Session memory is not configured yet." }, 500);

        let body: { roomId?: string; transcript?: string; charsCovered?: number };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "session-summary",
          maxBytes: 200_000,
          limit: 6,
          roomId: body.roomId,
        });
        if (blocked) return blocked;

        const roomId = body.roomId as string;
        const newest = tail(body.transcript, 9000);
        if (newest.length < 120) return json({ skipped: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: previous } = await supabaseAdmin
          .from("session_summaries")
          .select("summary,topics,decisions,open_questions,entities")
          .eq("room_id", roomId)
          .maybeSingle();

        const prevBlock = previous?.summary
          ? `# Previous memory
${previous.summary}
Topics: ${(previous.topics ?? []).join(", ") || "(none)"}
Decisions: ${(previous.decisions ?? []).join(" | ") || "(none)"}
Open questions: ${(previous.open_questions ?? []).join(" | ") || "(none)"}
Entities: ${(previous.entities ?? []).join(", ") || "(none)"}`
          : "# Previous memory\n(none — this is the first pass)";

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `${prevBlock}\n\n# Newest transcript\n${newest}` },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
        if (!res.ok) return json({ error: "Could not update session memory." }, 502);

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        } catch {
          return json({ skipped: true });
        }

        const memory = {
          summary: typeof parsed.summary === "string" ? parsed.summary.replace(/\s+/g, " ").trim().slice(0, 1400) : previous?.summary ?? "",
          topics: clampList(parsed.topics, 8, 60),
          decisions: clampList(parsed.decisions, 8),
          open_questions: clampList(parsed.open_questions, 6),
          entities: clampList(parsed.entities, 12, 60),
        };
        if (!memory.summary) return json({ skipped: true });

        const charsCovered = Math.max(0, Number(body.charsCovered ?? 0) | 0);
        await supabaseAdmin.from("session_summaries").upsert(
          { room_id: roomId, ...memory, chars_covered: charsCovered, updated_at: new Date().toISOString() },
          { onConflict: "room_id" },
        );

        return json({ memory });
      },
    },
  },
});
