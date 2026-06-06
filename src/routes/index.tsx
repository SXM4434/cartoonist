import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Users, MessageSquare, ArrowRight, Loader2 } from "lucide-react";
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
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            AI mediator · live canvas
          </p>
          <h1 className="font-serif text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
            Cartoonist
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Start a room, share the link, and talk. Cartoonist draws your meeting on a shared
            canvas — sticky notes, user flows, journey maps, decisions — as it happens.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <label className="mb-2 block text-sm font-medium">Meeting name</label>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hackathon kickoff…"
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <Button
              onClick={create}
              disabled={creating}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Start
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A shareable room link is generated. Invite teammates — everyone sees the canvas live.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <Feature
            icon={<Users className="h-5 w-5" />}
            title="Everyone joins"
            body="Each person introduces themselves. Cartoonist learns the room."
          />
          <Feature
            icon={<MessageSquare className="h-5 w-5" />}
            title="Talk freely"
            body="Live transcription with speaker awareness. No notetaker required."
          />
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Watch it draw"
            body="The AI picks the right shape — flow, journey, decision — and pins it on the canvas."
          />
        </div>

        <footer className="mt-20 text-center text-xs text-muted-foreground">
          Built with ElevenLabs Scribe · Lovable AI · Liveblocks.
        </footer>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-serif text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
