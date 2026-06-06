import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { addSession, loadProfile } from "@/lib/profile";
import { CartoonistHeader } from "./onboarding";

const TYPES = [
  { id: "hackathon", label: "Hackathon", emoji: "🏆" },
  { id: "team-meeting", label: "Team meeting", emoji: "📅" },
  { id: "collaboration", label: "Collaboration", emoji: "🤝" },
  { id: "brainstorm", label: "Brainstorm", emoji: "💡" },
];
const MODES = [
  { id: "chat", label: "Chat only", emoji: "💬" },
  { id: "audio", label: "Audio only", emoji: "🎙️" },
  { id: "both", label: "Audio + chat", emoji: "✨" },
];
const OUTPUTS = ["Summary", "PRD", "User journey", "Product flow", "Timeline", "Problem statement", "Action items"];

export const Route = createFileRoute("/sessions/new")({
  ssr: false,
  component: NewSession,
});

function NewSession() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("brainstorm");
  const [mode, setMode] = useState("both");
  const [outputs, setOutputs] = useState<string[]>(["Summary", "Action items"]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!loadProfile()) navigate({ to: "/onboarding" }); }, [navigate]);

  const toggleOutput = (o: string) =>
    setOutputs((cur) => cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);

  const create = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          name: name.trim() || "Untitled session",
          session_type: type,
          mode,
          outputs,
        })
        .select("id, join_code, name")
        .single();
      if (error) throw error;
      addSession({
        roomId: data.id,
        joinCode: data.join_code ?? "",
        name: data.name,
        type, mode, outputs,
        createdAt: Date.now(),
      });
      navigate({ to: "/sessions/$sessionId", params: { sessionId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <CartoonistHeader />
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>New session</h1>
        <p className="text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>Three quick choices and you're in.</p>

        <div className="mt-6 rounded-2xl border-2 border-foreground bg-card p-6 space-y-5">
          <div>
            <Label className="mb-1.5 block">Session name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 planning, Hackathon kickoff…" className="rounded-full border-2 border-foreground" />
          </div>

          <div>
            <Label className="mb-2 block">Type</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${type === t.id ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground/60"}`}>
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="mt-1 font-medium">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button key={m.id} type="button" onClick={() => setMode(m.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${mode === m.id ? "border-foreground bg-secondary" : "border-border bg-background hover:border-foreground/60"}`}>
                  <div className="text-2xl">{m.emoji}</div>
                  <div className="mt-1 font-medium">{m.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Voice transcription works best in Chrome / Edge.</p>
          </div>

          <div>
            <Label className="mb-2 block">Desired outputs</Label>
            <div className="flex flex-wrap gap-2">
              {OUTPUTS.map((o) => (
                <button key={o} type="button" onClick={() => toggleOutput(o)}
                  className={`rounded-full border-2 px-3 py-1 text-sm transition ${outputs.includes(o) ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/60"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={create} disabled={creating} className="w-full rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
            {creating ? "Creating…" : "Create session"}
          </Button>
        </div>
      </div>
    </main>
  );
}
