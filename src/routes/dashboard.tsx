import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { loadProfile, loadSessions, type StoredSession } from "@/lib/profile";
import { CartoonistHeader } from "./onboarding";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { navigate({ to: "/onboarding" }); return; }
    setSessions(loadSessions());
  }, [navigate]);

  const join = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    try {
      const { data, error } = await supabase
        .from("rooms").select("id").eq("join_code", code).maybeSingle();
      if (error) throw error;
      if (!data) { toast.error("No session with that code"); return; }
      navigate({ to: "/sessions/$sessionId", params: { sessionId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <CartoonistHeader />
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>Your studio</h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "var(--step-2)" }}>Start a session or hop into one.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border-2 border-foreground bg-card p-1.5">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="JOIN CODE"
              onKeyDown={(e) => e.key === "Enter" && join()}
              className="h-9 w-40 border-0 bg-transparent font-mono tracking-widest shadow-none focus-visible:ring-0"
              maxLength={10}
            />
            <Button onClick={join} disabled={joining || !joinCode} className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
              Join
            </Button>
            <Button onClick={() => navigate({ to: "/sessions/new" })} className="ml-2 gap-1.5 rounded-full bg-foreground px-5 text-background hover:bg-foreground/90">
              <Plus className="h-4 w-4" /> Start session
            </Button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-3xl border-2 border-foreground bg-card p-16 text-center">
            <div className="mx-auto mb-4 text-7xl">🙂</div>
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)" }}>No sessions yet</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
              Let's draw up your first one — Cartoonist will meet you there.
            </p>
            <Button onClick={() => navigate({ to: "/sessions/new" })} className="mt-5 rounded-full bg-primary px-6 py-5 text-primary-foreground hover:bg-primary/90">
              Start a session
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sessions.map((s) => (
              <button
                key={s.roomId}
                onClick={() => navigate({ to: "/sessions/$sessionId", params: { sessionId: s.roomId } })}
                className="group rounded-2xl border-2 border-foreground bg-card p-5 text-left transition hover:bg-secondary"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-mono tracking-widest" style={{ fontSize: "var(--step-0)" }}>
                    {s.joinCode}
                  </span>
                  <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                </div>
                <h3 className="mt-3 font-serif" style={{ fontSize: "var(--step-3)" }}>{s.name}</h3>
                <p className="mt-1 text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>
                  {s.type} · {s.mode} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
