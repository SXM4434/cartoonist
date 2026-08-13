import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/directions")({
  head: () => ({
    meta: [
      { title: "Cartoonist — Visual Directions" },
      {
        name: "description",
        content:
          "Four visual directions for Cartoonist: palette and typography specimens shown side by side for review.",
      },
      { property: "og:title", content: "Cartoonist — Visual Directions" },
      {
        property: "og:description",
        content: "Palette and type specimens for four candidate design systems.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=Instrument+Serif&family=Archivo:wght@400;500;600&family=Anton&display=swap",
      },
    ],
  }),
  component: Directions,
});

type Dir = {
  n: string;
  name: string;
  tagline: string;
  colors: { name: string; hex: string }[];
  display: { label: string; css: string };
  body: { label: string; css: string };
  utility?: { label: string; css: string };
  signature: string;
  paper: string;
  ink: string;
  accent: string;
  muted: string;
};

const DIRECTIONS: Dir[] = [
  {
    n: "01",
    name: "Paper Instrument",
    tagline: "A precision drafting table. Panels are sheets, trays, rulers.",
    colors: [
      { name: "Bone", hex: "#F4F1E8" },
      { name: "Tracing", hex: "#FCFBF7" },
      { name: "Ink", hex: "#171713" },
      { name: "Graphite", hex: "#66655E" },
      { name: "Blueprint", hex: "#355CFF" },
      { name: "Signal", hex: "#E54B3D" },
    ],
    display: { label: "Newsreader", css: "'Newsreader', serif" },
    body: { label: "Inter Tight", css: "'Inter Tight', sans-serif" },
    signature: "Tracing layers — Cartoonist's rough work floats translucent above the committed canvas, then settles.",
    paper: "#F4F1E8",
    ink: "#171713",
    accent: "#355CFF",
    muted: "#66655E",
  },
  {
    n: "02",
    name: "Office Supply System",
    tagline: "The physical tools people already think with — grid-driven, not cute.",
    colors: [
      { name: "Copy Paper", hex: "#FAFAF7" },
      { name: "Soft Gray", hex: "#ECEBE7" },
      { name: "Black", hex: "#191919" },
      { name: "Highlighter", hex: "#E9FF58" },
      { name: "Bic Blue", hex: "#2457D6" },
      { name: "Stamp Red", hex: "#E1483D" },
    ],
    display: { label: "Geist", css: "'Geist', sans-serif" },
    body: { label: "Geist", css: "'Geist', sans-serif" },
    utility: { label: "IBM Plex Mono", css: "'IBM Plex Mono', monospace" },
    signature: "The Cartoonist stamp — DECISION / ACTION / OPEN / RESOLVED, with a satisfying press.",
    paper: "#FAFAF7",
    ink: "#191919",
    accent: "#2457D6",
    muted: "#6B6A64",
  },
  {
    n: "03",
    name: "Living Diagram",
    tagline: "The UI speaks the grammar of the diagrams it draws.",
    colors: [
      { name: "Warm White", hex: "#F7F6F1" },
      { name: "Dust", hex: "#D8D6CD" },
      { name: "Almost Black", hex: "#111214" },
      { name: "Cobalt", hex: "#3155FF" },
      { name: "Acid", hex: "#C8F43D" },
      { name: "Coral", hex: "#FF6B59" },
    ],
    display: { label: "Instrument Serif", css: "'Instrument Serif', serif" },
    body: { label: "Hanken Grotesk", css: "'Hanken Grotesk', sans-serif" },
    signature: "The living connector — one line links speaker → idea → artifact → decision, redrawing as talk moves.",
    paper: "#F7F6F1",
    ink: "#111214",
    accent: "#3155FF",
    muted: "#6E6D68",
  },
  {
    n: "04",
    name: "Studio Tool",
    tagline: "Critique wall energy. Huge identifiers, tiny utilitarian labels.",
    colors: [
      { name: "Chalk", hex: "#F1F0E9" },
      { name: "Paper Gray", hex: "#D9D7CE" },
      { name: "Carbon", hex: "#151515" },
      { name: "Charcoal", hex: "#292927" },
      { name: "Safety", hex: "#FF5C35" },
      { name: "Lavender", hex: "#B9B5D7" },
    ],
    display: { label: "Anton", css: "'Anton', sans-serif" },
    body: { label: "Archivo", css: "'Archivo', sans-serif" },
    signature: "Spatial typography — a spoken sentence lands huge on the canvas, then becomes structure.",
    paper: "#F1F0E9",
    ink: "#151515",
    accent: "#FF5C35",
    muted: "#5C5B55",
  },
];

