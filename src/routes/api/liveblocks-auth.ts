import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/liveblocks-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LIVEBLOCKS_SECRET_KEY;
        if (!secret) {
          return new Response(
            JSON.stringify({ error: "LIVEBLOCKS_SECRET_KEY missing" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { room?: string; userId?: string; userName?: string; color?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const room = body.room;
        if (!room) {
          return new Response(JSON.stringify({ error: "room required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userId = body.userId ?? `guest-${crypto.randomUUID()}`;
        const userName = body.userName ?? "Guest";
        const color = body.color ?? "#E07A3E";

        // Use ID-token auth: client establishes session, then accesses rooms per permissions.
        // Simpler: use access tokens that grant full access to one room.
        const res = await fetch("https://api.liveblocks.io/v2/authorize-user", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            userInfo: { name: userName, color },
            permissions: {
              [room]: ["room:write"],
            },
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return new Response(
            JSON.stringify({ error: "Liveblocks auth failed", detail: text }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
