import { createFileRoute } from "@tanstack/react-router";

// ElevenLabs TTS for the mediator's spoken interjections.
// Client posts { text }, server returns audio/mpeg bytes.
// Uses eleven_flash_v2_5 for lowest latency (~400ms first byte).
export const Route = createFileRoute("/api/mediator-tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response("ElevenLabs not configured", { status: 500 });
        }
        let body: { text?: string; voiceId?: string } = {};
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const text = (body.text ?? "").trim().slice(0, 300);
        if (!text) return new Response("Empty text", { status: 400 });

        // Default voice: "Aria" — calm, warm, neutral. Overridable per call.
        const voiceId = body.voiceId?.trim() || "9BWtsMINqrJLrRacOk9x";

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32&optimize_streaming_latency=3`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_flash_v2_5",
              voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
            }),
          },
        );
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          console.error("[mediator-tts] elevenlabs error", res.status, detail);
          return new Response("TTS failed", { status: res.status });
        }
        // Stream MP3 chunks straight through — client feeds them into a
        // MediaSource so playback starts on the first buffered chunk.
        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
            "Transfer-Encoding": "chunked",
          },
        });
      },
    },
  },
});
