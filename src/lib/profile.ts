// Local profile + sessions stored in localStorage (no auth in this app).

export type Vibe = "introvert" | "extrovert" | "analytical" | "creative" | "driver" | "diplomat";
export const VIBES: { id: Vibe; label: string; sub: string; emoji: string }[] = [
  { id: "introvert", label: "Introvert", sub: "Recharges in quiet", emoji: "🌙" },
  { id: "extrovert", label: "Extrovert", sub: "Energized by people", emoji: "✨" },
  { id: "analytical", label: "Analytical", sub: "Loves data & systems", emoji: "🏛️" },
  { id: "creative", label: "Creative", sub: "Big-picture & visual", emoji: "🎨" },
  { id: "driver", label: "Driver", sub: "Action-oriented, decisive", emoji: "🚀" },
  { id: "diplomat", label: "Diplomat", sub: "Bridges, listens, mediates", emoji: "🤝" },
];

export const STRENGTHS = [
  "Strategy","Research","Design","Engineering","Writing","Facilitation",
  "Marketing","Sales","Operations","Data","Product","Storytelling",
];

export type Profile = {
  displayName: string;
  vibe: Vibe;
  strengths: string[];
  bio: string;
  color: string;
};

const KEY = "cartoonist_profile_v2";
const SESSIONS_KEY = "cartoonist_sessions_v1";

export function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch { return null; }
}

export function saveProfile(p: Profile) {
  window.localStorage.setItem(KEY, JSON.stringify(p));
  // Mirror to legacy keys used by canvas-room
  window.localStorage.setItem("cartoonist_user_name", p.displayName);
  window.localStorage.setItem("cartoonist_user_color", p.color);
}

export type StoredSession = {
  roomId: string;
  joinCode: string;
  name: string;
  type: string;
  mode: string;
  outputs: string[];
  createdAt: number;
};

export function loadSessions(): StoredSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as StoredSession[]) : [];
  } catch { return []; }
}

export function addSession(s: StoredSession) {
  const all = loadSessions();
  if (!all.find((x) => x.roomId === s.roomId)) {
    all.unshift(s);
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(all.slice(0, 50)));
  }
}

const COLORS = ["#E07A3E", "#3E7AE0", "#5BB07A", "#B05BA0", "#B0A05B", "#A0B05B"];
export function pickColor(seed?: string) {
  if (!seed) return COLORS[Math.floor(Math.random() * COLORS.length)];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}
export { COLORS };
