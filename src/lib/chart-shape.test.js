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
test('bars never turn warning red; an emphasised bar is blue, the rest neutral', () => {
  const s = buildChart({ kind: 'bar', items: [{ label: 'Jan', value: 120 }, { label: 'Apr', value: 1200, tone: 'danger' }] });
  const bars = s.filter((x) => x.type === 'rect' && x.fill === 'solid');
  expect(bars.map((b) => b.tone)).toEqual(['ink', 'accent']);
});
test('bar labels are centred on their bar', () => {
  const s = buildChart({ kind: 'bar', items: [{ label: 'Jan', value: 1 }, { label: 'Feb', value: 0.5 }] });
  const bar = s.find((x) => x.type === 'rect' && x.fill === 'solid');
  const label = s.find((x) => x.type === 'text' && x.text === 'Jan');
  expect(label.align).toBe('center');
  expect(Math.abs(label.x + label.w / 2 - (bar.x + bar.w / 2))).toBeLessThan(1);
});
