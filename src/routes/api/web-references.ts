import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";
import { parseWebResults } from "@/lib/web-reference";

/**
 * Librarian lookup. The browser never talks to a search API. This route
 * asks the Lovable gateway for public sources, then drops anything without
 * a real http(s) URL so a fabricated citation cannot land in the panel.
 */
const SYSTEM_PROMPT = `You are the LIBRARIAN of a live working session. Look up public web sources for the question.

HARD RULES:
- Return only sources you can name with a real public http or https URL.
- Never invent a URL, title, or quote.
- If you cannot name a real public source, return {"results":[]}.
- Max 5 results. Prefer official docs, primary sources, and the named product's own site.

Return STRICT JSON only:
{ "results": [ { "title": "...", "url": "https://...", "snippet": "one or two sentences", "source": "hostname" } ] }`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const compact = (v: string | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.4);
  return `${t.slice(0, head)} … ${t.slice(-(max - head))}`;
};

export const Route = createFileRoute("/api/web-references")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Web lookup is not configured yet." }, 500);

        let body: { roomId?: string; query?: string; transcript?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "web-references", maxBytes: 80_000, limit: 20, roomId: body.roomId,
        });
        if (blocked) return blocked;

        const query = (body.query ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (!query) return json({ error: "Ask for a source first." }, 400);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `${body.transcript ? `# Session so far\n${compact(body.transcript, 2500)}\n\n` : ""}# Look up\n${query}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
        if (!res.ok) return json({ error: "Could not look that up." }, 502);

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        } catch {
          return json({ results: [] });
        }

        return json({ results: parseWebResults(parsed, query) });
      },
    },
  },
});
