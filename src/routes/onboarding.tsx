import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLORS, type Profile, clearProfile, loadProfile, pickColor, saveProfile } from "@/lib/profile";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const recRef = useRef<unknown>(null);

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setDisplayName(existing.displayName);
      setRole(existing.role);
      setColor(existing.color);
    }
  }, []);

  const startMic = async () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown })
      .webkitSpeechRecognition || (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition;
    if (!SR) {
      toast.error("Voice intro works best in Chrome / Edge. Just type instead.");
      return;
    }
    const rec = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
      onerror: () => void; onend: () => Promise<void>;
      start: () => void; stop: () => void;
    })();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    let transcript = "";
    rec.onresult = (e) => {
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
    recRef.current = rec;
    rec.start();
    setRecording(true);
    toast.success("Say your first name and what you do (e.g. 'I'm Maya, a product designer')");
    setTimeout(() => { try { rec.stop(); } catch { /* noop */ } }, 10000);
  };

  const stopMic = () => { try { (recRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* noop */ } };

  const autofill = async (transcript: string) => {
    setParsing(true);
    try {
      const res = await fetch("/api/parse-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, kind: "profile" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "parse failed");
      if (data.displayName) setDisplayName((v) => v || data.displayName);
      if (data.role) setRole((v) => v || data.role);
      if (data.displayName && !color) setColor(pickColor(data.displayName));
      toast.success("Autofilled — tweak anything.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse intro");
    } finally {
      setParsing(false);
    }
  };

  const save = () => {
    if (!displayName.trim()) { toast.error("Add your first name"); return; }
    const p: Profile = {
      displayName: displayName.trim(),
      role: role.trim(),
      color: color || pickColor(displayName),
    };
    saveProfile(p);
    const pending = typeof window !== "undefined" ? sessionStorage.getItem("cartoonist_pending_join") : null;
    if (pending) {
      sessionStorage.removeItem("cartoonist_pending_join");
      navigate({ to: "/sessions/$sessionId", params: { sessionId: pending } });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <CartoonistHeader />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <span className="eyebrow font-mono text-muted-foreground">STEP 1 / 2</span>
          <h1 className="statement mt-3 max-w-[12ch]" style={{ fontSize: "var(--step-4)" }}>
            Tell it who's talking.
          </h1>
          <p className="mt-4 max-w-[42ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
            Cartoonist attributes every phrase to a person, so it needs a name and a
            colour before it starts listening. Say it out loud and it fills the form itself.
          </p>
        </div>

        <div className="border border-foreground bg-card">
          {/* Voice is the primary path — it sits above the form, not beside it */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground px-5 py-4">
            <div>
              <p className="eyebrow font-mono text-muted-foreground">VOICE INTRO</p>
              <p className="mt-1.5" style={{ fontSize: "var(--step-2)" }}>
                {recording ? "Listening — say your name and what you do." : "Ten seconds. It writes the fields for you."}
              </p>
            </div>
            {recording ? (
              <Button onClick={stopMic} variant="destructive" className="gap-2 rounded-none">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button onClick={startMic} disabled={parsing} className="gap-2 rounded-none">
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {parsing ? "Reading…" : "Record intro"}
              </Button>
            )}
          </div>

          <div className="space-y-6 p-5">
            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">FIRST NAME</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maya" className="h-11 rounded-none border-foreground shadow-none" />
            </div>

            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">WHAT YOU DO</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Designer · PM · Engineer · Founder…" className="h-11 rounded-none border-foreground shadow-none" />
            </div>

            <div>
              <Label className="eyebrow mb-2 block font-mono text-muted-foreground">YOUR COLOUR ON THE CANVAS</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Pick color ${c}`}
                    aria-pressed={color === c}
                    className={`press h-11 w-11 border transition-[box-shadow,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      color === c ? "border-foreground ring-1 ring-foreground ring-offset-2 ring-offset-card" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Button onClick={save} size="lg" className="w-full rounded-none">
              Save and continue
            </Button>
          </div>
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
        <Button variant="outline" onClick={() => { clearProfile(); navigate({ to: "/" }); }} className="rounded-full border-2 border-foreground">
          Sign out
        </Button>
      </div>
    </div>
  );
}
