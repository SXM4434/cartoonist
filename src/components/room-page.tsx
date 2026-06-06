import { CanvasRoom } from "@/components/canvas-room";
import { Route } from "@/routes/r.$roomId";

export function component() {
  const { roomId } = Route.useParams();
  return <CanvasRoom roomId={roomId} />;
}

export default component;
