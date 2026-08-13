import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { loadProfile } from "@/lib/profile";
import { roomByCode } from "@/lib/db-rpc";
import { Marks } from "@/components/design/marks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cartoonist — Teams that draw it out, together" },
      { name: "description", content: "Cartoonist quietly listens to your meetings — surfacing overlooked ideas, drawing the conversation live, and turning the messy back-and-forth into shippable plans." },
      { property: "og:title", content: "Cartoonist — Teams that draw it out, together" },
      { property: "og:description", content: "An AI mediator that turns meetings into a live visual canvas." },
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
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <Glyph className="h-7 w-7 text-primary" />
          <span className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--step-3)" }}>Cartoonist</span>
        </a>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => navigate({ to: "/examples" })} className="rounded-none">Examples</Button>
          <Button variant="ghost" onClick={goTry} className="rounded-none">Dashboard</Button>
        </nav>
      </header>
      <hr className="mx-6 border-0 border-t border-border" />

      <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-16 md:grid-cols-[1.15fr_0.85fr] md:items-end">
        <div>
          <span className="eyebrow text-muted-foreground">Hackathon 2026 — AI mediator for teams</span>

          <h1 className="mt-5 font-serif font-medium" style={{ fontSize: "var(--step-5)", lineHeight: 0.98 }}>
            Teams that draw
            <br />
            it out,{" "}
            <span className="relative inline-block text-primary">
              together.
              <Marks className="absolute -bottom-3 left-0 h-4 w-full text-primary/70" />
            </span>
          </h1>

          <p className="mt-8 max-w-[52ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>
            Cartoonist quietly listens to your meetings — surfacing overlooked ideas,
            drawing the conversation live, and turning the messy back-and-forth into
            shippable plans.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button onClick={goTry} size="lg" className="rounded-none">
              Try it free — no account needed
            </Button>
            <Button onClick={() => setShowJoin((v) => !v)} variant="outline" size="lg" className="rounded-none" aria-expanded={showJoin}>
              Join with a code
            </Button>
          </div>

          {showJoin && (
            <div className="mt-4 flex max-w-md items-center gap-2 border border-foreground bg-card p-1.5">
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
              <Button onClick={join} disabled={joining || !code} className="rounded-none">
                {joining ? "…" : "Join"}
              </Button>
            </div>
          )}
        </div>

        <HeroSketch />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <hr className="ink-rule mb-10 w-full" />
        <div className="grid gap-px bg-border md:grid-cols-3">
          <FeatureCard idx="01" title="Hears everyone" body="Quiet, analytical, introverted — Cartoonist surfaces the ideas loud voices missed." />
          <FeatureCard idx="02" title="Draws live" body="Watch the conversation become a living flow diagram on a shared whiteboard." />
          <FeatureCard idx="03" title="Ships docs" body="PRDs, user journeys, timelines, action items — generated and ready to edit." />
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-8">
        <span className="eyebrow text-muted-foreground">Cartoonist — draw the meeting</span>
        <span className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>Built for teams who think out loud.</span>
      </footer>
    </main>
  );
}

function FeatureCard({ idx, title, body }: { idx: string; title: string; body: string }) {
  return (
    <div className="paper-surface group p-7">
      <span className="eyebrow tnum text-primary">{idx}</span>
      <h2 className="mt-4 font-serif font-medium" style={{ fontSize: "var(--step-3)" }}>{title}</h2>
      <p className="mt-3 max-w-[38ch] text-muted-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.6 }}>{body}</p>
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

/** Hand-drawn isometric "session in progress" — ink on paper, no emoji. */
function HeroSketch() {
  return (
    <figure className="relative select-none">
      <svg viewBox="0 0 420 330" fill="none" className="w-full text-foreground" role="img" aria-label="Sketch of a live shared whiteboard with sticky notes">
        {/* board */}
        <rect x="26" y="30" width="330" height="216" stroke="currentColor" strokeWidth="2" />
        <rect x="31" y="35" width="330" height="216" stroke="currentColor" strokeWidth="1" opacity=".35" />
        {/* flow boxes */}
        <rect x="56" y="62" width="86" height="46" stroke="currentColor" strokeWidth="2" />
        <rect x="196" y="62" width="86" height="46" stroke="currentColor" strokeWidth="2" />
        <rect x="126" y="150" width="118" height="54" stroke="currentColor" strokeWidth="2" />
        <path d="M142 85h52" stroke="currentColor" strokeWidth="2" />
        <path d="M186 84l8 1-8 4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M99 108c1 24 40 16 72 40" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
        <path d="M239 108c-2 22-24 20-30 40" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
        {/* text lines */}
        <g opacity=".55" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M68 78h50M68 88h32M208 78h56M208 88h28M142 168h84M142 180h56M142 190h68" />
        </g>
        {/* accent sticky */}
        <g className="text-primary">
          <rect x="286" y="164" width="104" height="84" fill="currentColor" opacity=".14" />
          <rect x="286" y="164" width="104" height="84" stroke="currentColor" strokeWidth="2" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".8">
            <path d="M300 190h72M300 204h54M300 218h64" />
          </g>
        </g>
        {/* cursor + label */}
        <path d="M196 232l6 30 8-12 13 3z" fill="currentColor" />
        <rect x="216" y="262" width="76" height="22" fill="currentColor" />
        <text x="226" y="277" fontSize="11" letterSpacing="0.12em" fill="var(--color-background)">MAYA</text>
      </svg>
      <figcaption className="mt-4 eyebrow text-muted-foreground">Live canvas — drawn while you talk</figcaption>
    </figure>
  );
}
