// Progressive TTS playback. Streams MP3 chunks from /api/mediator-tts (which
// proxies ElevenLabs' /stream endpoint) into a MediaSource so playback starts
// on the first buffered chunk — ~200-400ms faster than await-full-blob.
//
// Falls back to blob playback when MediaSource / MP3 isn't supported.

const MP3_MIME = "audio/mpeg";

let currentAudio: HTMLAudioElement | null = null;
let pendingRequest: AbortController | null = null;
let playbackVersion = 0;

export function stopStreamingTTS(): void {
  playbackVersion++;
  pendingRequest?.abort();
  pendingRequest = null;
  currentAudio?.pause();
  currentAudio = null;
}

export type StreamingTTSOptions = {
  /** Room the mediator is speaking in — required by the server-side abuse guard. */
  roomId: string;
  text: string;
  volume?: number;
  onEnd?: () => void;
};

export async function playStreamingTTS(opts: StreamingTTSOptions): Promise<HTMLAudioElement | null> {
  const { text, roomId, volume = 0.95, onEnd } = opts;
  if (!text.trim() || typeof window === "undefined") return null;

  // Stop any in-flight playback so overlapping requests don't stack.
  stopStreamingTTS();
  const version = playbackVersion;
  const controller = new AbortController();
  pendingRequest = controller;

  const res = await fetch("/api/mediator-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({ text, roomId }),
  });
  if (!res.ok || !res.body) throw new Error("tts http " + res.status);
  if (version !== playbackVersion) return null;

  const canStream = "MediaSource" in window && (window as unknown as { MediaSource: { isTypeSupported(t: string): boolean } }).MediaSource.isTypeSupported(MP3_MIME);

  if (!canStream) {
    // Fallback: buffer whole blob, then play.
    const blob = await res.blob();
    if (version !== playbackVersion) return null;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = volume;
    currentAudio = audio;
    audio.onended = () => { onEnd?.(); URL.revokeObjectURL(url); };
    audio.onerror = () => { onEnd?.(); URL.revokeObjectURL(url); };
    await audio.play();
    return audio;
  }

  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  const audio = new Audio(url);
  audio.volume = volume;
  currentAudio = audio;
  audio.onended = () => { onEnd?.(); URL.revokeObjectURL(url); };
  audio.onerror = () => { onEnd?.(); URL.revokeObjectURL(url); };

  const reader = res.body.getReader();
  const opened = new Promise<SourceBuffer>((resolve, reject) => {
    mediaSource.addEventListener("sourceopen", () => {
      try {
        const sb = mediaSource.addSourceBuffer(MP3_MIME);
        resolve(sb);
      } catch (e) { reject(e); }
    }, { once: true });
  });

  // Pump chunks into the source buffer as they arrive.
  (async () => {
    try {
      const sb = await opened;
      const queue: Uint8Array[] = [];
      let done = false;

      const pump = () => {
        if (sb.updating || queue.length === 0) return;
        const chunk = queue.shift()!;
        try { sb.appendBuffer(chunk.slice().buffer as ArrayBuffer); } catch { /* MediaSource closed */ }
      };
      sb.addEventListener("updateend", () => {
        pump();
        if (done && queue.length === 0 && !sb.updating && mediaSource.readyState === "open") {
          try { mediaSource.endOfStream(); } catch { /* noop */ }
        }
      });

      while (true) {
        const { value, done: finished } = await reader.read();
        if (finished) { done = true; pump(); break; }
        if (value) { queue.push(value); pump(); }
      }
    } catch {
      try { mediaSource.endOfStream("network"); } catch { /* noop */ }
    }
  })();

  // Start playing as soon as first chunk buffers.
  if (version !== playbackVersion) { reader.cancel().catch(() => {}); URL.revokeObjectURL(url); return null; }
  try { await audio.play(); } catch { /* autoplay may block; caller handles */ }
  return audio;
}
