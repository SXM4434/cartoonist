// Local profile + sessions stored in localStorage (no auth in this app).
// Profile is intentionally small — session-specific context (goal, role, etc)
// lives on the room itself, not the user.

export type Profile = {
  displayName: string;
  role: string;     // free-text: "Designer", "PM", "Eng", "Founder"…
  color: string;
};

const COLORS = ["#E07A3E", "#3E7AE0", "#5BB07A", "#B05BA0", "#B0A05B", "#A0B05B", "#D94A4A", "#4AB3D9"];
export { COLORS };

export function pickColor(seed?: string) {
  if (!seed) return COLORS[Math.floor(Math.random() * COLORS.length)];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

const KEY = "cartoonist_profile_v3";
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
  window.localStorage.setItem("cartoonist_user_role", p.role);
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem("cartoonist_user_name");
  window.localStorage.removeItem("cartoonist_user_color");
  window.localStorage.removeItem("cartoonist_user_role");
}

export type StoredSession = {
  roomId: string;
  joinCode: string;
  name: string;
  goal?: string;
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

export function removeSession(roomId: string) {
  if (typeof window === "undefined") return;
  const all = loadSessions().filter((x) => x.roomId !== roomId);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
}
