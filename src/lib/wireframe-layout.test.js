import { describe, expect, test } from 'bun:test';
import { buildWireframeScreens, parseWireframePlan } from './wireframe-layout.ts';

describe('wireframe screen layout', () => {
  test('keeps travel-calendar content and screen boundaries', () => {
    const screens = parseWireframePlan({ screens: [{ title: 'Client itinerary', layout: 'calendar', navigation: ['Calendar', 'Clients'], primaryAction: 'Resolve conflict', sections: [{ title: 'Travel calendar', items: ['Hotel response', 'Itinerary conflict'] }] }] });
    const shapes = buildWireframeScreens(screens);
    expect(shapes.some(s => s.type === 'text' && s.text === 'Hotel response')).toBe(true);
    expect(shapes.filter(s => s.type === 'rect').every(s => s.type === 'rect' && s.x >= 0 && s.x + s.w <= 960 && s.y + s.h <= 724)).toBe(true);
  });
  test('rejects missing screen content instead of inventing a dashboard', () => {
    expect(parseWireframePlan({ screens: [{ layout: 'calendar' }] })).toEqual([]);
    expect(buildWireframeScreens([])).toEqual([]);
  });
  test('multiple screens stay in one topic column with a clear vertical gap', () => {
    const screen = { title: 'Calendar', layout: 'calendar', navigation: [], primaryAction: '', sections: [] };
    const shapes = buildWireframeScreens([screen, { ...screen, title: 'Conflict resolution' }]);
    const titles = shapes.filter(s => s.type === 'text' && s.size === 22 && s.x === 0);
    expect(titles.map(s => s.y)).toEqual([0, 820]);
    expect(shapes.filter(s => s.type === 'rect').every(s => s.x + s.w <= 960)).toBe(true);
  });
  test('calendar bookings fit inside their date row instead of covering grid lines', () => {
    const shapes = buildWireframeScreens([{ title: 'Calendar', layout: 'calendar', navigation: [], primaryAction: '', sections: [{ title: 'November', items: ['Paris', 'Rome', 'Tokyo', 'Oslo', 'Lima', 'Berlin'] }] }]);
    const bookings = shapes.filter(s => s.type === 'rect' && s.w === 132);
    expect(bookings).toHaveLength(6);
    expect(bookings.every(s => s.h === 52 && s.y + s.h < 228 + (Math.floor((s.y - 238) / 74) + 1) * 74)).toBe(true);
  });
});