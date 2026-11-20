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
    expect(titles[0].y).toBe(0);
    const firstWindow = shapes.find(s => s.type === 'rect' && s.y === 44 && s.w === 960);
    expect(titles[1].y).toBeGreaterThanOrEqual(firstWindow.y + firstWindow.h + 64);
    expect(shapes.filter(s => s.type === 'rect').every(s => s.x + s.w <= 960)).toBe(true);
  });
  test('calendar bookings fit inside their date row instead of covering grid lines', () => {
    const shapes = buildWireframeScreens([{ title: 'Calendar', layout: 'calendar', navigation: [], primaryAction: '', sections: [{ title: 'November', items: ['Paris', 'Rome', 'Tokyo', 'Oslo', 'Lima', 'Berlin'] }] }]);
    const bookings = shapes.filter(s => s.type === 'rect' && s.w === 132);
    expect(bookings).toHaveLength(6);
    expect(bookings.every(s => s.h === 52 && s.y + s.h < 228 + (Math.floor((s.y - 238) / 74) + 1) * 74)).toBe(true);
  });
  test('a sparse screen is only as tall as its content', () => {
    const shapes = buildWireframeScreens([{ title: 'Budget', layout: 'list', navigation: ['Home'], primaryAction: 'Add expense', sections: [{ title: 'Categories', items: ['Groceries', 'Rent', 'Transport'] }] }]);
    const win = shapes.find(s => s.type === 'rect' && s.y === 44 && s.w === 960);
    expect(win.y + win.h).toBeLessThan(420);
  });
  test('list sections each get a heading and their own rows', () => {
    const shapes = buildWireframeScreens([{ title: 'Budget', layout: 'list', navigation: [], primaryAction: '', sections: [{ title: 'Categories', items: ['Groceries', 'Rent'] }, { title: 'Recent', items: ['Coffee'] }] }]);
    const texts = shapes.filter(s => s.type === 'text').map(s => s.text);
    expect(texts).toContain('Categories');
    expect(texts).toContain('Recent');
    expect(texts.indexOf('Recent')).toBeGreaterThan(texts.indexOf('Rent'));
  });
});
test('form agreements render as checkboxes, not text inputs', () => {
  const shapes = buildWireframeScreens([{ title: 'Sign up', layout: 'form', navigation: [], primaryAction: 'Create account', sections: [{ title: 'Account', items: ['Email', 'Password', 'I agree to the terms'] }] }]);
  const label = shapes.find(s => s.type === 'text' && s.text === 'I agree to the terms');
  const box = shapes.find(s => s.type === 'rect' && s.w === 18 && s.h === 18);
  expect(box).toBeTruthy();
  expect(Math.abs(box.y - label.y)).toBeLessThan(4);
  expect(shapes.filter(s => s.type === 'rect' && s.w === 336)).toHaveLength(2);
});
