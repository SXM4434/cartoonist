import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/examples")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Wireframe examples — Cartoonist render system" },
      {
        name: "description",
        content:
          "Max-fidelity wireframe blueprints rendered live: dashboards, commerce, mobile and settings across lo-fi to hi-fi, pencil or clean shapes.",
      },
      { property: "og:title", content: "Wireframe examples — Cartoonist render system" },
      {
        property: "og:description",
        content: "See the same blueprint restyle instantly from lo-fi pencil sketch to hi-fi production UI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/examples-page")),
});
