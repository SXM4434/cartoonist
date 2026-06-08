import { createFileRoute } from "@tanstack/react-router";

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

        // Group consecutive words by speaker into segments
        type Segment = { speaker: string; text: string; start: number; end: number };
        const segments: Segment[] = [];
        for (const w of data.words ?? []) {
          if (!w.text || w.type === "spacing") continue;
          const speaker = w.speaker_id ?? "speaker_0";
          const last = segments[segments.length - 1];
          if (last && last.speaker === speaker) {
            last.text += (w.text.match(/^[.,!?;:']/) ? "" : " ") + w.text;
            last.end = w.end ?? last.end;
          } else {
            segments.push({
              speaker,
              text: w.text,
              start: w.start ?? 0,
              end: w.end ?? 0,
            });
          }
        }

        return Response.json({ text: data.text ?? "", segments });
      },
    },
  },
});
