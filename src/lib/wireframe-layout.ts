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
  if (!value || typeof value !== 'object') return [];
  // Accept {screens:[…]}, a bare screen object, or a bare array of screens.
  const v = value as Record<string, unknown>;
  const nested = Object.values(v).find(x => x && typeof x === 'object' && !Array.isArray(x) && Array.isArray((x as Record<string, unknown>).screens)) as Record<string, unknown> | undefined;
  const titleOf = (o: Record<string, unknown>) => [o.title, o.name, o.screen, o.heading, o.label].find(x => typeof x === 'string' && x.trim()) as string | undefined;
  const list: unknown[] = Array.isArray(value) ? value : Array.isArray(v.screens) ? v.screens : Array.isArray(v.pages) ? v.pages : nested ? nested.screens as unknown[] : titleOf(v) ? [v] : [];
  return list.slice(0, 3).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const s = raw as Record<string, unknown>;
    const title = titleOf(s);
    if (!title) return [];
    // Items may arrive as strings or as {label|title|name} objects.
    const asLabel = (x: unknown): string => typeof x === 'string' ? x : x && typeof x === 'object' ? String((x as Record<string, unknown>).label ?? (x as Record<string, unknown>).title ?? (x as Record<string, unknown>).name ?? '') : '';
    const strings = (v: unknown, max: number) => Array.isArray(v) ? v.map(asLabel).filter(x => !!x.trim()).slice(0, max).map(x => x.slice(0, 45)) : [];
    const layouts = ['calendar', 'list', 'detail', 'form'] as const;
    const layout = layouts.find(x => x === s.layout) ?? 'detail';
    const sections = Array.isArray(s.sections) ? s.sections.slice(0, 4).flatMap((v: unknown) => {
      if (!v || typeof v !== 'object') return [];
      const section = v as Record<string, unknown>;
      const title = asLabel(section.title ?? section.name ?? section.label);
      return title ? [{ title: title.slice(0, 40), items: strings(section.items ?? section.fields ?? section.rows, 4) }] : [];
    }) : [];
    return [{ title: title.slice(0, 40), layout, navigation: strings(s.navigation, 5), primaryAction: typeof s.primaryAction === 'string' ? s.primaryAction.slice(0, 26) : '', sections }];
  });
}

