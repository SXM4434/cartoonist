import type { SketchPrimitive } from "@/lib/sketch-types";

// Hand-built literal-draw templates. Each one returns a recognizable
// multi-stroke sketch using path/ellipse/line primitives — no boxy
// diagram fallback. Coordinates are positioned around (cx, cy) so we
// can drop them anywhere on the canvas.

const stamp = () => Math.random().toString(36).slice(2, 7);

const mk = (prefix: string) => {
  let i = 0;
  const s = stamp();
  return () => `${prefix}_${s}_${i++}`;
};

// helpers
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 14): Array<[number, number]> => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
};

const circle = (cx: number, cy: number, r: number, steps = 28): Array<[number, number]> => arc(cx, cy, r, r, 0, Math.PI * 2, steps);

const wobble = (pts: Array<[number, number]>, amp = 0.6): Array<[number, number]> =>
  pts.map(([x, y], i) => [x + Math.sin(i * 1.7) * amp, y + Math.cos(i * 2.1) * amp]);

const label = (id: string, x: number, y: number, text: string): SketchPrimitive => ({
  type: "text",
  id,
  x,
  y,
  text,
  size: 14,
  weight: "regular",
});

// === MONKEY ===
const monkey = (cx = 200, cy = 420): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("monkey");
  const s: SketchPrimitive[] = [];
  // head outer
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 56)), closed: true });
  // face inner
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy + 10, 38, 32, 0, Math.PI * 2)), closed: true });
  // ears
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 56, cy - 12, 18)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 56, cy - 12, 10)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 56, cy - 12, 18)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 56, cy - 12, 10)), closed: true });
  // eyes
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 16, cy - 6, 6)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 16, cy - 6, 6)), closed: true });
  s.push({ type: "path", id: id(), points: [[cx - 17, cy - 6], [cx - 15, cy - 4]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx + 15, cy - 6], [cx + 17, cy - 4]], closed: false });
  // nostrils
  s.push({ type: "path", id: id(), points: [[cx - 5, cy + 14], [cx - 3, cy + 16]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx + 3, cy + 14], [cx + 5, cy + 16]], closed: false });
  // mouth
  s.push({ type: "path", id: id(), points: arc(cx, cy + 22, 14, 8, 0.1, Math.PI - 0.1, 12), closed: false });
  // body
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy + 110, 50, 70, -Math.PI * 0.9, Math.PI * 0.1, 22)), closed: false });
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy + 110, 50, 70, Math.PI * 0.1, Math.PI * 1.1, 22)), closed: false });
  // belly
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy + 120, 28, 44, -Math.PI * 0.85, Math.PI * 0.05, 16)), closed: false });
  // arms
  s.push({ type: "path", id: id(), points: wobble([[cx - 44, cy + 70], [cx - 78, cy + 95], [cx - 90, cy + 140], [cx - 70, cy + 165]]), closed: false });
  s.push({ type: "path", id: id(), points: wobble([[cx + 44, cy + 70], [cx + 78, cy + 95], [cx + 90, cy + 140], [cx + 70, cy + 165]]), closed: false });
  // legs
  s.push({ type: "path", id: id(), points: wobble([[cx - 24, cy + 175], [cx - 30, cy + 210], [cx - 12, cy + 220]]), closed: false });
  s.push({ type: "path", id: id(), points: wobble([[cx + 24, cy + 175], [cx + 30, cy + 210], [cx + 12, cy + 220]]), closed: false });
  // tail
  s.push({ type: "path", id: id(), points: wobble(arc(cx + 70, cy + 130, 60, 40, -Math.PI * 0.9, Math.PI * 0.3, 24)), closed: false });
  s.push(label(id(), cx - 30, cy - 100, "monkey"));
  return { shapes: s, rationale: "drew a literal monkey" };
};

