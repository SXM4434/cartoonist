import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";
import { speechSegments } from "@/lib/speech-transcript";

// Transcribes a rolling room audio chunk with speaker diarization.
// Returns segments grouped by speaker cluster (speaker_0, speaker_1, ...).
// The client is responsible for mapping clusters -> participants and
// inserting transcript_chunks rows.
export const Route = createFileRoute("/api/transcribe-chunk")({
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
          route: "transcribe-chunk", maxBytes: 12_000_000, limit: 40,
          roomId: incoming?.get("roomId"),
        });
        if (blocked) return blocked;
        if (file.size > 12_000_000) {
          return Response.json({ error: "audio chunk too large" }, { status: 413 });
        }

        const fd = new FormData();
        fd.append("file", file, "chunk.webm");
        fd.append("model_id", "scribe_v2");
        fd.append("diarize", "true");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text();
          return Response.json({ error: "Transcription failed", details: t }, { status: res.status });
        }
        const data = (await res.json()) as {
          text?: string;
          words?: Array<{ text: string; start?: number; end?: number; speaker_id?: string; type?: string }>;
        };

        const segments = speechSegments(data.words ?? []);

        return Response.json({ text: data.text ?? "", segments });
      },
    },
  },
});
