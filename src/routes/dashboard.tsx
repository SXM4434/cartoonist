import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowRight, Search, Copy, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { loadProfile, removeSession } from "@/lib/profile";
import { useWorkspaceSessions, relativeTime } from "@/hooks/use-workspace-sessions";
import { CartoonistHeader } from "./onboarding";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your studio — Cartoonist sessions" },
      { name: "description", content: "Every Cartoonist session you've run: canvas weight, participants, and last activity in one place." },
      { property: "og:title", content: "Your studio — Cartoonist sessions" },
      { property: "og:description", content: "Every Cartoonist session you've run, with canvas weight and last activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type SortKey = "recent" | "busiest" | "name";

function Dashboard() {
  const navigate = useNavigate();
  const { sessions, loading, refresh } = useWorkspaceSessions();
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    if (!loadProfile()) navigate({ to: "/onboarding" });
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = sessions.filter((s) =>
      !needle ||
      s.name.toLowerCase().includes(needle) ||
      (s.goalFromDb ?? s.goal ?? "").toLowerCase().includes(needle) ||
      (s.joinCode ?? "").toLowerCase().includes(needle),
    );
    const sorted = [...list];
    if (sort === "recent") sorted.sort((a, b) => (b.stats.lastActivity ?? b.createdAt) - (a.stats.lastActivity ?? a.createdAt));
    if (sort === "busiest") sorted.sort((a, b) => b.stats.shapes + b.stats.messages - (a.stats.shapes + a.stats.messages));
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [sessions, q, sort]);

  const totals = useMemo(() => sessions.reduce(
    (acc, s) => ({
      shapes: acc.shapes + s.stats.shapes,
      messages: acc.messages + s.stats.messages,
      people: acc.people + s.stats.participants,
    }),
    { shapes: 0, messages: 0, people: 0 },
  ), [sessions]);

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <CartoonistHeader />
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 1 }}>Your studio</h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "var(--step-2)" }}>
              {sessions.length === 0
                ? "Start a session or hop into one."
                : (
                  <span className="tabular-nums">
                    {sessions.length} session{sessions.length === 1 ? "" : "s"} · {totals.shapes} marks · {totals.messages} utterances · {totals.people} people
                  </span>
                )}
            </p>
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

        {sessions.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-1 min-w-[220px] items-center gap-2 border-2 border-foreground bg-card px-3 py-1.5 rounded-full">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sessions, goals, codes…"
                className="w-full bg-transparent outline-none"
                style={{ fontSize: "var(--step-1)" }}
              />
            </div>
            <div className="flex items-center gap-1 rounded-full border-2 border-foreground bg-card p-1">
              {(["recent", "busiest", "name"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={`rounded-full px-3 py-1 capitalize transition ${sort === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                  style={{ fontSize: "var(--step-0)" }}
                >
                  {k}
                </button>
              ))}
            </div>
            <button
              onClick={() => void refresh()}
              title="Refresh stats"
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-foreground bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}

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
        ) : shown.length === 0 ? (
          <p className="border-2 border-dashed border-border p-10 text-center text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
            Nothing matches “{q}”.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((s) => {
              const live = s.stats.lastActivity !== null && Date.now() - s.stats.lastActivity < 5 * 60 * 1000;
              return (
                <div
                  key={s.roomId}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate({ to: "/sessions/$sessionId", params: { sessionId: s.roomId } })}
                  onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/sessions/$sessionId", params: { sessionId: s.roomId } })}
                  className="group cursor-pointer rounded-2xl border-2 border-foreground bg-card p-5 text-left transition hover:bg-secondary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-mono tracking-widest" style={{ fontSize: "var(--step-0)" }}>
                        {s.joinCode}
                      </span>
                      <button
                        title="Copy join code"
                        onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(s.joinCode ?? ""); toast.success("Join code copied"); }}
                        className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {live && (
                        <span className="flex items-center gap-1 text-[color:var(--accent,#3fb56b)]" style={{ fontSize: "var(--step-0)" }}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> live
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <button
                        title="Remove from studio"
                        onClick={(e) => { e.stopPropagation(); removeSession(s.roomId); void refresh(); toast("Removed from your studio"); }}
                        className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif" style={{ fontSize: "var(--step-3)" }}>{s.name}</h3>
                  {(s.goalFromDb ?? s.goal) && (
                    <p className="mt-1 text-foreground/70 line-clamp-2" style={{ fontSize: "var(--step-1)" }}>{s.goalFromDb ?? s.goal}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground tabular-nums" style={{ fontSize: "var(--step-0)" }}>
                    <span>{s.stats.participants} people</span>
                    <span>·</span>
                    <span>{s.stats.shapes} marks</span>
                    <span>·</span>
                    <span>{s.stats.messages} utterances</span>
                    <span>·</span>
                    <span>{relativeTime(s.stats.lastActivity ?? s.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
