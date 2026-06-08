import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mic, Square, Check, RotateCcw } from "lucide-react";

const COLORS = ["#E07A3E", "#3E7AE0", "#5BB07A", "#B05BA0", "#B0A05B", "#A0B05B"];
const SAMPLE_SECONDS = 8;

export function IntroModal({
  open,
  onClose,
  onSubmit,
  mode = "self",
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    role: string;
    personality: string;
    color: string;
    voiceSamplePath: string | null;
  }) => Promise<void>;
  mode?: "self" | "add";
  roomId: string;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  // Voice enrollment state
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(SAMPLE_SECONDS);
  const [sampleBlob, setSampleBlob] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef = useRef<string>("");

  // Reset state when modal opens fresh
  useEffect(() => {
    if (!open) {
      setName(""); setRole(""); setPersonality(""); setColor(COLORS[0]);
      setSampleBlob(null); setSampleUrl(null); setRecording(false);
      setCountdown(SAMPLE_SECONDS);
      transcriptRef.current = "";
      if (timerRef.current) clearInterval(timerRef.current);
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    }
  }, [open]);

  const autofillFromTranscript = async (transcript: string) => {
    if (!transcript.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/parse-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, kind: "profile" }),
      });
      const data = (await res.json().catch(() => ({}))) as { displayName?: string; role?: string };
      if (data.displayName) setName((cur) => cur || data.displayName!);
      if (data.role) setRole((cur) => cur || data.role!);
      setPersonality((cur) => cur || transcript.trim());
    } catch {
      setPersonality((cur) => cur || transcript.trim());
    } finally {
      setParsing(false);
    }
  };

  const startRecognition = () => {
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    try {
      const rec = new Ctor() as {
        continuous: boolean; interimResults: boolean; lang: string;
        onresult: (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
        start: () => void; stop: () => void;
      };
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        let finalText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " ";
        }
        if (finalText) transcriptRef.current += finalText;
      };
      rec.start();
      recognitionRef.current = rec;
    } catch { /* ignore */ }
  };

  const startRecording = async () => {
    try {
      transcriptRef.current = "";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setSampleBlob(blob);
        setSampleUrl(URL.createObjectURL(blob));
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        setTimeout(() => void autofillFromTranscript(transcriptRef.current), 300);
      };
      recorderRef.current = mr;
      mr.start();
      startRecognition();
      setRecording(true);
      setCountdown(SAMPLE_SECONDS);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            try { mr.stop(); } catch { /* ignore */ }
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      toast.error("Mic blocked — enable microphone access to enroll a voice");
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch {}
  };

  const resetSample = () => {
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSampleBlob(null);
    setSampleUrl(null);
    setCountdown(SAMPLE_SECONDS);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Add a name"); return; }
    if (!sampleBlob) { toast.error("Record a short voice sample so we can tell who's speaking"); return; }
    setSubmitting(true);
    try {
      // Upload sample
      const path = `${roomId}/${crypto.randomUUID()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("voice-samples")
        .upload(path, sampleBlob, { contentType: sampleBlob.type || "audio/webm", upsert: false });
      if (upErr) {
        toast.error("Couldn't save voice sample — try again");
        setSubmitting(false);
        return;
      }
      await onSubmit({
        name: name.trim(),
        role: role.trim(),
        personality: personality.trim(),
        color,
        voiceSamplePath: path,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isAdd = mode === "add";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isAdd ? "Add someone on this device" : "Introduce yourself"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sebastian" />
          </div>
          <div className="space-y-2">
            <Label>Role / what you do</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Designer · Product · Eng…" />
          </div>
          <div className="space-y-2">
            <Label>Personality / how you like to work</Label>
            <Input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="Visual thinker, big picture…" />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Voice enrollment */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label>
              Voice sample <span className="text-muted-foreground">(say your name, role, and how you like to work — we'll auto-fill the form)</span>
            </Label>
            {parsing && <p className="text-xs text-muted-foreground">Filling in what you said…</p>}

            {sampleBlob ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" /> Sample saved
                </span>
                {sampleUrl && <audio src={sampleUrl} controls className="h-8 flex-1" />}
                <Button type="button" variant="outline" size="sm" onClick={resetSample} className="h-8 gap-1.5 rounded-none">
                  <RotateCcw className="h-3.5 w-3.5" /> Redo
                </Button>
              </div>
            ) : recording ? (
              <Button type="button" variant="destructive" onClick={stopRecording} className="w-full gap-2 rounded-none">
                <Square className="h-4 w-4" /> Stop · {countdown}s
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={startRecording} className="w-full gap-2 rounded-none border-border">
                <Mic className="h-4 w-4" /> Record {SAMPLE_SECONDS}s sample
              </Button>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !sampleBlob || !name.trim()}
            className="w-full rounded-none bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isAdd ? "Add to room" : "Join meeting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
