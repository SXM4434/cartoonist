import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, FileText, Image as ImageIcon, Package, Code2 } from "lucide-react";
import { getCanvasEditor } from "@/components/canvas/canvas-context";
import {
  buildDossier,
  downloadBlob,
  downloadText,
  exportCanvasImage,
  slugify,
  type PackInput,
} from "@/lib/session-pack";
import { toast } from "sonner";

type Props = { build: () => PackInput };

function Row({
  icon,
  title,
  hint,
  action,
  busy,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action: () => void | Promise<void>;
  busy?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => action()}
        className="h-8 shrink-0 rounded-none border-border"
      >
        <span className="eyebrow">{busy ? "Working…" : label}</span>
      </Button>
    </div>
  );
}

export function SessionPack({ build }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (key: string, fn: () => Promise<void> | void) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      console.error("[session-pack]", e);
      toast.error("Export failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const image = async (format: "png" | "svg") => {
    const blob = await exportCanvasImage(getCanvasEditor(), format);
    if (!blob) {
      toast.error("Canvas is empty", { description: "Draw or generate something first." });
      return;
    }
    const input = build();
    downloadBlob(blob, `${slugify(input.sessionName || "session")}-canvas.${format}`);
    toast.success(`Canvas exported as ${format.toUpperCase()}`);
  };

  const dossier = () => {
    const input = build();
    downloadText(buildDossier(input), `${slugify(input.sessionName || "session")}-dossier.md`);
    toast.success("Dossier downloaded");
  };

  const json = () => {
    const input = build();
    downloadText(
      JSON.stringify(input, null, 2),
      `${slugify(input.sessionName || "session")}-session.json`,
      "application/json",
    );
    toast.success("JSON downloaded");
  };

  const everything = async () => {
    const input = build();
    const base = slugify(input.sessionName || "session");
    downloadText(buildDossier(input), `${base}-dossier.md`);
    downloadText(JSON.stringify(input, null, 2), `${base}-session.json`, "application/json");
    for (const format of ["png", "svg"] as const) {
      const blob = await exportCanvasImage(getCanvasEditor(), format);
      if (blob) downloadBlob(blob, `${base}-canvas.${format}`);
    }
    toast.success("Session pack downloaded");
  };

  return (
    <div className="border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h3 className="font-serif tracking-tight" style={{ fontSize: "var(--step-2)" }}>
            Session pack
          </h3>
          <p className="text-xs text-muted-foreground">
            Everything from this room — canvas, threads, transcript, artifacts.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-2 text-muted-foreground"
          onClick={async () => {
            await navigator.clipboard.writeText(buildDossier(build()));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="eyebrow">{copied ? "Copied" : "Copy dossier"}</span>
        </Button>
      </div>

      <Row
        icon={<Package className="h-4 w-4" />}
        title="Download everything"
        hint="Markdown dossier + JSON + canvas PNG & SVG"
        action={() => run("all", everything)}
        busy={busy === "all"}
        label="Download all"
      />
      <Row
        icon={<FileText className="h-4 w-4" />}
        title="Markdown dossier"
        hint="Goal, participants, decisions, threads, transcript"
        action={() => run("md", dossier)}
        busy={busy === "md"}
        label="Download .md"
      />
      <Row
        icon={<ImageIcon className="h-4 w-4" />}
        title="Canvas image"
        hint="Full-page export at 2× resolution"
        action={() => run("png", () => image("png"))}
        busy={busy === "png"}
        label="Download PNG"
      />
      <Row
        icon={<ImageIcon className="h-4 w-4" />}
        title="Canvas vector"
        hint="Scalable SVG for decks and docs"
        action={() => run("svg", () => image("svg"))}
        busy={busy === "svg"}
        label="Download SVG"
      />
      <Row
        icon={<Code2 className="h-4 w-4" />}
        title="Raw JSON"
        hint="Structured session data for pipelines"
        action={() => run("json", json)}
        busy={busy === "json"}
        label="Download .json"
      />
    </div>
  );
}