/** AI chooses the screen content; this layout owns every coordinate and text width. */
export function buildWireframeScreens(screens: WireframeScreen[], prefix = 'wf'): SketchPrimitive[] {
  const shapes: SketchPrimitive[] = [];
  let oy = 0;
  screens.forEach((screen, index) => {
    // One content column per topic; screens stack vertically and never spill
    // into another frame. Each screen is only as tall as its content, so a
    // sparse screen never leaves a huge empty window.
    const ox = 0;
    let seq = 0;
    const id = () => `${prefix}_${index}_${seq++}`;
    const rect = (x: number, y: number, w: number, h: number, tone: SketchPrimitive['tone'] = 'surface') => shapes.push({ type: 'rect', id: id(), x: ox + x, y: oy + y, w, h, style: 'ui', tone, fill: 'solid' });
    // Every label is clamped to its slot so nothing wraps out of a row or button.
    const text = (x: number, y: number, w: number, value: string, size = 13, tone: SketchPrimitive['tone'] = 'ink', lines = 1) => shapes.push({ type: 'text', id: id(), x: ox + x, y: oy + y, w, text: fitText(value, w, size, lines), size, style: 'ui', tone });
    const line = (x: number, y: number, x2: number, y2: number) => shapes.push({ type: 'line', id: id(), x1: ox + x, y1: oy + y, x2: ox + x2, y2: oy + y2, style: 'ui', tone: 'subtle' });

    // Content goes into `body` first so the window can be sized to fit it.
    const body: Array<() => void> = [];
    let bottom = 196;
    const items = screen.sections.flatMap(s => s.items);
    if (screen.layout === 'calendar') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const left = 188, top = 196, col = 148;
      const list = items.slice(0, 10);
      const rows = Math.max(2, Math.ceil(list.length / 5) + 1);
      const gridBottom = top + 32 + rows * 74;
      body.push(() => {
        days.forEach((day, i) => {
          text(left + i * col + 12, top, col - 24, day, 13, 'muted');
          if (i > 0) line(left + i * col, top + 32, left + i * col, gridBottom);
        });
        for (let row = 0; row <= rows; row++) line(left, top + 32 + row * 74, 928, top + 32 + row * 74);
        list.forEach((item, i) => {
          const x = left + (i % 5) * col + 8, y = top + 42 + Math.floor(i / 5) * 74;
          rect(x, y, col - 16, 52, i === 0 ? 'accent' : 'subtle');
          text(x + 10, y + 8, col - 36, item, 13, 'ink', 2);
        });
      });
      bottom = gridBottom;
    } else if (screen.layout === 'form') {
      // Agreements and toggles are checkboxes, not text inputs; they sit in
      // one column under the input grid.
      const isCheck = (l: string) => /\b(agree|agreement|accept|terms|privacy|remember|subscribe|opt[-\s]?in|newsletter|checkbox|keep me)\b/i.test(l);
      const fields = items.slice(0, 8);
      const inputs = fields.filter(l => !isCheck(l));
      const checks = fields.filter(isCheck);
      inputs.forEach((label, i) => {
        const x = 188 + (i % 2) * 376, y = 196 + Math.floor(i / 2) * 104;
        body.push(() => { text(x, y, 336, label, 13); rect(x, y + 28, 336, 44, 'subtle'); });
        bottom = Math.max(bottom, y + 72);
      });
      checks.forEach((label, i) => {
        const y = i === 0 && inputs.length ? bottom + 28 : i === 0 ? 196 : bottom + 14;
        body.push(() => { rect(188, y, 18, 18, 'subtle'); text(218, y + 1, 700, label, 13); });
        bottom = y + 18;
      });
      if (screen.primaryAction) {
        const y = bottom + 32;
        body.push(() => { rect(188, y, 176, 40, 'accent'); text(204, y + 12, 144, screen.primaryAction, 13); });
        bottom = y + 40;
      }
    } else if (screen.layout === 'list') {
      // Each section is a labelled group of rows.
      let y = 196;
      const grouped = screen.sections.length > 1;
      screen.sections.slice(0, 3).forEach((section, si) => {
        if (grouped || si > 0) {
          const hy = y;
          body.push(() => text(188, hy, 740, section.title, 11, 'muted'));
          y += 28;
        }
        section.items.slice(0, 5).forEach((item, i) => {
          const ry = y;
          body.push(() => {
            if (i % 2 === 0) rect(188, ry, 740, 48, 'subtle');
            text(204, ry + 15, 692, item, 15);
            line(188, ry + 48, 928, ry + 48);
          });
          y += 48;
        });
        y += 24;
      });
      bottom = y - 24;
    } else {
      // Detail / dashboard: one card per section, two per row, height fits items.
      // Cards carry their own titles, so there is no page heading to repeat one.
      bottom = 128;
      const cards = screen.sections.slice(0, 4);
      for (let r = 0; r < cards.length; r += 2) {
        const pair = cards.slice(r, r + 2);
        const h = 64 + Math.max(...pair.map(c => Math.min(4, c.items.length))) * 32;
        const y = bottom;
        pair.forEach((section, k) => {
          const x = 188 + k * 376;
          body.push(() => {
            rect(x, y, 352, h, 'subtle');
            text(x + 16, y + 18, 320, section.title, 15);
            section.items.slice(0, 4).forEach((item, j) => text(x + 16, y + 52 + j * 32, 320, item, 13));
          });
        });
        bottom = y + h + 24;
      }
      bottom -= 24;
    }
    const navBottom = 124 + screen.navigation.length * 44;
    const H = Math.max(bottom, navBottom, 300) + 40; // window bottom, relative to oy

    text(0, 0, 960, screen.title, 22);
    rect(0, 44, 960, H - 44);
    rect(0, 44, 960, 56, 'subtle');
    text(24, 62, 600, screen.title, 15);
    if (screen.primaryAction && screen.layout !== 'form') { rect(760, 56, 176, 32, 'accent'); text(772, 64, 152, screen.primaryAction, 13); }
    rect(0, 100, 164, H - 100, 'subtle');
    screen.navigation.forEach((label, i) => {
      if (i === 0) rect(12, 124 + i * 44, 140, 34);
      text(24, 133 + i * 44, 116, label, 13, i === 0 ? 'ink' : 'muted');
    });
    line(164, 100, 164, H);
    if (screen.layout !== 'detail') text(188, 128, 580, screen.layout === 'list' && screen.sections.length > 1 ? screen.title : (screen.sections[0]?.title || screen.title), 22);
    body.forEach(draw => draw());
    oy += H + 96;
  });
  return shapes;
}