// === CAT ===
const cat = (cx = 220, cy = 420): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("cat");
  const s: SketchPrimitive[] = [];
  // head
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 52)), closed: true });
  // ears (triangles)
  s.push({ type: "path", id: id(), points: [[cx - 44, cy - 30], [cx - 30, cy - 70], [cx - 14, cy - 38]], closed: true });
  s.push({ type: "path", id: id(), points: [[cx + 14, cy - 38], [cx + 30, cy - 70], [cx + 44, cy - 30]], closed: true });
  // eyes
  s.push({ type: "path", id: id(), points: wobble(arc(cx - 18, cy - 4, 6, 9, 0, Math.PI * 2)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(arc(cx + 18, cy - 4, 6, 9, 0, Math.PI * 2)), closed: true });
  s.push({ type: "path", id: id(), points: [[cx - 18, cy - 8], [cx - 18, cy + 0]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx + 18, cy - 8], [cx + 18, cy + 0]], closed: false });
  // nose
  s.push({ type: "path", id: id(), points: [[cx - 4, cy + 14], [cx + 4, cy + 14], [cx, cy + 20]], closed: true });
  // mouth
  s.push({ type: "path", id: id(), points: arc(cx - 6, cy + 24, 6, 4, 0, Math.PI, 8), closed: false });
  s.push({ type: "path", id: id(), points: arc(cx + 6, cy + 24, 6, 4, 0, Math.PI, 8), closed: false });
  // whiskers
  s.push({ type: "path", id: id(), points: [[cx - 14, cy + 18], [cx - 50, cy + 14]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx - 14, cy + 22], [cx - 52, cy + 24]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx + 14, cy + 18], [cx + 50, cy + 14]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx + 14, cy + 22], [cx + 52, cy + 24]], closed: false });
  // body
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy + 90, 60, 56, Math.PI, Math.PI * 2, 22)), closed: false });
  s.push({ type: "path", id: id(), points: wobble([[cx - 60, cy + 90], [cx - 56, cy + 150], [cx + 56, cy + 150], [cx + 60, cy + 90]]), closed: false });
  // tail
  s.push({ type: "path", id: id(), points: wobble(arc(cx + 70, cy + 110, 40, 60, -Math.PI * 0.6, Math.PI * 0.6, 20)), closed: false });
  s.push(label(id(), cx - 16, cy - 100, "cat"));
  return { shapes: s, rationale: "drew a literal cat" };
};

// === HOUSE ===
const house = (cx = 220, cy = 380): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("house");
  const s: SketchPrimitive[] = [];
  // body
  s.push({ type: "path", id: id(), points: wobble([[cx - 80, cy], [cx + 80, cy], [cx + 80, cy + 120], [cx - 80, cy + 120], [cx - 80, cy]]), closed: true });
  // roof
  s.push({ type: "path", id: id(), points: wobble([[cx - 96, cy], [cx, cy - 70], [cx + 96, cy], [cx - 96, cy]]), closed: true });
  // door
  s.push({ type: "path", id: id(), points: wobble([[cx - 18, cy + 60], [cx + 18, cy + 60], [cx + 18, cy + 120], [cx - 18, cy + 120]]), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 12, cy + 92, 2)), closed: true });
  // windows
  s.push({ type: "path", id: id(), points: wobble([[cx - 64, cy + 18], [cx - 28, cy + 18], [cx - 28, cy + 50], [cx - 64, cy + 50]]), closed: true });
  s.push({ type: "path", id: id(), points: [[cx - 46, cy + 18], [cx - 46, cy + 50]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx - 64, cy + 34], [cx - 28, cy + 34]], closed: false });
  s.push({ type: "path", id: id(), points: wobble([[cx + 28, cy + 18], [cx + 64, cy + 18], [cx + 64, cy + 50], [cx + 28, cy + 50]]), closed: true });
  s.push({ type: "path", id: id(), points: [[cx + 46, cy + 18], [cx + 46, cy + 50]], closed: false });
  s.push({ type: "path", id: id(), points: [[cx + 28, cy + 34], [cx + 64, cy + 34]], closed: false });
  // chimney
  s.push({ type: "path", id: id(), points: wobble([[cx + 40, cy - 50], [cx + 60, cy - 50], [cx + 60, cy - 14], [cx + 40, cy - 22]]), closed: true });
  s.push(label(id(), cx - 20, cy - 110, "house"));
  return { shapes: s, rationale: "drew a house" };
};

// === TREE ===
const tree = (cx = 220, cy = 420): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("tree");
  const s: SketchPrimitive[] = [];
  // trunk
  s.push({ type: "path", id: id(), points: wobble([[cx - 14, cy + 60], [cx - 18, cy + 140], [cx + 18, cy + 140], [cx + 14, cy + 60]]), closed: true });
  // canopy (cloud-like blobs)
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 60)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 40, cy + 20, 36)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 40, cy + 20, 36)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 26, cy - 30, 30)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 26, cy - 30, 30)), closed: true });
  s.push(label(id(), cx - 14, cy - 100, "tree"));
  return { shapes: s, rationale: "drew a tree" };
};

