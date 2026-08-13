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
import { roomByCode } from "@/lib/db-rpc";

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
      const id = await roomByCode(code);
      if (!id) { toast.error("No session with that code"); return; }
      navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
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
    <main className="min-h-screen bg-background">
      <CartoonistHeader />
      <div className="mx-auto max-w-[1240px] px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <h1 className="statement max-w-[10ch]" style={{ fontSize: "var(--step-4)" }}>Your studio</h1>
            <p className="mt-3 max-w-[46ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
              {sessions.length === 0
                ? "Nothing on the desk yet. Start a session and Cartoonist will meet you there."
                : "Every session you've run, with what the room actually produced."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border border-foreground bg-card">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="JOIN CODE"
                aria-label="Session join code"
                onKeyDown={(e) => e.key === "Enter" && join()}
                className="h-10 w-36 rounded-none border-0 bg-transparent font-mono tracking-[0.3em] shadow-none focus-visible:ring-0"
                maxLength={10}
              />
              <Button onClick={join} disabled={joining || !joinCode} variant="ghost" className="h-10 rounded-none border-l border-foreground">
                Join
              </Button>
            </div>
            <Button onClick={() => navigate({ to: "/sessions/new" })} className="h-10 gap-1.5 rounded-none">
              <Plus className="h-4 w-4" /> Start session
            </Button>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-foreground py-2.5 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            <span className="tabular-nums uppercase tracking-[0.16em]">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} · {totals.shapes} marks · {totals.messages} utterances · {totals.people} people
            </span>
            <span className="flex min-w-[180px] flex-1 items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sessions, goals, codes…"
                aria-label="Search sessions"
                className="w-full bg-transparent font-sans outline-none placeholder:text-muted-foreground"
                style={{ fontSize: "var(--step-1)" }}
              />
            </span>
            <span className="flex items-center gap-3">
              <span className="uppercase tracking-[0.16em]">sort</span>
              {(["recent", "busiest", "name"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  aria-pressed={sort === k}
                  className={`press uppercase tracking-[0.16em] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    sort === k ? "text-foreground underline" : "hover:text-foreground"
                  }`}
                >
                  {k}
                </button>
              ))}
            </span>
            <button
              onClick={() => void refresh()}
              aria-label="Refresh stats"
              className="press flex h-8 w-8 items-center justify-center hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="mt-10 border border-dashed border-foreground/40 px-8 py-20">
            <p className="eyebrow font-mono text-muted-foreground">EMPTY DESK</p>
            <h2 className="statement mt-3 max-w-[26ch]" style={{ fontSize: "var(--step-4)" }}>
              The first session is the one that teaches it your room.
            </h2>
            <Button onClick={() => navigate({ to: "/sessions/new" })} size="lg" className="mt-6 rounded-none">
              Start a session
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-10 border border-dashed border-foreground/40 px-8 py-16 text-muted-foreground" style={{ fontSize: "var(--step-2)" }}>
            Nothing matches “{q}”.
          </p>
        ) : (
          <ul className="mt-px grid list-none gap-px bg-border md:grid-cols-2">
            {shown.map((s) => {
              const live = s.stats.lastActivity !== null && Date.now() - s.stats.lastActivity < 5 * 60 * 1000;
              const open = () => navigate({ to: "/sessions/$sessionId", params: { sessionId: s.roomId } });
              return (
                <li
                  key={s.roomId}
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => e.key === "Enter" && open()}
                  className="group cursor-pointer bg-card p-5 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="flex items-center justify-between gap-2 font-mono" style={{ fontSize: "var(--step-0)" }}>
                    <span className="flex items-center gap-2">
                      <span className="border border-border px-2 py-0.5 tracking-[0.2em]">{s.joinCode}</span>
                      <button
                        aria-label="Copy join code"
                        onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(s.joinCode ?? ""); toast.success("Join code copied"); }}
                        className="press text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {live && (
                        <span className="flex items-center gap-1.5 uppercase tracking-[0.16em] text-primary">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-current opacity-70" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                          </span>
                          live
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        aria-label="Remove from studio"
                        onClick={(e) => { e.stopPropagation(); removeSession(s.roomId); void refresh(); toast("Removed from your studio"); }}
                        className="press text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                  </div>
                  <h3 className="mt-3 font-display" style={{ fontSize: "var(--step-3)" }}>{s.name}</h3>
                  {(s.goalFromDb ?? s.goal) && (
                    <p className="mt-1 line-clamp-2 max-w-[52ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.5 }}>
                      {s.goalFromDb ?? s.goal}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                    <span>{s.stats.participants} people</span>
                    <span aria-hidden>·</span>
                    <span>{s.stats.shapes} marks</span>
                    <span aria-hidden>·</span>
                    <span>{s.stats.messages} utterances</span>
                    <span aria-hidden>·</span>
                    <span>{relativeTime(s.stats.lastActivity ?? s.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
