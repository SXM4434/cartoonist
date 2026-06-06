import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cartoonist — Live AI storyboard for meetings" },
      {
        name: "description",
        content:
          "An AI mediator that listens to your meeting and draws a live visual storyboard — sticky notes, user flows, journey maps, decisions — on a shared canvas.",
      },
      { property: "og:title", content: "Cartoonist — Live AI storyboard for meetings" },
      {
        property: "og:description",
        content: "AI mediator that turns meetings into a live visual canvas.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name: name.trim() || "Untitled meeting" })
        .select()
        .single();
      if (error) throw error;
      navigate({ to: "/r/$roomId", params: { roomId: data.id } });
    } catch (e) {
      console.error(e);
      toast.error("Could not create room");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top masthead — editorial nameplate */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-8 py-4">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow text-foreground">Cartoonist</span>
            <span className="eyebrow text-muted-foreground" data-numeric>
              Vol. 01 · No. 06 — Jun 6, 2026
            </span>
          </div>
          <span className="eyebrow text-muted-foreground">An AI mediator for meetings</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-8">
        {/* Hero — asymmetric 8/4 split, not centered */}
        <section className="grid grid-cols-12 gap-8 border-b border-border py-16 lg:py-24">
          <div className="col-span-12 lg:col-span-8">
            <p className="eyebrow text-primary">№ 001 — The live storyboard</p>
            <h1
              className="font-serif font-medium tracking-tight text-foreground"
              style={{ fontSize: "var(--step-6)", lineHeight: 0.95 }}
            >
              Meetings,
              <br />
              drawn as
              <br />
              they happen.
              <span className="text-primary">.</span>
            </h1>
          </div>
          <aside className="col-span-12 flex flex-col justify-end lg:col-span-4">
            <p
              className="max-w-[42ch] text-foreground/80"
              style={{ fontSize: "var(--step-2)", lineHeight: 1.55 }}
            >
              Start a room. Share the link. Talk. Cartoonist listens, decides what
              the conversation actually <em className="font-serif">is</em> — a flow, a
              journey, a decision — and draws it on a shared canvas in real time.
            </p>
            <p className="eyebrow mt-6 text-muted-foreground">
              Read time · <span data-numeric>40s</span> &nbsp;|&nbsp; Setup ·{" "}
              <span data-numeric>10s</span>
            </p>
          </aside>
        </section>

        {/* Start strip — single primary action, no card-on-card */}
        <section className="grid grid-cols-12 gap-8 border-b border-border py-12">
          <div className="col-span-12 lg:col-span-4">
            <p className="eyebrow text-muted-foreground">Step 01</p>
            <h2 className="font-serif" style={{ fontSize: "var(--step-3)", lineHeight: 1.15 }}>
              Open a room
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <label
              htmlFor="meeting"
              className="eyebrow mb-3 block text-muted-foreground"
            >
              Meeting name
            </label>
            <div className="flex items-stretch border border-border bg-card">
              <Input
                id="meeting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hackathon kickoff"
                onKeyDown={(e) => e.key === "Enter" && create()}
                className="h-14 flex-1 border-0 bg-transparent px-5 font-serif shadow-none focus-visible:ring-0"
                style={{ fontSize: "var(--step-3)" }}
              />
              <Button
                onClick={create}
                disabled={creating}
                className="h-auto gap-2 rounded-none border-l border-border bg-foreground px-6 text-background hover:bg-foreground/90"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Start
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
            <p
              className="mt-3 max-w-[60ch] text-muted-foreground"
              style={{ fontSize: "var(--step-1)" }}
            >
              A shareable link is generated. Invite teammates — everyone sees the
              canvas, cursors, and AI marks live.
            </p>
          </div>
        </section>

        {/* Three columns — numbered, not iconified. Density with hierarchy. */}
        <section className="grid grid-cols-12 gap-8 border-b border-border py-16">
          <div className="col-span-12 lg:col-span-3">
            <p className="eyebrow text-muted-foreground">Dispatch</p>
            <h2
              className="mt-2 font-serif"
              style={{ fontSize: "var(--step-4)", lineHeight: 1.05 }}
            >
              How it<br />works.
            </h2>
          </div>
          <div className="col-span-12 grid grid-cols-1 gap-px bg-border lg:col-span-9 lg:grid-cols-3">
            <Step
              n="01"
              title="Everyone joins"
              body="Each person introduces themselves in ten seconds. The mediator learns names, roles, and personalities — and gives every voice a colored mark."
            />
            <Step
              n="02"
              title="Talk freely"
              body="Live transcription with speaker awareness. The mediator listens for structure: flows, journeys, problems, decisions, action items."
            />
            <Step
              n="03"
              title="Watch it draw"
              body="The canvas builds itself. The right shape for the right moment — a sticky for a thought, a flow for a process, a journey for a user."
            />
          </div>
        </section>

        {/* Colophon — print-style footer */}
        <footer className="grid grid-cols-12 gap-8 py-10">
          <div className="col-span-12 lg:col-span-4">
            <p className="eyebrow text-muted-foreground">Colophon</p>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <p
              className="text-muted-foreground"
              style={{ fontSize: "var(--step-1)" }}
            >
              Set in <span className="font-serif text-foreground">Fraunces</span>{" "}
              and <span className="text-foreground">Inter</span>. Voice by ElevenLabs
              Scribe. Reasoning by Lovable AI. Multiplayer by Liveblocks.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <article className="bg-background p-6">
      <p className="eyebrow text-primary" data-numeric>
        № {n}
      </p>
      <h3
        className="mt-3 font-serif"
        style={{ fontSize: "var(--step-3)", lineHeight: 1.15 }}
      >
        {title}
      </h3>
      <p
        className="mt-3 max-w-[38ch] text-foreground/75"
        style={{ fontSize: "var(--step-2)", lineHeight: 1.55 }}
      >
        {body}
      </p>
    </article>
  );
}