// === SUN ===
const sun = (cx = 220, cy = 320): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("sun");
  const s: SketchPrimitive[] = [];
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 50)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 44)), closed: true });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = 60;
    const r2 = 86;
    s.push({ type: "path", id: id(), points: [[cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], closed: false });
  }
  // smile
  s.push({ type: "path", id: id(), points: arc(cx, cy + 10, 18, 12, 0.2, Math.PI - 0.2, 12), closed: false });
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 16, cy - 8, 3)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 16, cy - 8, 3)), closed: true });
  s.push(label(id(), cx - 8, cy + 90, "sun"));
  return { shapes: s, rationale: "drew a sun" };
};

// === STAR ===
const star = (cx = 220, cy = 380): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("star");
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 60 : 26;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  pts.push(pts[0]);
  return { shapes: [{ type: "path", id: id(), points: wobble(pts), closed: true }, label(id(), cx - 10, cy + 80, "star")], rationale: "drew a star" };
};

// === HEART ===
const heart = (cx = 220, cy = 400): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("heart");
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = cx + 16 * Math.pow(Math.sin(t), 3);
    const y = cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + (x - cx) * 3, cy + (y - cy) * 3]);
  }
  return { shapes: [{ type: "path", id: id(), points: wobble(pts), closed: true }, label(id(), cx - 12, cy + 80, "heart")], rationale: "drew a heart" };
};

// === FISH ===
const fish = (cx = 240, cy = 400): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("fish");
  const s: SketchPrimitive[] = [];
  // body
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy, 70, 36, 0, Math.PI * 2)), closed: true });
  // tail
  s.push({ type: "path", id: id(), points: wobble([[cx + 64, cy], [cx + 110, cy - 30], [cx + 110, cy + 30], [cx + 64, cy]]), closed: true });
  // eye
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 40, cy - 6, 5)), closed: true });
  // gill
  s.push({ type: "path", id: id(), points: arc(cx - 22, cy, 8, 16, -Math.PI / 2, Math.PI / 2, 10), closed: false });
  // fin
  s.push({ type: "path", id: id(), points: wobble([[cx - 10, cy + 22], [cx + 10, cy + 40], [cx + 26, cy + 22]]), closed: true });
  // scales
  for (let i = 0; i < 4; i++) {
    s.push({ type: "path", id: id(), points: arc(cx - 10 + i * 18, cy - 6, 10, 8, 0.2, Math.PI - 0.2, 8), closed: false });
  }
  s.push(label(id(), cx - 10, cy - 80, "fish"));
  return { shapes: s, rationale: "drew a fish" };
};

// === FLOWER ===
const flower = (cx = 220, cy = 340): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("flower");
  const s: SketchPrimitive[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(a) * 30;
    const py = cy + Math.sin(a) * 30;
    s.push({ type: "path", id: id(), points: wobble(circle(px, py, 22)), closed: true });
  }
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 16)), closed: true });
  s.push({ type: "path", id: id(), points: wobble([[cx, cy + 50], [cx + 4, cy + 140], [cx - 4, cy + 200]]), closed: false });
  s.push({ type: "path", id: id(), points: wobble([[cx, cy + 110], [cx + 40, cy + 90], [cx + 50, cy + 120]]), closed: true });
  s.push(label(id(), cx - 16, cy - 80, "flower"));
  return { shapes: s, rationale: "drew a flower" };
};

// === CAR ===
const car = (cx = 240, cy = 400): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("car");
  const s: SketchPrimitive[] = [];
  // body
  s.push({ type: "path", id: id(), points: wobble([[cx - 110, cy + 20], [cx - 90, cy - 10], [cx - 50, cy - 30], [cx + 40, cy - 30], [cx + 80, cy - 10], [cx + 110, cy + 20], [cx + 110, cy + 40], [cx - 110, cy + 40]]), closed: true });
  // windows
  s.push({ type: "path", id: id(), points: wobble([[cx - 50, cy - 24], [cx - 6, cy - 24], [cx - 6, cy - 4], [cx - 70, cy - 4]]), closed: true });
  s.push({ type: "path", id: id(), points: wobble([[cx + 4, cy - 24], [cx + 40, cy - 24], [cx + 70, cy - 4], [cx + 4, cy - 4]]), closed: true });
  // wheels
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 60, cy + 50, 22)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 60, cy + 50, 10)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 60, cy + 50, 22)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 60, cy + 50, 10)), closed: true });
  // headlight
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 100, cy + 10, 5)), closed: true });
  s.push(label(id(), cx - 8, cy - 70, "car"));
  return { shapes: s, rationale: "drew a car" };
};

