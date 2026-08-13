import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

export const Route = createFileRoute("/api/elevenlabs/scribe-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ElevenLabs is not connected" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Minting a realtime token is billable — cap it per caller.
        const blocked = await guardExpensiveRoute(request, {
          route: "scribe-token", maxBytes: 4_000, limit: 10, requireRoom: false,
        });
        if (blocked) return blocked;


        const res = await fetch(
          "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
          { method: "POST", headers: { "xi-api-key": apiKey } },
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("ElevenLabs token error", res.status, text);
          return new Response(
            JSON.stringify({ error: "Failed to mint Scribe token", details: text }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as { token: string };
        return Response.json({ token: data.token });
      },
    },
  },
});
