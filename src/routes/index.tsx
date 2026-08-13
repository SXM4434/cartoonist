import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

      {/* 01 — MEETING: conversation flows across the full width */}
      <section className="border-t border-foreground">
        <div className="mx-auto max-w-[1240px] px-6 py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow tnum font-mono text-primary">01</span>
              <h2 className="font-display" style={{ fontSize: "var(--step-4)" }}>Meeting</h2>
            </div>
            <p className="max-w-[46ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
              Everyone talks over each other. That's fine — Cartoonist is the one taking it down.
            </p>
          </div>
          <SpeechFlow />
        </div>
      </section>

      {/* 02 — LISTENING: horizontal, data-like, heading sits inline with the readout */}
      <section className="border-t border-foreground">
        <div className="mx-auto grid max-w-[1240px] items-center gap-6 px-6 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow tnum font-mono text-primary">02</span>
            <h2 className="font-display" style={{ fontSize: "var(--step-3)" }}>Listening</h2>
          </div>
          <ListenStrip />
        </div>
        <div className="mx-auto max-w-[1240px] px-6 pb-10">
          <p className="max-w-[62ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
            Speech is attributed per person, so the quiet voice in the corner keeps its authorship.
          </p>
        </div>
      </section>

      {/* 03 — DRAWING: takes the whole viewport, the drafting sheet lifts off */}
      <section className="border-t border-foreground bg-secondary/40">
        <div className="mx-auto max-w-[1240px] px-6 py-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="eyebrow tnum font-mono text-primary">03</span>
              <h2 className="statement mt-3 max-w-[12ch]" style={{ fontSize: "var(--step-5)" }}>
                Rough first. Then resolved.
              </h2>
            </div>
            <p className="hidden max-w-[34ch] text-muted-foreground md:block" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
              Ask for a flow, a wireframe, a system map. Construction lines land on translucent
              drafting paper — when the room agrees, the sheet lifts and the interface underneath commits.
            </p>
          </div>
          <RoughToResolved />
        </div>
      </section>

      {/* 04 — ORGANIZING: annotations scattered around a central artifact */}
      <section className="border-t border-foreground">
        <div className="mx-auto max-w-[1240px] px-6 py-14">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow tnum font-mono text-primary">04</span>
            <h2 className="font-display" style={{ fontSize: "var(--step-4)" }}>Organizing</h2>
          </div>
          <p className="mt-3 max-w-[52ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
            Open threads, unresolved questions and inferred decisions stay pinned around the artifact
            instead of evaporating when the call ends.
          </p>
          <MarginNotes />
        </div>
      </section>

      {/* 05 — DELIVERABLES: overlapping sheets */}
      <section className="border-t border-foreground">
        <div className="mx-auto max-w-[1240px] px-6 py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
            <div>
              <span className="eyebrow tnum font-mono text-primary">05</span>
              <h2 className="mt-2 font-display" style={{ fontSize: "var(--step-4)" }}>Deliverables</h2>
              <p className="mt-3 max-w-[42ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
                You leave with the artifact, not a recording nobody opens again.
              </p>
            </div>
            <Deliverables />
          </div>
        </div>
      </section>

      <section className="border-t border-foreground">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-6 px-6 py-14">
          <h2 className="statement max-w-[16ch]" style={{ fontSize: "var(--step-4)" }}>
            Put it in front of your next meeting.
          </h2>
          <Button onClick={goTry} size="lg" className="rounded-none">Start a session</Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-7 text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>
          <span className="font-mono uppercase tracking-[0.18em]" style={{ fontSize: "var(--step-0)" }}>Cartoonist</span>
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

