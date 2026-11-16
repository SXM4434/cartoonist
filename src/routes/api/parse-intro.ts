import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

// Three modes:
//   kind=profile  → extract { displayName, role } from a short self-intro
//   kind=goal     → extract session brief
//   kind=checkin  → extract v2.P1 Human Layer fields from a 15-30s spoken check-in
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

const SYSTEM_CHECKIN = `You extract a lightweight per-session "human layer" profile from a short spoken check-in (~15-30s).
The speaker will describe their role today, how they like to work, what they need from this meeting, and possibly a worry or something they can help with.

Return STRICT JSON with these keys — empty string / empty array when not stated:
{
  "role_today": "",                    // short, e.g. "Design lead", "PM on ops", "Founder driving GTM"
  "strengths": [],                     // 1-3 short chips, e.g. ["scope","visual thinking"]
  "contribution_modes": [],            // subset of ["voice","chat","whiteboard","async"] — only include modes they explicitly prefer / opt into
  "feedback_style": "",                // one of "direct","gentle","ask-first","written-only" — or ""
  "needs_today": "",                   // one clear sentence: what they want out of this meeting
  "blockers": "",                      // worry / risk / thing that's stuck — short, 1 line, or ""
  "can_help_with": ""                  // short: "diagrams · pricing math" style, or ""
}
Rules:
- Never fabricate. If they didn't say it, leave it "".
- Do NOT infer personality. Only literal signals.
- "direct/gentle/ask-first/written-only" ONLY when they literally describe feedback preference.
Return JSON only — no commentary, no markdown.`;

export const Route = createFileRoute("/api/parse-intro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
        const { transcript, kind, roomId } = (await request.json().catch(() => ({}))) as { transcript?: string; kind?: "profile" | "goal" | "checkin"; roomId?: string };
        const blocked = await guardExpensiveRoute(request, {
          route: "parse-intro", maxBytes: 60_000, limit: 20, requireRoom: false, roomId,
        });
        if (blocked) return blocked;
        if (!transcript || transcript.trim().length < 4)
          return Response.json({ error: "empty transcript" }, { status: 400 });

        const system = kind === "goal" ? SYSTEM_GOAL : kind === "checkin" ? SYSTEM_CHECKIN : SYSTEM_PROFILE;

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
