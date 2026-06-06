import { createFileRoute } from "@tanstack/react-router";

// Two modes:
//   kind=profile  → extract { displayName, role } from a short self-intro
//   kind=goal     → extract { name, goal, outputs[], hostRole, facilitation } from a session brief
const SYSTEM_PROFILE = `You extract fields from a short spoken self-introduction.
Return STRICT JSON: { "displayName": "", "role": "" }
- displayName: first name only if given, else ""
- role: short role like "Designer", "PM", "Engineer", "Founder" — or "" if unclear
Return JSON only.`;

const SYSTEM_GOAL = `You extract a session setup from a short spoken brief about a meeting that is about to start.
Return STRICT JSON:
{
  "name": "",                  // short session title, max 60 chars
  "goal": "",                  // one clear sentence: what are we trying to do?
  "outputs": [],               // subset of: ["Summary","PRD","User journey","Product flow","Timeline","Problem statement","Decisions","Action items"]
  "hostRole": "",              // speaker's role THIS session: "facilitator","driver","contributor","observer" or ""
  "facilitation": ""           // how should Cartoonist show up: "scribe","facilitator","devils-advocate" or ""
}
Return JSON only — no commentary, no markdown.`;

export const Route = createFileRoute("/api/parse-intro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
        const { transcript, kind } = (await request.json().catch(() => ({}))) as { transcript?: string; kind?: "profile" | "goal" };
        if (!transcript || transcript.trim().length < 4)
          return Response.json({ error: "empty transcript" }, { status: 400 });

        const system = kind === "goal" ? SYSTEM_GOAL : SYSTEM_PROFILE;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: system },
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
