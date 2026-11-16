import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$roomId")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Cartoonist room — ${params.roomId.slice(0, 8)}` },
      { property: "og:title", content: `Cartoonist room — ${params.roomId.slice(0, 8)}` },
      { property: "og:description", content: "Live AI-mediated collaborative canvas. Talk, watch ideas appear as a storyboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content:
          "Live AI-mediated collaborative canvas. Talk, watch ideas appear as a storyboard.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/room-page")),
});
