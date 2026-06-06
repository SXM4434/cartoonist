import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { CanvasRoom } from "@/components/canvas-room";

export const Route = createFileRoute("/r/$roomId")({
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
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  return (
    <ClientOnly fallback={<div className="p-8 text-muted-foreground">Loading room…</div>}>
      <CanvasRoom roomId={roomId} />
    </ClientOnly>
  );
}
