import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb, resetApiTestDb, jsonRequest, readJson } from './api-harness';
import { GET as getBend, POST as postBend } from '../../src/pages/api/bend-sessions';
import type { BendSession } from '../../src/bend/types';

function sampleSession(overrides: Partial<BendSession> = {}): BendSession {
  return {
    id: 'test-session-1',
    date: '2026-05-30',
    timestamp: 1_700_000_000_000,
    routineName: 'Morning Mobility Routine',
    poses: [
      { poseName: 'Cat-Cow', targetDurationSeconds: 60, completed: false },
      { poseName: "Child's Pose", targetDurationSeconds: 45, completed: false },
    ],
    completed: false,
    ...overrides,
  };
}

describe('/api/bend-sessions', () => {
  beforeEach(async () => {
    await resetApiTestDb();
  });

  it('GET by date returns null when missing', async () => {
    const url = new URL('http://localhost/api/bend-sessions?date=2026-05-30');
    const res = await getBend({
      request: new Request(url),
      url,
    } as Parameters<typeof getBend>[0]);

    expect(res.status).toBe(200);
    const body = await readJson<{ session: BendSession | null }>(res);
    expect(body.session).toBeNull();
  });

  it('POST saves and GET retrieves session', async () => {
    const session = sampleSession();
    const postRes = await postBend({
      request: jsonRequest('POST', { session }),
    } as Parameters<typeof postBend>[0]);
    expect(postRes.status).toBe(200);

    const url = new URL('http://localhost/api/bend-sessions?date=2026-05-30');
    const getRes = await getBend({
      request: new Request(url),
      url,
    } as Parameters<typeof getBend>[0]);

    const body = await readJson<{ session: BendSession }>(getRes);
    expect(body.session.routineName).toBe('Morning Mobility Routine');
    expect(body.session.poses).toHaveLength(2);
  });

  it('POST upserts same date preserving id', async () => {
    const first = sampleSession();
    await postBend({
      request: jsonRequest('POST', { session: first }),
    } as Parameters<typeof postBend>[0]);

    const second = sampleSession({
      id: 'different-id',
      routineName: 'Updated Routine',
      poses: [{ poseName: 'Plank', targetDurationSeconds: 30, completed: true }],
      completed: true,
    });

    await postBend({
      request: jsonRequest('POST', { session: second }),
    } as Parameters<typeof postBend>[0]);

    const url = new URL('http://localhost/api/bend-sessions?date=2026-05-30');
    const getRes = await getBend({
      request: new Request(url),
      url,
    } as Parameters<typeof getBend>[0]);

    const body = await readJson<{ session: BendSession }>(getRes);
    expect(body.session.id).toBe('test-session-1');
    expect(body.session.routineName).toBe('Updated Routine');
    expect(body.session.poses[0].poseName).toBe('Plank');
  });

  it('POST rejects invalid payload', async () => {
    const res = await postBend({
      request: jsonRequest('POST', { session: { bad: true } }),
    } as Parameters<typeof postBend>[0]);
    expect(res.status).toBe(400);
  });
});