// === PERSON ===
const person = (cx = 220, cy = 360): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("person");
  const s: SketchPrimitive[] = [];
  // head
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy, 26)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 8, cy - 4, 2)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 8, cy - 4, 2)), closed: true });
  s.push({ type: "path", id: id(), points: arc(cx, cy + 6, 8, 5, 0.2, Math.PI - 0.2, 10), closed: false });
  // body
  s.push({ type: "path", id: id(), points: wobble([[cx, cy + 26], [cx, cy + 110]]), closed: false });
  // arms
  s.push({ type: "path", id: id(), points: wobble([[cx - 40, cy + 80], [cx, cy + 50], [cx + 40, cy + 80]]), closed: false });
  // legs
  s.push({ type: "path", id: id(), points: wobble([[cx - 24, cy + 170], [cx, cy + 110], [cx + 24, cy + 170]]), closed: false });
  s.push(label(id(), cx - 18, cy - 60, "person"));
  return { shapes: s, rationale: "drew a person" };
};

// === DOG ===
const dog = (cx = 230, cy = 420): { shapes: SketchPrimitive[]; rationale: string } => {
  const id = mk("dog");
  const s: SketchPrimitive[] = [];
  // head
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy, 48, 42, 0, Math.PI * 2)), closed: true });
  // snout
  s.push({ type: "path", id: id(), points: wobble(arc(cx, cy + 18, 22, 16, 0, Math.PI * 2)), closed: true });
  // nose
  s.push({ type: "path", id: id(), points: wobble(circle(cx, cy + 12, 5)), closed: true });
  // ears (floppy)
  s.push({ type: "path", id: id(), points: wobble([[cx - 44, cy - 20], [cx - 60, cy + 10], [cx - 50, cy + 40], [cx - 30, cy + 14]]), closed: true });
  s.push({ type: "path", id: id(), points: wobble([[cx + 44, cy - 20], [cx + 60, cy + 10], [cx + 50, cy + 40], [cx + 30, cy + 14]]), closed: true });
  // eyes
  s.push({ type: "path", id: id(), points: wobble(circle(cx - 18, cy - 6, 4)), closed: true });
  s.push({ type: "path", id: id(), points: wobble(circle(cx + 18, cy - 6, 4)), closed: true });
  // mouth
  s.push({ type: "path", id: id(), points: arc(cx, cy + 22, 10, 6, 0, Math.PI, 10), closed: false });
  // body
  s.push({ type: "path", id: id(), points: wobble([[cx - 50, cy + 80], [cx - 70, cy + 110], [cx - 60, cy + 170], [cx + 60, cy + 170], [cx + 70, cy + 110], [cx + 50, cy + 80]]), closed: true });
  // legs
  s.push({ type: "path", id: id(), points: wobble([[cx - 40, cy + 170], [cx - 40, cy + 210]]), closed: false });
  s.push({ type: "path", id: id(), points: wobble([[cx + 40, cy + 170], [cx + 40, cy + 210]]), closed: false });
  // tail
  s.push({ type: "path", id: id(), points: wobble(arc(cx + 70, cy + 110, 30, 40, -Math.PI / 2, Math.PI / 4, 14)), closed: false });
  s.push(label(id(), cx - 12, cy - 90, "dog"));
  return { shapes: s, rationale: "drew a dog" };
};

type Template = (cx?: number, cy?: number) => { shapes: SketchPrimitive[]; rationale: string };

const REGISTRY: Array<{ test: RegExp; build: Template }> = [
  { test: /\bmonkey\b|\bape\b|\bgorilla\b|\bchimp\b/i, build: monkey },
  { test: /\bcat\b|\bkitten\b|\bkitty\b/i, build: cat },
  { test: /\bdog\b|\bpuppy\b/i, build: dog },
  { test: /\bhouse\b|\bhome\b/i, build: house },
  { test: /\btree\b/i, build: tree },
  { test: /\bsun\b|\bsunshine\b/i, build: sun },
  { test: /\bstar\b/i, build: star },
  { test: /\bheart\b|\blove\b/i, build: heart },
  { test: /\bfish\b/i, build: fish },
  { test: /\bflower\b|\brose\b|\btulip\b|\bdaisy\b/i, build: flower },
  { test: /\bcar\b|\bvehicle\b|\bauto\b/i, build: car },
  { test: /\bperson\b|\bhuman\b|\bstickman\b|\bstick figure\b/i, build: person },
];

export const matchSketchTemplate = (text: string): { shapes: SketchPrimitive[]; rationale: string } | null => {
  for (const t of REGISTRY) {
    if (t.test.test(text)) return t.build();
  }
  return null;
};