function Card({ d }: { d: Dir }) {
  return (
    <article
      style={{ background: d.paper, color: d.ink, borderColor: d.ink }}
      className="border overflow-hidden"
    >
      <header
        className="flex items-baseline justify-between gap-4 border-b px-6 py-4"
        style={{ borderColor: `${d.ink}22` }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: d.muted, fontFamily: d.utility?.css ?? d.body.css }}
          >
            {d.n}
          </span>
          <h2 className="text-[32px] leading-none" style={{ fontFamily: d.display.css }}>
            {d.name}
          </h2>
        </div>
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: d.accent, fontFamily: d.utility?.css ?? d.body.css }}
        >
          Direction
        </span>
      </header>

      <div className="px-6 py-5" style={{ fontFamily: d.body.css }}>
        <p className="max-w-[60ch] text-[15px] leading-[1.5]" style={{ color: d.muted }}>
          {d.tagline}
        </p>
      </div>

      <div className="grid grid-cols-6">
        {d.colors.map((c) => (
          <div key={c.hex} className="flex flex-col">
            <div className="h-20" style={{ background: c.hex, borderTop: `1px solid ${d.ink}18` }} />
            <div className="px-2 py-2" style={{ fontFamily: d.utility?.css ?? d.body.css }}>
              <div className="text-[11px] leading-tight">{c.name}</div>
              <div className="text-[11px] tabular-nums" style={{ color: d.muted }}>
                {c.hex}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-6 py-6" style={{ borderColor: `${d.ink}22` }}>
        <div
          className="mb-3 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: d.muted, fontFamily: d.utility?.css ?? d.body.css }}
        >
          Display — {d.display.label}
        </div>
        <div
          className="mb-1 text-[52px] leading-[1.05]"
          style={{ fontFamily: d.display.css }}
        >
          Conversation becomes structure
        </div>
        <div className="text-[22px] leading-[1.2]" style={{ fontFamily: d.display.css, color: d.muted }}>
          Session 14 — Onboarding teardown
        </div>

        <div
          className="mb-3 mt-8 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: d.muted, fontFamily: d.utility?.css ?? d.body.css }}
        >
          Body — {d.body.label}
        </div>
        <p className="max-w-[68ch] text-[15px] leading-[1.5]">
          Cartoonist listens to the room, sketches what it hears on a translucent layer, and waits.
          When the group agrees, the rough marks resolve into a clean artifact everyone can point at.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            style={{ background: d.ink, color: d.paper, fontFamily: d.utility?.css ?? d.body.css }}
            className="px-4 py-2 text-[13px] transition-transform duration-150 active:translate-y-[1px]"
          >
            Start session
          </button>
          <button
            type="button"
            style={{ borderColor: d.ink, color: d.ink, fontFamily: d.utility?.css ?? d.body.css }}
            className="border px-4 py-2 text-[13px] transition-transform duration-150 active:translate-y-[1px]"
          >
            Wireframe this
          </button>
          <span
            style={{ background: d.accent, color: "#fff", fontFamily: d.utility?.css ?? d.body.css }}
            className="px-2 py-1 text-[11px] uppercase tracking-[0.18em]"
          >
            Decision
          </span>
          <span
            style={{ color: d.muted, fontFamily: d.utility?.css ?? d.body.css }}
            className="text-[13px] tabular-nums"
          >
            {d.utility ? `${d.utility.label} · 00:14:32 · RM-4821` : "00:14:32 · RM-4821"}
          </span>
        </div>
      </div>

      <div
        className="border-t px-6 py-4 text-[13px] leading-[1.5]"
        style={{ borderColor: `${d.ink}22`, background: `${d.accent}0F`, fontFamily: d.body.css }}
      >
        <span
          className="mr-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: d.accent, fontFamily: d.utility?.css ?? d.body.css }}
        >
          Signature
        </span>
        {d.signature}
      </div>
    </article>
  );
}

function Directions() {
  return (
    <main className="min-h-screen bg-[#F4F1E8] px-6 py-14 text-[#171713]">
      <div className="mx-auto max-w-[1080px]">
        <p
          className="text-[11px] uppercase tracking-[0.2em] text-[#66655E]"
          style={{ fontFamily: "'Inter Tight', sans-serif" }}
        >
          Cartoonist — review
        </p>
        <h1
          className="mt-3 text-[52px] leading-[1.02]"
          style={{ fontFamily: "'Newsreader', serif" }}
        >
          Four directions, colour and type together
        </h1>
        <p
          className="mt-4 max-w-[62ch] text-[15px] leading-[1.5] text-[#66655E]"
          style={{ fontFamily: "'Inter Tight', sans-serif" }}
        >
          Each card renders in its own palette and its own typefaces. Pick one, or tell me which
          pieces to combine — the blend you described is Paper Instrument as the system, Living
          Diagram's connector as the signature, Office Supply's press physics on controls.
        </p>

        <div className="mt-12 flex flex-col gap-12">
          {DIRECTIONS.map((d) => (
            <Card key={d.n} d={d} />
          ))}
        </div>
      </div>
    </main>
  );
}
