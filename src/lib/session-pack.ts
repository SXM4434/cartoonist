// Session pack — turns a live room into portable artifacts:
// canvas image (PNG/SVG) + a full markdown dossier.
import type { Editor } from "tldraw";

export type PackParticipant = { name: string; role?: string | null; note?: string | null };
export type PackThread = { id: string; latest?: string | null; modality?: string | null };
export type PackArtifacts = {
  summary?: string;
  decisions?: string[];
  actionItems?: { task: string; owner?: string | null; due?: string | null }[];
  prd?: string;
  userJourney?: string;
  flowMermaid?: string;
};

export type PackInput = {
  roomId: string;
  sessionName?: string | null;
  goal?: string | null;
  outputs?: string | null;
  participants: PackParticipant[];
  threads: PackThread[];
  transcript: string;
  canvasSummary: string;
  artifacts: PackArtifacts;
  recap?: string | null;
};

export function slugify(s: string) {
  return (s || "session")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "session";
}

export function buildDossier(input: PackInput): string {
  const L: string[] = [];
  const date = new Date().toLocaleString();
  L.push(`# ${input.sessionName || "Working session"}`);
  L.push("");
  L.push(`_Exported ${date} · room \`${input.roomId}\`_`);
  L.push("");
  if (input.goal) L.push(`**Goal** — ${input.goal}`);
  if (input.outputs) L.push(`**Desired outputs** — ${input.outputs}`);
  if (input.goal || input.outputs) L.push("");

  if (input.participants.length) {
    L.push("## Participants");
    for (const p of input.participants) {
      L.push(`- **${p.name}**${p.role ? ` — ${p.role}` : ""}${p.note ? ` · ${p.note}` : ""}`);
    }
    L.push("");
  }

  const a = input.artifacts || {};
  if (a.summary) {
    L.push("## Summary");
    L.push(a.summary);
    L.push("");
  }
  if (input.recap) {
    L.push("## Session recap");
    L.push(input.recap);
    L.push("");
  }
  if (a.decisions?.length) {
    L.push("## Decisions");
    a.decisions.forEach((d) => L.push(`- ${d}`));
    L.push("");
  }
  if (a.actionItems?.length) {
    L.push("## Action items");
    a.actionItems.forEach((x) =>
      L.push(`- [ ] ${x.task}${x.owner ? ` (@${x.owner})` : ""}${x.due ? ` — due ${x.due}` : ""}`),
    );
    L.push("");
  }
  if (input.threads.length) {
    L.push("## Threads");
    input.threads.forEach((t, i) =>
      L.push(`${i + 1}. ${t.latest || "(untitled thread)"}${t.modality ? ` _(${t.modality})_` : ""}`),
    );
    L.push("");
  }
  if (input.canvasSummary?.trim()) {
    L.push("## Canvas contents");
    L.push("```text");
    L.push(input.canvasSummary.trim());
    L.push("```");
    L.push("");
  }
  if (a.prd) {
    L.push("## PRD");
    L.push(a.prd);
    L.push("");
  }
  if (a.userJourney) {
    L.push("## User journey");
    L.push(a.userJourney);
    L.push("");
  }
  if (a.flowMermaid) {
    L.push("## Flow");
    L.push("```mermaid");
    L.push(a.flowMermaid.trim());
    L.push("```");
    L.push("");
  }
  if (input.transcript?.trim()) {
    L.push("## Transcript");
    L.push(input.transcript.trim());
    L.push("");
  }
  return L.join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, filename: string, type = "text/markdown") {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

/** Export the whole canvas as an image blob. Returns null when empty. */
export async function exportCanvasImage(
  editor: Editor | null,
  format: "png" | "svg",
): Promise<Blob | null> {
  if (!editor) return null;
  const ids = Array.from(editor.getCurrentPageShapeIds());
  if (!ids.length) return null;
  const result = await editor.toImage(ids, {
    format,
    background: true,
    padding: 48,
    scale: format === "png" ? 2 : 1,
  });
  return result?.blob ?? null;
}
