import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Loader2, Mic, Square } from "lucide-react";

const COLORS = ["#E07A3E", "#3E7AE0", "#5BB07A", "#B05BA0", "#B0A05B", "#A0B05B"];

export function IntroModal({
  open,
  onClose,
  onSubmit,
  mode = "self",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    role: string;
    personality: string;
    color: string;
  }) => Promise<void>;
  mode?: "self" | "add";
}) {

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onCommittedTranscript: (d: { text: string }) => {
      const txt = (d.text ?? "").trim();
      if (!txt) return;
      // simple heuristic: first sentence -> name+role
      // Use AI to parse on submit; for now just append to role as a hint
      setRole((prev) => (prev ? `${prev} ${txt}` : txt));
    },
  });

  const startMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/scribe-token", { method: "POST" });
      const { token } = await res.json();
      await scribe.connect({
        token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      setRecording(true);
      toast.success("Say your name, role, and how you like to work");
      setTimeout(async () => {
        try {
          await scribe.disconnect();
        } catch {}
        setRecording(false);
      }, 10000);
    } catch (e) {
      toast.error("Mic failed — fill out the form instead");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Add your name");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        role: role.trim(),
        personality: personality.trim(),
        color,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {mode === "add" ? "Add someone on this device" : "Introduce yourself"}
          </DialogTitle>
        </DialogHeader>


        <div className="space-y-4 pt-2">
          <Button
            variant={recording ? "destructive" : "outline"}
            onClick={recording ? () => scribe.disconnect() : startMic}
            className="w-full gap-2"
          >
            {recording ? (
              <>
                <Square className="h-4 w-4" /> Recording…
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Record 10-sec intro
              </>
            )}
          </Button>

          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sebastian"
            />
          </div>
          <div className="space-y-2">
            <Label>Role / what you do</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Designer · Product · Eng…"
            />
          </div>
          <div className="space-y-2">
            <Label>Personality / how you like to work</Label>
            <Input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Visual thinker, big picture, etc."
            />
          </div>
          <div className="space-y-2">
            <Label>Your color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "add" ? "Add to room" : "Join meeting"}
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
