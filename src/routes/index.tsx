import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { loadProfile } from "@/lib/profile";
import { roomByCode } from "@/lib/db-rpc";
import { WorkingSurface, useStageCycle } from "@/components/design/working-surface";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cartoonist — It draws while you talk" },
      { name: "description", content: "Cartoonist listens to the meeting, marks what matters, and draws the conversation into structure — wireframes, flows, decisions and a PRD you can ship." },
      { property: "og:title", content: "Cartoonist — It draws while you talk" },
      { property: "og:description", content: "Speech in, structure out. Cartoonist turns the messy back-and-forth into shared, shippable artifacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const { stage, index } = useStageCycle();

  const goTry = () => {
    if (loadProfile()) navigate({ to: "/dashboard" });
    else navigate({ to: "/onboarding" });
  };

  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setJoining(true);
    try {
      const id = await roomByCode(c);
      if (!id) { toast.error("No session with that code"); return; }
      if (!loadProfile()) {
        sessionStorage.setItem("cartoonist_pending_join", id);
        navigate({ to: "/onboarding" });
        return;
      }
      navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join");
    } finally { setJoining(false); }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Toolbar, not a nav bar */}
      <header className="sticky top-0 z-30 border-b border-foreground bg-background">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-6 py-2.5">
          <a href="/" className="flex items-center gap-2 no-underline">
            <Glyph className="h-5 w-5 text-primary" />
            <span className="font-display font-bold tracking-tight" style={{ fontSize: "var(--step-3)" }}>Cartoonist</span>
          </a>
          <div className="hidden items-center gap-2 font-mono text-muted-foreground sm:flex" style={{ fontSize: "var(--step-0)" }}>
            <StateChip on={index === 0}>LISTENING</StateChip>
            <StateChip on={index === 1}>INTERPRETING</StateChip>
            <StateChip on={index === 2}>DRAWING</StateChip>
            <StateChip on={index === 3}>RESOLVING</StateChip>
          </div>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/examples" })} className="rounded-none">Examples</Button>
            <Button size="sm" onClick={goTry} className="rounded-none">Open a session</Button>
          </nav>
        </div>
      </header>

      {/* HERO — the surface itself */}
      <section className="mx-auto max-w-[1240px] px-6 pb-16 pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <span className="eyebrow font-mono text-muted-foreground">Real-time meeting canvas</span>
            <h1 className="statement mt-4" style={{ fontSize: "var(--step-5)" }}>
              Cartoonist is<br />drawing while<br />you talk.
            </h1>
            <p className="mt-6 max-w-[46ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
              It listens to the room, marks the phrases that carry weight, and builds the
              structure underneath them — live, on a canvas everyone shares.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <Button onClick={goTry} size="lg" className="rounded-none">Start a session</Button>
              <Button onClick={() => setShowJoin((v) => !v)} variant="outline" size="lg" className="rounded-none" aria-expanded={showJoin}>
                Join with a code
              </Button>
            </div>
            {showJoin && (
              <div className="fade-up-in mt-3 flex max-w-sm items-center gap-2 border border-foreground bg-card p-1.5">
                <Input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="JOIN CODE"
                  aria-label="Session join code"
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  className="h-10 rounded-none border-0 bg-transparent font-mono tracking-[0.3em] shadow-none focus-visible:ring-0"
                  maxLength={10}
                />
                <Button onClick={join} disabled={joining || !code} className="rounded-none">{joining ? "…" : "Join"}</Button>
              </div>
            )}
            <p className="mt-5 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
              No account needed · works in the browser
            </p>
          </div>

          <div className="border border-foreground">
            <WorkingSurface stage={stage} index={index} />
          </div>
        </div>
      </section>

      {/* The pass: meeting → listening → drawing → organizing → deliverables */}
      <Pass
        n="01"
        title="Meeting"
        lede="Everyone talks over each other. That's fine — Cartoonist is the one taking it down."
        note="4 participants · 1 device or many"
      >
        <SpeechStack />
      </Pass>

      <Pass
        n="02"
        title="Listening"
        lede="Speech is attributed per person, so the quiet voice in the corner keeps its authorship."
        note="Diarized · attributed · searchable"
      >
        <ListenStrip />
      </Pass>

      <Pass
        n="03"
        title="Drawing"
        lede="Ask for a flow, a wireframe, a system map. It starts rough — thin tracing lines, temporary labels — then resolves."
        note="Lo-fi → hi-fi on request"
      >
        <RoughToResolved />
      </Pass>

      <Pass
        n="04"
        title="Organizing"
        lede="Open threads, unresolved questions and inferred decisions stay pinned in the margin instead of evaporating."
        note="Threads carry across sessions"
      >
        <MarginNotes />
      </Pass>

      <Pass
        n="05"
        title="Deliverables"
        lede="At the end you leave with the artifact, not a recording you'll never open again."
        note="Editable · exportable"
        last
      >
        <Deliverables />
      </Pass>

      <section className="border-t border-foreground">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-6 px-6 py-14">
          <h2 className="statement max-w-[16ch]" style={{ fontSize: "var(--step-4)" }}>
            Put it in front of your next meeting.
          </h2>
          <Button onClick={goTry} size="lg" className="rounded-none">Start a session</Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-7 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
          <span className="uppercase tracking-[0.18em]">Cartoonist</span>
          <span>Built for teams who think out loud.</span>
        </div>
      </footer>
    </main>
  );
}

