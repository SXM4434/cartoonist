import { test, expect } from 'bun:test';
import { eventKey, runAgentEvent } from './agent-events.ts';

test('the same event key runs one job and returns its saved result', async () => {
  const rows = new Map();
  const store = {
    claim: async (key) => {
      if (rows.has(key)) return { claimed: false, ...rows.get(key) };
      rows.set(key, { status: 'running' });
      return { claimed: true, status: 'running' };
    },
    finish: async (key, status, result, error) => rows.set(key, { status, result, error }),
  };
  let calls = 0;
  const key = eventKey('advocate', 'room-1', 'same transcript');
  expect((await runAgentEvent(store, key, async () => ++calls)).result).toBe(1);
  expect((await runAgentEvent(store, key, async () => ++calls)).result).toBe(1);
  expect(calls).toBe(1);
});
test('a failed event stays failed and is not autonomously retried', async () => {
  const rows = new Map();
  const store = {
    claim: async key => rows.has(key) ? { claimed: false, ...rows.get(key) } : (rows.set(key, { status: 'running' }), { claimed: true, status: 'running' }),
    finish: async (key, status, result, error) => rows.set(key, { status, result, error }),
  };
  let calls = 0;
  const work = () => { calls++; throw new Error('failed'); };
  expect((await runAgentEvent(store, 'key', work)).status).toBe('failed');
  expect((await runAgentEvent(store, 'key', work)).status).toBe('failed');
  expect(calls).toBe(1);
});
