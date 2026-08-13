import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Loader2, Mic, Square, Check, RotateCcw } from "lucide-react";

const COLORS = ["#E07A3E", "#3E7AE0", "#5BB07A", "#B05BA0", "#B0A05B", "#A0B05B"];
const MAX_SECONDS = 30;

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
  const [color, setColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Voice enrollment
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sampleBlob, setSampleBlob] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setName(""); setRole(""); setPersonality(""); setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setSampleBlob(null); setSampleUrl(null); setRecording(false); setShowDetails(false);
      setElapsed(0); setTranscribedText("");
      if (timerRef.current) clearInterval(timerRef.current);
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
    }
  }, [open]);

  const autofillFromTranscript = async (transcript: string) => {
    if (!transcript.trim()) return;
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
    }
  };

  const transcribeAndFill = async (blob: Blob) => {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "sample.webm");
      const res = await fetch("/api/transcribe-sample", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        toast.error("Couldn't hear that — try recording again");
        return;
      }
      setTranscribedText(data.text);
      await autofillFromTranscript(data.text);
    } catch {
      toast.error("Transcription failed — check your connection");
    } finally {
      setParsing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (blob.size < 2000) {
          toast.error("Nothing was recorded — check the mic isn't in use elsewhere, then try again");
          return;
        }
        setSampleBlob(blob);
        setSampleUrl(URL.createObjectURL(blob));
        void transcribeAndFill(blob);
      };
      recorderRef.current = mr;
      // Timeslice keeps data flowing so a short take still yields audio.
      mr.start(500);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s >= MAX_SECONDS - 1) {
            try { mr.stop(); } catch { /* ignore */ }
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Mic blocked — enable microphone access to enroll a voice");
    }
  };


  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
  };

  const resetSample = () => {
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSampleBlob(null);
    setSampleUrl(null);
    setElapsed(0);
    setTranscribedText("");
  };

  const handleSubmit = async () => {
    if (!sampleBlob) { toast.error("Record a voice sample first — that's how we tell who's speaking"); return; }
    if (!name.trim()) { toast.error("Add a name (we tried to pick it up from your intro)"); return; }
    setSubmitting(true);
    try {
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
        personality: personality.trim() || transcribedText.trim(),
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
          {/* Voice sample — the one thing that matters. */}
          <div className="space-y-2 border border-border bg-muted/30 p-3">
            <Label className="eyebrow">
              Voice sample <span className="text-primary">*</span>
            </Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Say your name and what you do. Cartoonist fills in the rest and uses
              this recording to know who's speaking.
            </p>

            {sampleBlob ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary" /> Saved
                  </span>
                  {sampleUrl && <audio src={sampleUrl} controls className="h-8 flex-1" />}
                  <Button type="button" variant="outline" size="sm" onClick={resetSample} className="h-8 gap-1.5 rounded-none">
                    <RotateCcw className="h-3.5 w-3.5" /> Redo
                  </Button>
                </div>
                {parsing && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
                  </p>
                )}
                {!parsing && transcribedText && (
                  <p className="text-xs italic text-muted-foreground">"{transcribedText}"</p>
                )}
              </div>
            ) : recording ? (
              <Button type="button" variant="destructive" onClick={stopRecording} className="w-full gap-2 rounded-none">
                <Square className="h-4 w-4" /> Stop · {elapsed}s
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={startRecording} className="w-full gap-2 rounded-none border-border">
                <Mic className="h-4 w-4" /> Record voice sample
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sebastian" disabled={!sampleBlob} />
          </div>

          <div className="border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="eyebrow flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              More details
            </button>
            {showDetails && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Role / what you do</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Designer · Product · Eng…" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">How you like to work</Label>
                  <Input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="Visual thinker, big picture…" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Colour</Label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        aria-label={`Colour ${c}`}
                        className={`h-7 w-7 border-2 transition ${color === c ? "scale-110 border-foreground" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !sampleBlob || !name.trim() || parsing}
            className="w-full rounded-none bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isAdd ? "Add to room" : "Join meeting"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
