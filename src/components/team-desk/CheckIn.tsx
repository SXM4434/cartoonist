import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONTRIBUTION_MODES,
  FEEDBACK_STYLES,
  type ContributionMode,
  type FeedbackStyle,
  type HumanLayer,
} from "@/lib/human-layer";

/**
 * CheckIn modal — v2.P1. Post-intro, 30-60s, always skippable.
 * Voice path: single 15s recording → /api/parse-intro (kind: "checkin") fills the fields.
 */
export function CheckIn({
  open,
  initial,
  onSubmit,
  onSkip,
  subjectName,
  kioskRemaining,
}: {
  open: boolean;
  initial: HumanLayer;
  onSubmit: (data: HumanLayer) => void;
  onSkip: () => void;
  subjectName?: string | null;
  kioskRemaining?: number;
}) {
  const [state, setState] = useState<HumanLayer>(initial);
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const recRef = useRef<unknown>(null);

  useEffect(() => { if (open) setState(initial); }, [open, initial]);

  const set = <K extends keyof HumanLayer>(k: K, v: HumanLayer[K]) => setState((s) => ({ ...s, [k]: v }));

  const toggleMode = (m: ContributionMode) => {
    setState((s) => {
      const has = s.contribution_modes.includes(m);
      return { ...s, contribution_modes: has ? s.contribution_modes.filter((x) => x !== m) : [...s.contribution_modes, m] };
    });
  };

  const startVoice = async () => {
    const w = window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown };
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition;
    if (!SR) { toast.error("Voice check-in works best in Chrome / Edge. Fill in the fields below instead."); return; }
    const rec = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
      onerror: () => void; onend: () => Promise<void>; start: () => void; stop: () => void;
    })();
    rec.lang = "en-US"; rec.continuous = true; rec.interimResults = false;
    let transcript = "";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " ";
      }
    };
    rec.onerror = () => setRecording(false);
    rec.onend = async () => {
      setRecording(false);
      const text = transcript.trim();
      if (!text) return;
      await parseIntoFields(text);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    toast.info("15 seconds — say your role today, how you like to work, and what you need from this meeting.");
    setTimeout(() => { try { rec.stop(); } catch { /* noop */ } }, 15000);
  };

  const stopVoice = () => { try { (recRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* noop */ } };

  const parseIntoFields = async (transcript: string) => {
    setParsing(true);
    try {
      const res = await fetch("/api/parse-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, kind: "checkin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "parse failed");
      setState((s) => ({
        ...s,
        role_today: data.role_today || s.role_today,
        strengths: Array.isArray(data.strengths) && data.strengths.length ? data.strengths : s.strengths,
        contribution_modes:
          Array.isArray(data.contribution_modes) && data.contribution_modes.length
            ? (data.contribution_modes.filter((m: string) => CONTRIBUTION_MODES.some((x) => x.value === m)) as ContributionMode[])
            : s.contribution_modes,
        feedback_style:
          typeof data.feedback_style === "string" && FEEDBACK_STYLES.some((f) => f.value === data.feedback_style)
            ? (data.feedback_style as FeedbackStyle)
            : s.feedback_style,
        blockers: data.blockers || s.blockers,
        needs_today: data.needs_today || s.needs_today,
        can_help_with: data.can_help_with || s.can_help_with,
      }));
      toast.success("Filled in — tweak anything, then save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse voice");
    } finally {
      setParsing(false);
    }
  };

  const save = () => {
    onSubmit({ ...state, human_layer_complete: true });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <span className="eyebrow text-primary">
            {kioskRemaining && kioskRemaining > 0 ? `Kiosk · ${kioskRemaining} more after this` : "Quick check-in"}
          </span>
          <DialogTitle className="font-serif" style={{ fontSize: "var(--step-4)" }}>
            {subjectName ? `${subjectName} — say hi to the room` : "Say hi to the room"}
          </DialogTitle>
          <DialogDescription>
            {subjectName
              ? `Pass the laptop to ${subjectName}. Every field is optional. Skip anytime.`
              : "Helps Cartoonist facilitate for the human, not the generic meeting. Every field is optional. Skip anytime."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-3">
          <div className="flex items-center justify-between gap-3 border border-border bg-muted/30 px-3 py-2">
            <div>
              <p className="font-medium" style={{ fontSize: "var(--step-1)" }}>Say it in one breath</p>
              <p className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                Role today, how you like to work, what you need.
              </p>
            </div>
            {recording ? (
              <Button onClick={stopVoice} size="sm" className="h-8 gap-1.5 rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Square className="h-3.5 w-3.5" /><span className="eyebrow">Stop</span>
              </Button>
            ) : (
              <Button onClick={startVoice} disabled={parsing} size="sm" className="h-8 gap-1.5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
                <span className="eyebrow">{parsing ? "Reading…" : "Voice"}</span>
              </Button>
            )}
          </div>

          <div>
            <Label className="mb-1 block eyebrow">Role today</Label>
            <Input
              value={state.role_today}
              onChange={(e) => set("role_today", e.target.value)}
              placeholder="Product lead · Designer · Ops · Eng feasibility"
              className="rounded-none border-border"
            />
          </div>

          <PrivateField
            label="Need today"
            placeholder="a decision on the cutover · align on scope · unblock the mock"
            value={state.needs_today}
            onChange={(v) => set("needs_today", v)}
            shared={state.share_needs}
            onToggleShare={() => set("share_needs", !state.share_needs)}
          />

          <details className="group border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
              <span className="eyebrow text-foreground">More about how you work</span>
              <span className="eyebrow text-muted-foreground group-open:hidden">optional</span>
              <span className="eyebrow hidden text-muted-foreground group-open:inline">hide</span>
            </summary>
            <div className="space-y-3 border-t border-border px-3 py-3">
          <div>
            <Label className="mb-1 block eyebrow">Strong at (1–3)</Label>
            <Input
              value={state.strengths.join(", ")}
              onChange={(e) => set("strengths", e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3))}
              placeholder="scope, visual thinking, eng feasibility"
              className="rounded-none border-border"
            />
          </div>

          <div>
            <Label className="mb-1 block eyebrow">Contribution modes</Label>
            <div className="flex flex-wrap gap-1.5">
              {CONTRIBUTION_MODES.map((m) => {
                const on = state.contribution_modes.includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => toggleMode(m.value)}
                    className={`border px-2 py-1 transition ${on ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground"}`}
                    style={{ fontSize: "var(--step-0)" }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-1 block eyebrow">Feedback style</Label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_STYLES.map((f) => {
                const on = state.feedback_style === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => set("feedback_style", on ? "" : f.value)}
                    className={`border px-2 py-1 transition ${on ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground"}`}
                    style={{ fontSize: "var(--step-0)" }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <PrivateField
            label="Blocker / worry"
            placeholder="overbuilding · ops risk · timeline"
            value={state.blockers}
            onChange={(v) => set("blockers", v)}
            shared={state.share_blockers}
            onToggleShare={() => set("share_blockers", !state.share_blockers)}
          />

          <div>
            <Label className="mb-1 block eyebrow">Can help with</Label>
            <Input
              value={state.can_help_with}
              onChange={(e) => set("can_help_with", e.target.value)}
              placeholder="diagrams · pricing math · GTM copy"
              className="rounded-none border-border"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 border border-border p-2 text-foreground">
            <input
              type="checkbox"
              checked={state.allow_voice_mention}
              onChange={(e) => set("allow_voice_mention", e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-primary"
            />
            <span className="flex-1" style={{ fontSize: "var(--step-0)" }}>
              <span className="eyebrow block text-foreground">Let the mediator say my name out loud</span>
              <span className="text-muted-foreground">Uncheck if you'd rather not be called out by voice.</span>
            </span>
          </label>
            </div>
          </details>

        </div>

        <DialogFooter className="mt-4 flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onSkip} className="rounded-none text-muted-foreground hover:text-foreground">
            Skip for now
          </Button>
          <Button onClick={save} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
            Save & join room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrivateField({
  label, placeholder, value, onChange, shared, onToggleShare,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  shared: boolean; onToggleShare: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="eyebrow">{label}</Label>
        <button
          type="button"
          onClick={onToggleShare}
          className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-foreground"
          style={{ fontSize: "var(--step-0)" }}
          title={shared ? "Everyone in the room can see this" : "Only the mediator sees this"}
        >
          {shared ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          <span className="eyebrow">{shared ? "shared" : "private"}</span>
        </button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="rounded-none border-border"
      />
    </div>
  );
}
