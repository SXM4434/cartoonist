import { describe, expect, test } from 'bun:test';
import { buildWireframeScreens, parseWireframePlan } from './wireframe-layout';

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
});