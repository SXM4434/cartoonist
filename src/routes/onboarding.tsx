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
    <main className="min-h-screen bg-background px-4 py-10">
      <CartoonistHeader />
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="text-5xl">🤖</div>
          <div>
            <span className="eyebrow text-primary">Step 1 of 2</span>
            <h1 className="font-serif" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>Say hi to Cartoonist</h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "var(--step-2)" }}>
              Just your name and what you do — the session stuff comes next.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-foreground bg-card p-6 space-y-5">
          <div className="rounded-xl border-2 border-foreground bg-yellow-50 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium" style={{ fontSize: "var(--step-2)" }}>Skip the form — say it</p>
              <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>
                10 sec mic. Cartoonist fills in name + role.
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
            <Label className="mb-1.5 block">First name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Maya" className="rounded-full border-2 border-foreground" />
          </div>

          <div>
            <Label className="mb-1.5 block">What do you do?</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Designer · PM · Engineer · Founder…" className="rounded-full border-2 border-foreground" />
          </div>

          <div>
            <Label className="mb-2 block">Your color on the canvas</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Pick color ${c}`}
                  className={`h-9 w-9 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <Button onClick={save} className="w-full rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
            Save & continue
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
        <Button variant="outline" onClick={() => { clearProfile(); navigate({ to: "/" }); }} className="rounded-full border-2 border-foreground">
          Sign out
        </Button>
      </div>
    </div>
  );
}
