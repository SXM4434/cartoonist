import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COLORS, STRENGTHS, VIBES, type Profile, type Vibe, loadProfile, pickColor, saveProfile } from "@/lib/profile";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [vibe, setVibe] = useState<Vibe>("creative");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setDisplayName(existing.displayName);
      setVibe(existing.vibe);
      setStrengths(existing.strengths);
      setBio(existing.bio);
      setColor(existing.color);
    }
  }, []);

  // Audio intro via browser SpeechRecognition (no extra service needed)
  const startMic = async () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      toast.error("Voice intro works best in Chrome / Edge. Just type instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    let transcript = "";
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " ";
      }
    };
    rec.onerror = () => { setRecording(false); };
    rec.onend = async () => {
      setRecording(false);
      const text = transcript.trim();
      if (!text) return;
      await autofill(text);
    };
    recRef.current = rec as any;
    rec.start();
    setRecording(true);
    toast.success("Say your name, what you do, and how you like to work");
    // auto-stop after 12s
    setTimeout(() => { try { rec.stop(); } catch {} }, 12000);
  };

  const stopMic = () => { try { (recRef.current as any)?.stop?.(); } catch {} };

  const autofill = async (transcript: string) => {
    setParsing(true);
    try {
      const res = await fetch("/api/parse-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "parse failed");
      if (data.displayName) setDisplayName((v) => v || data.displayName);
      if (data.vibe && VIBES.find((x) => x.id === data.vibe)) setVibe(data.vibe);
      if (Array.isArray(data.strengths) && data.strengths.length)
        setStrengths((cur) => Array.from(new Set([...cur, ...data.strengths.filter((s: string) => STRENGTHS.includes(s))])));
      if (data.bio) setBio((v) => v || data.bio);
      toast.success("Autofilled from your intro — tweak anything.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse intro");
    } finally {
      setParsing(false);
    }
  };

  const toggleStrength = (s: string) =>
    setStrengths((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const save = () => {
    if (!displayName.trim()) { toast.error("Add your display name"); return; }
    const p: Profile = { displayName: displayName.trim(), vibe, strengths, bio: bio.trim(), color: color || pickColor(displayName) };
    saveProfile(p);
    toast.success("Profile saved!");
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <CartoonistHeader />
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="text-5xl">🤖</div>
          <div>
            <h1 className="font-serif" style={{ fontSize: "var(--step-4)" }}>Let's draw your profile</h1>
            <p className="text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
              So Cartoonist can mediate around your style.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-foreground bg-card p-6 space-y-5">
          {/* Voice autofill */}
          <div className="rounded-xl border border-border bg-background p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Skip the form — say hi</p>
              <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>
                10 sec mic intro. Cartoonist autofills what it hears.
              </p>
            </div>
            {recording ? (
              <Button onClick={stopMic} className="gap-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Square className="h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button onClick={startMic} disabled={parsing} className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {parsing ? "Reading…" : "Record intro"}
              </Button>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block">Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maya" className="rounded-full border-2 border-foreground" />
          </div>

          <div>
            <Label className="mb-2 block">Your vibe</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {VIBES.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setVibe(v.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${vibe === v.id ? "border-foreground bg-secondary" : "border-border bg-background hover:border-foreground/60"}`}
                >
                  <div className="text-2xl">{v.emoji}</div>
                  <div className="mt-1 font-medium">{v.label}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{v.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Strengths (pick a few)</Label>
            <div className="flex flex-wrap gap-2">
              {STRENGTHS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleStrength(s)}
                  className={`rounded-full border-2 px-3 py-1 text-sm transition ${strengths.includes(s) ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/60"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">One-line bio (optional)</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="rounded-xl border-2 border-foreground" />
          </div>

          <div>
            <Label className="mb-2 block">Your color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-9 w-9 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <Button onClick={save} className="w-full rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
            Save and continue
          </Button>
        </div>
      </div>
    </main>
  );
}

export function CartoonistHeader() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between rounded-2xl border-2 border-foreground bg-card px-5 py-3">
      <button onClick={() => navigate({ to: "/" })} className="flex items-center gap-2.5">
        <div className="text-3xl">🤖</div>
        <span className="font-serif font-semibold" style={{ fontSize: "var(--step-3)" }}>Cartoonist</span>
      </button>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })} className="rounded-full">Dashboard</Button>
        <Button variant="outline" onClick={() => { localStorage.removeItem("cartoonist_profile_v2"); navigate({ to: "/" }); }} className="rounded-full border-2 border-foreground">
          Sign out
        </Button>
      </div>
    </div>
  );
}
