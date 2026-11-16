import { useEffect, useRef } from "react";
import mermaid from "mermaid";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    // AI-generated diagram text is influenced by meeting transcripts, so it is
    // untrusted input. "strict" sanitizes HTML labels and disables click
    // bindings; never relax this to "loose"/"antiscript".
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    themeVariables: {
      fontFamily: "Inter, sans-serif",
      primaryColor: "#f4ebdc",
      primaryTextColor: "#2a221a",
      primaryBorderColor: "#d97757",
      lineColor: "#a08a72",
      tertiaryColor: "#ffffff",
    },
  });
  initialized = true;
}

export function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const errRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    ensureInit();
    let cancelled = false;
    const id = `m-${Math.random().toString(36).slice(2)}`;
    const clean = code.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/, "").trim();
    mermaid
      .render(id, clean)
      .then(({ svg }) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        if (errRef.current) errRef.current.style.display = "none";
      })
      .catch((e) => {
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = "";
        if (errRef.current) {
          errRef.current.style.display = "block";
          errRef.current.textContent = `Diagram failed to render — showing source:\n\n${clean}\n\n${String(e?.message ?? e)}`;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="w-full overflow-auto rounded-lg border bg-card p-6">
      <div ref={ref} className="mermaid-render flex justify-center" />
      <pre
        ref={errRef}
        className="hidden whitespace-pre-wrap text-xs text-muted-foreground"
      />
    </div>
  );
}