/** Conversation running left-to-right across the page, overlapping as people cut in. */
function SpeechFlow() {
  const lines = [
    { who: "MAYA", t: "00:04", text: "Onboarding drops people into an empty room.", drop: 0 },
    { who: "DEV", t: "00:09", text: "Nobody knows what the first move is.", drop: 44 },
    { who: "PRIYA", t: "00:13", text: "What if their first session is the tutorial?", drop: 14 },
    { who: "SAM", t: "00:21", text: "Then we have to seed it with their data.", drop: 58 },
  ];
  return (
    <div className="mt-10 overflow-x-auto pb-2">
      <ul className="flex min-w-[860px] items-start gap-0">
        {lines.map((l, i) => (
          <li
            key={l.who}
            className="relative flex-1 border-l border-foreground pl-4 pr-6"
            style={{ marginTop: l.drop }}
          >
            <div className="flex items-baseline gap-2 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
              <span className="tnum">{l.t}</span>
              <span className="uppercase tracking-[0.16em] text-foreground">{l.who}</span>
            </div>
            <p className="mt-2 max-w-[26ch]" style={{ fontSize: "var(--step-2)", lineHeight: 1.5 }}>
              {i === 2 ? <span className="marker" data-on="true">{l.text}</span> : l.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListenStrip() {
  const bars = [6, 14, 9, 22, 30, 18, 11, 26, 34, 16, 8, 20, 28, 12, 24, 9, 17, 31, 13, 7, 21, 15, 27, 10, 19, 25, 11, 30];
  return (
    <div className="border border-foreground bg-card p-4">
      <div className="flex h-14 items-end gap-1" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="flex-1" style={{ height: `${h * 1.6}px`, backgroundColor: i > 8 && i < 15 ? "var(--color-primary)" : "var(--color-secondary)" }} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
        <span className="tnum">MAYA 41%</span><span className="tnum">DEV 28%</span>
        <span className="tnum">PRIYA 24%</span><span className="tnum">SAM 7%</span>
        <span className="text-primary">SAM SILENT 6:12 — INVITED</span>
      </div>
    </div>
  );
}

/** The material argument: a translucent drafting sheet sitting over a committed interface. */
function RoughToResolved() {
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setLifted(true);
    const t = setInterval(() => setLifted((v) => !v), 3400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mt-10">
      <div className="relative border border-foreground bg-card">
        <svg viewBox="0 0 900 380" className="block w-full text-foreground" fill="none" role="img"
             aria-label={lifted ? "Resolved interface" : "Rough construction over the resolved interface"}>
          {/* committed interface */}
          <g stroke="currentColor" strokeWidth="1.5" fill="var(--color-background)">
            <rect x="40" y="34" width="820" height="44" />
            <rect x="40" y="98" width="330" height="248" />
            <rect x="392" y="98" width="468" height="120" />
            <rect x="392" y="234" width="228" height="112" />
            <rect x="642" y="234" width="218" height="112" />
          </g>
          <g stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round">
            <path d="M60 140h250M60 168h190M60 196h226M60 224h150M412 140h300M412 168h250M412 276h160M662 276h150M662 304h96" />
          </g>
          <rect x="60" y="300" width="120" height="20" fill="var(--color-primary)" />
          <rect x="60" y="52" width="88" height="10" fill="currentColor" opacity="0.5" />

          {/* drafting sheet */}
          <g className="drafting-sheet" data-lifted={lifted ? "true" : "false"}>
            <rect x="16" y="14" width="868" height="352" fill="var(--color-primary)" opacity="0.06" />
            <rect x="16" y="14" width="868" height="352" stroke="var(--color-primary)" strokeWidth="1" opacity="0.3" fill="none" />
            <g stroke="var(--color-primary)" strokeWidth="1" className="rough" fill="none">
              <rect x="40" y="34" width="820" height="44" />
              <rect x="40" y="98" width="330" height="248" />
              <rect x="392" y="98" width="468" height="120" />
              <rect x="392" y="234" width="228" height="112" />
              <rect x="642" y="234" width="218" height="112" />
            </g>
            <g stroke="var(--color-primary)" strokeWidth="1" opacity="0.6" strokeLinecap="round">
              <path d="M40 26v-10M370 26v-10M392 26v-10M860 26v-10M30 98h-12M30 346h-12" />
            </g>
            <g fill="var(--color-primary)" opacity="0.7" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.1em">
              <text x="52" y="120">LIST?</text>
              <text x="404" y="120">DETAIL</text>
              <text x="404" y="256">RECAP?</text>
            </g>
          </g>
        </svg>

        <div className="flex items-center justify-between border-t border-foreground px-4 py-2 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
          <span className="uppercase tracking-[0.18em]">{lifted ? "COMMITTED" : "DRAFTING LAYER · PROVISIONAL"}</span>
          <button
            type="button"
            onClick={() => setLifted((v) => !v)}
            className="border border-foreground px-2 py-0.5 uppercase tracking-[0.18em] text-foreground press hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
          >
            {lifted ? "Lay draft back" : "Lift the sheet"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Annotations pinned around a central artifact, each tethered by a connector. */
function MarginNotes() {
  const left = ["3 unresolved questions", "2 participants disagreed here"];
  const right = ["Decision inferred: ship guided session first", "Converted to action item — Dev"];
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
      <ul className="space-y-8">
        {left.map((n) => (
          <li key={n} className="relative pr-6 text-right">
            <span className="font-mono" style={{ fontSize: "var(--step-1)" }}>{n}</span>
            <span className="absolute right-0 top-1/2 hidden h-px w-6 bg-primary lg:block" aria-hidden />
          </li>
        ))}
      </ul>

      <div className="border border-foreground bg-card p-5">
        <span className="eyebrow font-mono text-muted-foreground">Session artifact · v3</span>
        <svg viewBox="0 0 300 160" className="mt-3 w-full text-foreground" fill="none" aria-hidden>
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="10" y="10" width="280" height="26" />
            <rect x="10" y="48" width="130" height="100" />
            <rect x="152" y="48" width="138" height="46" />
            <rect x="152" y="104" width="138" height="44" />
          </g>
          <g stroke="currentColor" strokeWidth="1.5" opacity="0.3" strokeLinecap="round">
            <path d="M22 74h100M22 96h70M164 70h96M164 126h60" />
          </g>
          <rect x="22" y="120" width="60" height="12" fill="var(--color-primary)" />
        </svg>
      </div>

      <ul className="space-y-8">
        {right.map((n) => (
          <li key={n} className="relative pl-6">
            <span className="font-mono" style={{ fontSize: "var(--step-1)" }}>{n}</span>
            <span className="absolute left-0 top-1/2 hidden h-px w-6 bg-primary lg:block" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Overlapping sheets you can pull forward. */
function Deliverables() {
  const items = [
    { name: "PRD draft", meta: "MD · 6 sections" },
    { name: "Decision log", meta: "9 entries" },
    { name: "Action items", meta: "4 owners" },
    { name: "Flow diagram", meta: "SVG · editable" },
  ];
  return (
    <ul className="flex flex-wrap gap-y-4 sm:flex-nowrap">
      {items.map((it, i) => (
        <li
          key={it.name}
          tabIndex={0}
          className="sheet relative min-h-[132px] w-[48%] shrink-0 border border-foreground bg-card p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-[27%]"

          style={{ marginLeft: i === 0 ? 0 : -18, zIndex: i, transform: `rotate(${(i % 2 ? 0.5 : -0.5).toFixed(2)}deg)` }}
        >
          <p className="font-display font-bold" style={{ fontSize: "var(--step-3)" }}>{it.name}</p>
          <p className="mt-8 font-mono text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>{it.meta}</p>
        </li>
      ))}
    </ul>
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

