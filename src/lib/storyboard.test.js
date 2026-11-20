import { describe, expect, test } from 'bun:test';
import { placeInFrame, frameOriginX, FRAME_W, FRAME_PAD } from './storyboard.ts';
import { bboxOf } from './sketch-layout.ts';

const note = (id, x = 0, y = 0) => ({ type: 'rect', id, x, y, w: 140, h: 90 });

describe('placeInFrame', () => {
  test('a run of small notes sits side by side in one row', () => {
    let frame = [];
    for (let i = 0; i < 3; i++) frame = [...frame, ...placeInFrame([note(`n${i}`)], 0, frame)];
    const ys = new Set(frame.map((s) => s.y));
    expect(ys.size).toBe(1);
    expect(frame[1].x).toBeGreaterThan(frame[0].x + frame[0].w);
  });
  test('a row wraps to a new line instead of leaving the frame', () => {
    let frame = [];
    for (let i = 0; i < 12; i++) frame = [...frame, ...placeInFrame([note(`n${i}`)], 0, frame)];
    const box = bboxOf(frame);
    expect(box.maxX).toBeLessThanOrEqual(frameOriginX(0) + FRAME_W - FRAME_PAD);
    expect(new Set(frame.map((s) => s.y)).size).toBeGreaterThan(1);
  });
  test('a large drawing always starts a new row below', () => {
    const frame = placeInFrame([note('a')], 0, []);
    const big = placeInFrame([{ type: 'rect', id: 'b', x: 0, y: 0, w: 900, h: 400 }], 0, frame);
    expect(big[0].y).toBeGreaterThanOrEqual(frame[0].y + frame[0].h + 100);
  });
});

describe('placeInFrame after a wide diagram', () => {
  test('notes after a full-width diagram line up in their own row', () => {
    const diagram = [
      { type: 'text', id: 't', x: 0, y: 0, text: 'Pricing', size: 22, style: 'ui' },
      { type: 'rect', id: 'c1', x: 0, y: 60, w: 520, h: 90 },
      { type: 'rect', id: 'c2', x: 540, y: 60, w: 520, h: 90 },
    ];
    let frame = placeInFrame(diagram, 0, []);
    const a = placeInFrame([note('a')], 0, frame); frame = [...frame, ...a];
    const b = placeInFrame([note('b')], 0, frame);
    expect(b[0].y).toBe(a[0].y);
    expect(b[0].x).toBeGreaterThan(a[0].x + a[0].w);
  });
});
