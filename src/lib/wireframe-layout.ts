import type { SketchPrimitive } from './sketch-types';
import { fitText } from './text-fit';

export type WireframeScreen = {
  title: string;
  layout: 'calendar' | 'list' | 'detail' | 'form';
  navigation: string[];
  primaryAction: string;
  sections: Array<{ title: string; items: string[] }>;
};

export function parseWireframePlan(value: unknown): WireframeScreen[] {
  if (!value || typeof value !== 'object' || !('screens' in value) || !Array.isArray(value.screens)) return [];
  return value.screens.slice(0, 3).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const s = raw as Record<string, unknown>;
    if (typeof s.title !== 'string' || !s.title.trim()) return [];
    const strings = (v: unknown, max: number) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, max).map(x => x.slice(0, 45)) : [];
    const layouts = ['calendar', 'list', 'detail', 'form'] as const;
    const layout = layouts.find(x => x === s.layout) ?? 'detail';
    const sections = Array.isArray(s.sections) ? s.sections.slice(0, 4).flatMap((v: unknown) => {
      if (!v || typeof v !== 'object') return [];
      const section = v as Record<string, unknown>;
      return typeof section.title === 'string' ? [{ title: section.title.slice(0, 40), items: strings(section.items, 4) }] : [];
    }) : [];
    return [{ title: s.title.slice(0, 40), layout, navigation: strings(s.navigation, 5), primaryAction: typeof s.primaryAction === 'string' ? s.primaryAction.slice(0, 26) : '', sections }];
  });
}

/** AI chooses the screen content; this layout owns every coordinate and text width. */
export function buildWireframeScreens(screens: WireframeScreen[], prefix = 'wf'): SketchPrimitive[] {
  const shapes: SketchPrimitive[] = [];
  screens.forEach((screen, index) => {
    // One content column per topic; screens must not spill into another frame.
    const ox = 0;
    const oy = index * 820;
    let seq = 0;
    const id = () => `${prefix}_${index}_${seq++}`;
    const rect = (x: number, y: number, w: number, h: number, tone: SketchPrimitive['tone'] = 'surface') => shapes.push({ type: 'rect', id: id(), x: ox + x, y: oy + y, w, h, style: 'ui', tone, fill: 'solid' });
    // Every label is clamped to its slot so nothing wraps out of a row or button.
    const text = (x: number, y: number, w: number, value: string, size = 13, tone: SketchPrimitive['tone'] = 'ink', lines = 1) => shapes.push({ type: 'text', id: id(), x: ox + x, y: oy + y, w, text: fitText(value, w, size, lines), size, style: 'ui', tone });
    const line = (x: number, y: number, x2: number, y2: number) => shapes.push({ type: 'line', id: id(), x1: ox + x, y1: oy + y, x2: ox + x2, y2: oy + y2, style: 'ui', tone: 'subtle' });
    text(0, 0, 960, screen.title, 22);
    rect(0, 44, 960, 680);
    rect(0, 44, 960, 56, 'subtle');
    text(24, 62, 600, screen.title, 15);
    if (screen.primaryAction) { rect(760, 56, 176, 32, 'accent'); text(772, 64, 152, screen.primaryAction, 13); }
    rect(0, 100, 164, 624, 'subtle');
    screen.navigation.forEach((label, i) => {
      if (i === 0) rect(12, 124 + i * 44, 140, 34);
      text(24, 133 + i * 44, 116, label, 13, i === 0 ? 'ink' : 'muted');
    });
    line(164, 100, 164, 724);
    text(188, 128, 580, screen.sections[0]?.title || screen.title, 22);
    if (screen.layout === 'calendar') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const left = 188, top = 196, col = 148;
      days.forEach((day, i) => {
        text(left + i * col + 12, top, col - 24, day, 13, 'muted');
        line(left + i * col, top + 32, left + i * col, 676);
      });
      for (let row = 0; row < 6; row++) line(left, top + 32 + row * 74, 928, top + 32 + row * 74);
      const items = screen.sections.flatMap(s => s.items).slice(0, 8);
      items.forEach((item, i) => {
        const x = left + (i % 5) * col + 8, y = top + 42 + Math.floor(i / 5) * 74;
        rect(x, y, col - 16, 52, i === 0 ? 'accent' : 'subtle');
        text(x + 10, y + 8, col - 36, item, 13, 'ink', 2);
      });
    } else if (screen.layout === 'form') {
      screen.sections.flatMap(s => s.items).slice(0, 6).forEach((label, i) => {
        const x = 188 + (i % 2) * 376, y = 196 + Math.floor(i / 2) * 132;
        text(x, y, 336, label, 13);
        rect(x, y + 32, 336, 48, 'subtle');
      });
    } else if (screen.layout === 'list') {
      screen.sections.flatMap(s => s.items).slice(0, 8).forEach((item, i) => {
        const y = 196 + i * 56;
        if (i % 2 === 0) rect(188, y, 740, 56, 'subtle');
        text(204, y + 18, 692, item, 15);
        line(188, y + 56, 928, y + 56);
      });
    } else {
      screen.sections.forEach((section, i) => {
        const x = 188 + (i % 2) * 376, y = 196 + Math.floor(i / 2) * 236;
        rect(x, y, 352, 212, 'subtle');
        text(x + 16, y + 18, 320, section.title, 15);
        section.items.slice(0, 4).forEach((item, j) => text(x + 16, y + 56 + j * 36, 320, item, 13));
      });
    }
  });
  return shapes;
}