function StateChip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className="border px-2 py-0.5 uppercase tracking-[0.16em] transition-colors duration-200"
      style={{
        borderColor: on ? "var(--color-foreground)" : "var(--color-border)",
        color: on ? "var(--color-foreground)" : "var(--color-muted-foreground)",
        backgroundColor: on ? "var(--color-accent)" : "transparent",
      }}
    >
      {children}
    </span>
  );
}

function Pass({
  n, title, lede, note, children, last,
}: { n: string; title: string; lede: string; note: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`border-t border-foreground ${last ? "" : ""}`}>
      <div className="mx-auto grid max-w-[1240px] gap-8 px-6 py-14 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)]">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="eyebrow tnum font-mono text-primary">{n}</span>
            <h2 className="font-display" style={{ fontSize: "var(--step-4)" }}>{title}</h2>
          </div>
          <p className="mt-3 max-w-[44ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>{lede}</p>
          <p className="mt-4 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{note}</p>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

function SpeechStack() {
  const lines = [
    { who: "MAYA", text: "Onboarding drops people into an empty room." },
    { who: "DEV", text: "And nobody knows what the first move is." },
    { who: "PRIYA", text: "What if their first session is the tutorial?" },
  ];
  return (
    <ul className="space-y-2">
      {lines.map((l, i) => (
        <li key={l.who} className="flex items-start gap-3 border border-border bg-card p-3" style={{ marginLeft: i * 24 }}>
          <span className="eyebrow shrink-0 font-mono text-muted-foreground">{l.who}</span>
          <span style={{ fontSize: "var(--step-2)" }}>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ListenStrip() {
  const bars = [6, 14, 9, 22, 30, 18, 11, 26, 34, 16, 8, 20, 28, 12, 24, 9, 17, 31, 13, 7, 21, 15, 27, 10];
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex h-16 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="flex-1" style={{ height: `${h * 2}px`, backgroundColor: i > 8 && i < 15 ? "var(--color-primary)" : "var(--color-secondary)" }} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
        <span>MAYA 41%</span><span>DEV 28%</span><span>PRIYA 24%</span><span>SAM 7%</span>
        <span className="text-primary">Sam hasn't spoken in 6 min — invited</span>
      </div>
    </div>
  );
}

function RoughToResolved() {
  return (
    <div className="grid gap-px bg-border sm:grid-cols-2">
      {(["Rough", "Resolved"] as const).map((label) => {
        const done = label === "Resolved";
        return (
          <div key={label} className="bg-card p-4">
            <span className="eyebrow font-mono text-muted-foreground">{label}</span>
            <svg viewBox="0 0 240 150" className="mt-3 w-full text-foreground" fill="none" role="img" aria-label={`${label} wireframe`}>
              <g stroke="currentColor" strokeWidth={done ? 2 : 1} className={done ? "rough resolved" : "rough"}>
                <rect x="12" y="12" width="216" height="26" />
                <rect x="12" y="48" width="130" height="90" />
                <rect x="152" y="48" width="76" height="42" />
                <rect x="152" y="98" width="76" height="40" />
              </g>
              {done && (
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".45">
                  <path d="M26 68h100M26 82h72M26 96h88M166 66h48M166 116h34" />
                </g>
              )}
              {done && <rect x="164" y="76" width="52" height="6" fill="var(--color-primary)" />}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function MarginNotes() {
  const notes = [
    "3 unresolved questions",
    "Decision inferred: ship guided session first",
    "Converted to action item — Dev",
    "2 participants disagreed here",
  ];
  return (
    <ul className="grid gap-px bg-border sm:grid-cols-2">
      {notes.map((n) => (
        <li key={n} className="flex items-start gap-3 bg-card p-4">
          <span className="mt-1.5 h-2 w-2 shrink-0 bg-primary" aria-hidden />
          <span className="font-mono" style={{ fontSize: "var(--step-1)" }}>{n}</span>
        </li>
      ))}
    </ul>
  );
}

function Deliverables() {
  const items = ["PRD draft", "Decision log", "Action items", "User journey", "Flow diagram", "Session recap"];
  return (
    <div className="grid gap-px bg-border sm:grid-cols-3">
      {items.map((it, i) => (
        <div key={it} className="bg-card p-4">
          <span className="eyebrow tnum font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          <p className="mt-2 font-display font-bold" style={{ fontSize: "var(--step-3)" }}>{it}</p>
        </div>
      ))}
    </div>
  );
}

function Glyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="2.5" y="4.5" width="27" height="20" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M7 19c4-9 8 4 11-3s5 1 7-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 24.5 10 29M20 24.5l2 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
