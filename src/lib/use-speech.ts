import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  level: number; // 0..1 mic loudness
  partial: string;
  finals: string[];
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

export function useSpeech(): SpeechState {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const tearDownAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;
    setError(null);
    const SRCtor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SRCtor) {
      setSupported(false);
      setError("Voice transcription needs Chrome (or another Chromium browser).");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone permission denied");
      tearDownAudio();
      return;
    }

    const rec = new SRCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean };
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) {
          setFinals((current) => (current[current.length - 1] === text ? current : [...current, text.trim()]));
        } else {
          interim += text;
        }
      }
      setPartial(interim);
    };
    rec.onerror = (ev) => {
      if (ev.error === "no-speech" || ev.error === "aborted") return;
      setError(ev.error);
    };
    rec.onend = () => {
      if (wantListeningRef.current) {
        try { rec.start(); } catch {}
      } else {
        setListening(false);
      }
    };
    recognitionRef.current = rec;
    wantListeningRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recognition");
    }
  }, [tearDownAudio]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    setPartial("");
    tearDownAudio();
  }, [tearDownAudio]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, level, partial, finals, error, start, stop };
}
