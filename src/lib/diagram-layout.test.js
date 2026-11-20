import { describe, expect, test } from 'bun:test';
import { buildDiagram, parseDiagramPlan, planFromShapes, DIAGRAM_W } from './diagram-layout.ts';

const rects = (shapes) => shapes.filter((s) => s.type === 'rect');
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlaps = (shapes) => {
  const r = rects(shapes);
  return r.every((a, i) => r.every((b, j) => i === j || !overlap(a, b)));
};
const textsInsideCards = (shapes) => {
  const r = rects(shapes);
  return shapes.filter((s) => s.type === 'text' && s.size !== 22 && s.size !== 11 && s.tone !== 'muted' || (s.type === 'text' && s.text?.startsWith('•')))
    .every((t) => r.some((c) => t.x >= c.x && t.x + t.w <= c.x + c.w && t.y >= c.y && t.y < c.y + c.h));
};

const outline = {
  kind: 'outline', title: 'Activation Execution Outline · New Balance NYC Marathon',
  nodes: [
    { id: 'a', label: 'Expo & Gear Hub', detail: ['Expo hall brand pavilion', 'Official race footwear trials', 'Custom apparel stamping'] },
    { id: 'b', label: 'Community Shakeout', detail: ['Pre-race group runs', 'Athlete meet and greet'] },
    { id: 'c', label: 'Race Day Cheer Zones', detail: ['Course-side sound and DJ hubs', 'Spectator cheer signage', 'Real-time runner app sync'] },
    { id: 'd', label: 'Recovery & Finisher Hub', detail: ['Custom medal engraving', 'Finisher recovery lounge', 'Social celebration photos'] },
    { id: 'e', label: 'Activation Scope', detail: ['Cover runner touchpoints from pre-race expo and community shakeout to cheer hubs and medal engraving'], emphasis: true },
  ],
  edges: [],
};

describe('diagram layout', () => {
  test('outline cards never overlap and stay inside the frame width', () => {
    const shapes = buildDiagram(parseDiagramPlan(outline));
    expect(rects(shapes)).toHaveLength(5);
    expect(noOverlaps(shapes)).toBe(true);
    expect(shapes.filter((s) => 'w' in s && 'x' in s).every((s) => s.x >= 0 && s.x + s.w <= DIAGRAM_W + 0.5)).toBe(true);
  });
  test('every card label and bullet sits inside its card', () => {
    expect(textsInsideCards(buildDiagram(parseDiagramPlan(outline)))).toBe(true);
  });
  test('cards in one row share the same top and height', () => {
    const r = rects(buildDiagram(parseDiagramPlan(outline)));
    const firstRow = r.filter((c) => c.y === r[0].y);
    expect(firstRow.length).toBe(3);
    expect(new Set(firstRow.map((c) => c.h)).size).toBe(1);
  });
  test('flow follows the edges in order with arrows between neighbours', () => {
    const plan = parseDiagramPlan({ kind: 'flow', title: 'Signup', nodes: [{ id: 'c', label: 'Pay' }, { id: 'a', label: 'Sign up' }, { id: 'b', label: 'Verify email' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] });
    const shapes = buildDiagram(plan);
    const labels = shapes.filter((s) => s.type === 'text' && s.size === 15).sort((x, y) => x.x - y.x).map((s) => s.text);
    expect(labels).toEqual(['Sign up', 'Verify email', 'Pay']);
    expect(shapes.filter((s) => s.type === 'arrow')).toHaveLength(2);
    expect(noOverlaps(shapes)).toBe(true);
  });
  test('hierarchy and cycle layouts do not overlap', () => {
    const nodes = ['Root', 'One', 'Two', 'Three', 'Four', 'Five'].map((label, i) => ({ id: `n${i}`, label, detail: ['A detail that wraps across more than one line of text'] }));
    for (const kind of ['hierarchy', 'cycle', 'decision', 'compare']) {
      const edges = kind === 'hierarchy' || kind === 'decision' ? nodes.slice(1).map((n) => ({ from: 'n0', to: n.id, label: 'Yes' })) : [];
      expect(noOverlaps(buildDiagram(parseDiagramPlan({ kind, title: kind, nodes, edges })))).toBe(true);
    }
  });
  test('hand-placed model boxes are salvaged into a clean grid', () => {
    const plan = planFromShapes([
      { type: 'text', id: 't', x: 0, y: 0, text: 'Marathon outline', size: 22 },
      { type: 'rect', id: 'r1', x: 500, y: 600, w: 130, h: 70, label: '' },
      { type: 'text', id: 't1', x: 100, y: 100, text: '1. Expo\n• Brand pavilion\n• Footwear trials' },
      { type: 'text', id: 't2', x: 300, y: 100, text: '2. Community\n• Group runs' },
    ], 'fallback');
    expect(plan.title).toBe('Marathon outline');
    expect(plan.nodes.map((n) => n.label)).toEqual(['1. Expo', '2. Community']);
    expect(plan.nodes[0].detail).toEqual(['Brand pavilion', 'Footwear trials']);
  });
  test('rejects empty plans', () => {
    expect(parseDiagramPlan({ kind: 'flow', nodes: [] })).toBe(null);
  });
});
