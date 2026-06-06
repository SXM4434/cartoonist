import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: async (room) => {
    const userId =
      typeof window !== "undefined"
        ? (window.localStorage.getItem("cartoonist_user_id") ??
          (() => {
            const id = `u_${crypto.randomUUID()}`;
            window.localStorage.setItem("cartoonist_user_id", id);
            return id;
          })())
        : "ssr";
    const userName =
      (typeof window !== "undefined" &&
        window.localStorage.getItem("cartoonist_user_name")) ||
      "Guest";
    const color =
      (typeof window !== "undefined" &&
        window.localStorage.getItem("cartoonist_user_color")) ||
      "#E07A3E";

    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, userId, userName, color }),
    });
    if (!res.ok) throw new Error("Liveblocks auth failed");
    return await res.json();
  },
  throttle: 50,
});

export type CardType =
  | "sticky"
  | "flowStep"
  | "journeyStep"
  | "decision"
  | "actionItem"
  | "participant"
  | "section";

export type Card = {
  id: string;
  type: CardType;
  text: string;
  author?: string;
  category?: string;
  owner?: string | null;
  persona?: string;
  kind?: string;
  x: number;
  y: number;
  color?: string;
  createdAtMs: number;
};

export type Connection = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type Presence = {
  cursor: { x: number; y: number } | null;
  name: string;
  color: string;
};

export type Storage = {
  cards: import("@liveblocks/client").LiveList<Card>;
  connections: import("@liveblocks/client").LiveList<Connection>;
};

export type UserMeta = {
  id: string;
  info: { name: string; color: string };
};

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useOthers,
  useStorage,
  useMutation,
  useSelf,
} = createRoomContext<Presence, Storage, UserMeta>(client);
