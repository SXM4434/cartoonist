import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadProfile } from "@/lib/profile";
import { roomByCode } from "@/lib/db-rpc";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cartoonist — Teams that draw it out, together" },
      { name: "description", content: "Cartoonist quietly listens to your meetings — surfacing overlooked ideas, drawing the conversation live, and turning the messy back-and-forth into shippable plans." },
      { property: "og:title", content: "Cartoonist — Teams that draw it out, together" },
      { property: "og:description", content: "An AI mediator that turns meetings into a live visual canvas." },
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
      <header className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border-2 border-foreground bg-card mt-4 mx-4 sm:mx-auto px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">🤖</span>
          <span className="font-serif font-semibold" style={{ fontSize: "var(--step-3)" }}>Cartoonist</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={goTry} className="rounded-full">Dashboard</Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-block rounded-full bg-yellow-200 px-4 py-1.5 font-medium text-yellow-900" style={{ fontSize: "var(--step-1)" }}>
              Hackathon 2026 ✦ AI mediator for teams
            </span>
            <h1 className="mt-6 font-serif font-medium" style={{ fontSize: "var(--step-6)", lineHeight: 0.95 }}>
              Teams that draw it<br/>out, <span className="text-primary">together.</span>
            </h1>
            <p className="mt-5 max-w-xl text-foreground/80" style={{ fontSize: "var(--step-2)", lineHeight: 1.55 }}>
              Cartoonist quietly listens to your meetings — surfacing overlooked ideas, drawing the conversation live, and turning the messy back-and-forth into shippable plans.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button onClick={goTry} className="rounded-full bg-primary px-6 py-6 text-base font-medium text-primary-foreground hover:bg-primary/90">
                Try it free — no account needed
              </Button>
              <Button onClick={() => setShowJoin((v) => !v)} variant="outline" className="rounded-full border-2 border-foreground bg-card px-6 py-6 text-base font-medium hover:bg-secondary">
                Join with a code
              </Button>
            </div>
            {showJoin && (
              <div className="mt-4 flex items-center gap-2 rounded-full border-2 border-foreground bg-card p-1.5 max-w-md">
                <Input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="JOIN CODE"
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  className="h-10 border-0 bg-transparent font-mono tracking-widest shadow-none focus-visible:ring-0"
                  maxLength={10}
                />
                <Button onClick={join} disabled={joining || !code} className="rounded-full bg-foreground px-5 text-background hover:bg-foreground/90">
                  {joining ? "…" : "Join"}
                </Button>
              </div>
            )}
          </div>

          <div className="relative mx-auto h-[360px] w-full max-w-md">
            <div className="absolute left-0 top-6 -rotate-6 rounded-2xl border-2 border-foreground bg-yellow-200 p-5 shadow-[6px_6px_0_0_#1a1a1a]" style={{ width: 180 }}>
              <p className="font-medium text-yellow-950" style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "var(--step-2)" }}>"Someone has an idea 💡"</p>
            </div>
            <div className="absolute inset-x-0 top-2 mx-auto flex h-64 w-64 items-center justify-center rounded-full border-2 border-foreground bg-primary text-[110px]">
              🤖
            </div>
            <div className="absolute bottom-0 right-0 rotate-3 rounded-2xl border-2 border-foreground bg-teal-200 p-5 shadow-[6px_6px_0_0_#1a1a1a]" style={{ width: 200 }}>
              <p className="font-medium text-teal-950" style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "var(--step-2)" }}>Live whiteboard 🎨</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 grid gap-4 md:grid-cols-3">
        <FeatureCard title="Hears everyone" body="Quiet, analytical, introverted — Cartoonist surfaces ideas loud voices missed." />
        <FeatureCard title="Draws live" body="Watch the conversation become a living flow diagram on a shared whiteboard." />
        <FeatureCard title="Ships docs" body="PRDs, user journeys, timelines, action items — generated and ready to edit." />
      </section>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-foreground bg-card p-5">
      <h3 className="font-serif font-medium" style={{ fontSize: "var(--step-3)" }}>{title}</h3>
      <p className="mt-2 text-foreground/75" style={{ fontSize: "var(--step-2)", lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}
