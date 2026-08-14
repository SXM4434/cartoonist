import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "./mermaid-diagram";

export type Artifacts = {
  summary?: string;
  decisions?: string[];
  actionItems?: { task: string; owner?: string | null; due?: string | null }[];
  prd?: string;
  userJourney?: string;
  flowMermaid?: string;
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function Empty({ loading, label }: { loading: boolean; label: string }) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground italic">
      {label} will appear here after you generate artifacts.
    </p>
  );
}

const proseClass =
  "prose prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h2:mt-6 prose-h2:mb-2 prose-p:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-a:text-primary";

export function ArtifactTabs({
  artifacts,
  loading,
  drafting = false,
  draftedAt = null,
}: {
  artifacts: Artifacts;
  loading: boolean;
  /** v1 P2.4 — a background draft pass is running while the room talks. */
  drafting?: boolean;
  draftedAt?: number | null;
}) {
  const a = artifacts;
  const words = [a.summary, a.prd, a.userJourney, ...(a.decisions ?? []), ...(a.actionItems ?? []).map((x) => x.task)]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return (
    <Tabs defaultValue="summary" className="w-full">
      {(drafting || draftedAt) && (
        <div className="mb-2 flex items-center gap-2 border border-border px-2 py-1">
          <span
            className={`h-1.5 w-1.5 shrink-0 ${drafting ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
            aria-hidden
          />
          <span className="eyebrow text-muted-foreground">
            {drafting ? "drafting live" : "draft up to date"}
          </span>
          <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">{words} words</span>
        </div>
      )}

      <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-secondary/70 p-1">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="decisions">Decisions</TabsTrigger>
        <TabsTrigger value="actions">Action Items</TabsTrigger>
        <TabsTrigger value="prd">PRD</TabsTrigger>
        <TabsTrigger value="journey">User Journey</TabsTrigger>
        <TabsTrigger value="flow">Flow</TabsTrigger>
      </TabsList>

      <div className="mt-4 rounded-xl border bg-card p-6">
        <TabsContent value="summary" className="m-0">
          <Header title="Summary" copy={a.summary} />
          {a.summary ? (
            <p className="text-base leading-relaxed text-foreground">{a.summary}</p>
          ) : (
            <Empty loading={loading} label="The executive summary" />
          )}
        </TabsContent>

        <TabsContent value="decisions" className="m-0">
          <Header title="Decisions" copy={a.decisions?.map((d) => `• ${d}`).join("\n")} />
          {a.decisions && a.decisions.length > 0 ? (
            <ul className="space-y-2">
              {a.decisions.map((d, i) => (
                <li key={i} className="flex gap-3 text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty loading={loading} label="Concrete decisions" />
          )}
        </TabsContent>

        <TabsContent value="actions" className="m-0">
          <Header
            title="Action Items"
            copy={a.actionItems
              ?.map((x) => `- [ ] ${x.task}${x.owner ? ` (@${x.owner})` : ""}${x.due ? ` — due ${x.due}` : ""}`)
              .join("\n")}
          />
          {a.actionItems && a.actionItems.length > 0 ? (
            <ul className="space-y-3">
              {a.actionItems.map((item, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-background/50 px-4 py-3"
                >
                  <span className="font-medium text-foreground">{item.task}</span>
                  {item.owner && (
                    <span className="text-sm text-primary">@{item.owner}</span>
                  )}
                  {item.due && (
                    <span className="text-sm text-muted-foreground">due {item.due}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty loading={loading} label="Action items" />
          )}
        </TabsContent>

        <TabsContent value="prd" className="m-0">
          <Header title="PRD" copy={a.prd} />
          {a.prd ? (
            <div className={proseClass}>
              <ReactMarkdown>{a.prd}</ReactMarkdown>
            </div>
          ) : (
            <Empty loading={loading} label="A product requirements doc" />
          )}
        </TabsContent>

        <TabsContent value="journey" className="m-0">
          <Header title="User Journey" copy={a.userJourney} />
          {a.userJourney ? (
            <div className={proseClass}>
              <ReactMarkdown>{a.userJourney}</ReactMarkdown>
            </div>
          ) : (
            <Empty loading={loading} label="A step-by-step user journey" />
          )}
        </TabsContent>

        <TabsContent value="flow" className="m-0">
          <Header title="Flow Diagram" copy={a.flowMermaid} />
          {a.flowMermaid ? (
            <MermaidDiagram code={a.flowMermaid} />
          ) : (
            <Empty loading={loading} label="A flow diagram" />
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}

function Header({ title, copy }: { title: string; copy?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {copy && <CopyBtn text={copy} />}
    </div>
  );
}
