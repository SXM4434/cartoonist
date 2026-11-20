import { test, expect } from 'bun:test';
import { buildChart } from './chart-shape.ts';
const texts = (s) => s.filter((x) => x.type === 'text').map((x) => x.text);
test('bar chart shows the spoken numbers, not percentages', () => {
  const s = buildChart({ kind: 'bar', items: [{ label: 'Jan', value: 120 }, { label: 'Apr', value: 900 }] });
  expect(texts(s)).toContain('120');
  expect(texts(s)).toContain('900');
  const bars = s.filter((x) => x.type === 'rect');
  expect(bars[0].h).toBeLessThan(bars[1].h);
});
test('explicit display wins over the normalized value', () => {
  const s = buildChart({ kind: 'bar', items: [{ label: 'Jan', value: 0.13, display: '120' }] });
  expect(texts(s)).toContain('120');
});
