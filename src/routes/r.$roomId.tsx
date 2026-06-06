import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$roomId")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Cartoonist room — ${params.roomId.slice(0, 8)}` },
      {
        name: "description",
        content:
          "Live AI-mediated collaborative canvas. Talk, watch ideas appear as a storyboard.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/room-page"), "RoomPage"),
});
