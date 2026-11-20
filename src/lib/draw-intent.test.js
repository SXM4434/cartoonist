import { describe, expect, test } from 'bun:test';
import { wantsUiWireframe } from './draw-intent.ts';

describe('wantsUiWireframe', () => {
  test('a flow that mentions a dashboard step is a diagram, not a screen', () => {
    expect(wantsUiWireframe('Draw the signup flow: landing page, email entry, verify code, pick a plan, dashboard')).toBe(false);
  });
  test('explicit wireframe requests draw screens', () => {
    expect(wantsUiWireframe('Wireframe the mobile checkout screen with cart items')).toBe(true);
    expect(wantsUiWireframe('make a mockup of the settings')).toBe(true);
  });
  test('a bare dashboard request draws a screen', () => {
    expect(wantsUiWireframe('draw the admin dashboard')).toBe(true);
  });
  test('timelines and comparisons are diagrams', () => {
    expect(wantsUiWireframe('Make a timeline: beta in March, launch April 12')).toBe(false);
    expect(wantsUiWireframe('Compare build vs buy on cost and risk')).toBe(false);
  });
});
