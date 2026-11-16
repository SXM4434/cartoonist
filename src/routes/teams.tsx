import { createFileRoute } from "@tanstack/react-router";
import { TeamWorkspaces } from "@/components/team-workspaces";
import { CartoonistHeader } from "./onboarding";
export const Route = createFileRoute("/teams")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Team studios — Cartoonist" },
    { name: "description", content: "Create a shared Cartoonist studio, invite teammates, and start team meetings." },
    { property: "og:title", content: "Team studios — Cartoonist" },
    { property: "og:description", content: "Shared meeting canvases and memory for your team." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <main className="min-h-screen bg-background"><CartoonistHeader /><TeamWorkspaces /></main>,
});