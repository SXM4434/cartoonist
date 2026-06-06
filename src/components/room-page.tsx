import { CanvasRoom } from "@/components/canvas-room";

export function RoomPage({ roomId }: { roomId: string }) {
  return <CanvasRoom roomId={roomId} />;
}

export default function RoomPageRoute() {
  // Read params via window since route component is lazy; simpler: wrapper below
  return null;
}
