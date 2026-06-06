import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You extract structured profile fields from a short spoken self-introduction.
Return STRICT JSON: { "displayName": "", "role": "", "vibe": "", "strengths": [], "bio": "" }
- displayName: first name only if given, else ""
- role: short role like "Designer", "PM", "Engineer" (or "" if unclear)
- vibe: one of introvert|extrovert|analytical|creative|driver|diplomat (or "" if unclear)
- strengths: subset of [Strategy,Research,Design,Engineering,Writing,Facilitation,Marketing,Sales,Operations,Data,Product,Storytelling]
- bio: one short sentence (max 100 chars) summarising how they like to work, or "" if not mentioned
Return JSON only, no commentary.`;

export const Route = createFileRoute("/api/parse-intro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
        const { transcript } = (await request.json().catch(() => ({}))) as { transcript?: string };
        if (!transcript || transcript.trim().length < 4)
          return Response.json({ error: "empty transcript" }, { status: 400 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: transcript },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          return Response.json({ error: "AI failed", details: t }, { status: res.status });
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? "{}";
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(content); } catch { parsed = {}; }
        return Response.json(parsed);
      },
    },
  },
});
