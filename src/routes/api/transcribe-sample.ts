import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

// Transcribes a short audio clip (the enrollment / intro recording) via
// ElevenLabs Scribe batch. No diarization — single speaker.
export const Route = createFileRoute("/api/transcribe-sample")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "ElevenLabs not connected" }, { status: 500 });
        }

        const incoming = await request.formData().catch(() => null);
        const file = incoming?.get("file");
        if (!(file instanceof Blob)) {
          return Response.json({ error: "missing audio file" }, { status: 400 });
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "transcribe-sample", maxBytes: 8_000_000, limit: 10,
          requireRoom: false, roomId: incoming?.get("roomId"),
        });
        if (blocked) return blocked;
        if (file.size > 8_000_000) {
          return Response.json({ error: "audio sample too large" }, { status: 413 });
        }

        const fd = new FormData();
        fd.append("file", file, "sample.webm");
        fd.append("model_id", "scribe_v2");
        fd.append("diarize", "false");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text();
          return Response.json({ error: "Transcription failed", details: t }, { status: res.status });
        }
        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
