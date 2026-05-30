import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { bendSessions } from '../../db/schema';
import { and, eq, desc, gte } from 'drizzle-orm';
import type { BendSession, StretchPoseLog } from '../../bend/types';
import { ensureBendSchema } from '../../bend/ensureBendSchema';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function apiError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

function isStretchPoseLog(v: unknown): v is StretchPoseLog {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.poseName === 'string' &&
    typeof o.targetDurationSeconds === 'number' &&
    typeof o.completed === 'boolean'
  );
}

function parseBendSession(raw: unknown): BendSession | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== 'string' ||
    typeof o.date !== 'string' ||
    typeof o.timestamp !== 'number' ||
    typeof o.routineName !== 'string' ||
    typeof o.completed !== 'boolean' ||
    !Array.isArray(o.poses)
  ) {
    return null;
  }
  if (!o.poses.every(isStretchPoseLog)) return null;
  return {
    id: o.id,
    date: o.date,
    timestamp: o.timestamp,
    routineName: o.routineName,
    poses: o.poses as StretchPoseLog[],
    notes: typeof o.notes === 'string' ? o.notes : undefined,
    completed: o.completed,
  };
}

function rowToSession(row: typeof bendSessions.$inferSelect): BendSession {
  try {
    const parsed = parseBendSession(JSON.parse(row.sessionJson));
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }
  return {
    id: row.id,
    date: row.date,
    timestamp: row.timestamp,
    routineName: row.routineName,
    poses: [],
    completed: false,
  };
}

// GET /api/bend-sessions?date=YYYY-MM-DD | ?id=uuid | ?days=7
export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    await ensureBendSchema();

    const id = url.searchParams.get('id');
  if (id) {
    const [row] = await db
      .select()
      .from(bendSessions)
      .where(and(eq(bendSessions.userId, userId), eq(bendSessions.id, id)))
      .limit(1);
    if (!row) {
      return new Response(JSON.stringify({ session: null }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }
    return new Response(JSON.stringify({ session: rowToSession(row) }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const date = url.searchParams.get('date');
  if (date) {
    const [row] = await db
      .select()
      .from(bendSessions)
      .where(and(eq(bendSessions.userId, userId), eq(bendSessions.date, date)))
      .limit(1);
    return new Response(JSON.stringify({ session: row ? rowToSession(row) : null }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const daysParam = url.searchParams.get('days');
  if (daysParam !== null) {
    const days = Math.min(30, Math.max(1, Number(daysParam) || 7));
    const start = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const rows = await db
      .select()
      .from(bendSessions)
      .where(and(eq(bendSessions.userId, userId), gte(bendSessions.date, start)))
      .orderBy(desc(bendSessions.date));
    return new Response(
      JSON.stringify({ sessions: rows.map(rowToSession) }),
      { status: 200, headers: JSON_HEADERS },
    );
  }

  return new Response(JSON.stringify({ error: 'Provide date, id, or days query param.' }), {
    status: 400,
    headers: JSON_HEADERS,
  });
  } catch (err) {
    console.error('GET /api/bend-sessions error:', err);
    return apiError('Bend session load failed.');
  }
};

// POST /api/bend-sessions — upsert session for date
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    await ensureBendSchema();

  let body: { session?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const session = parseBendSession(body.session);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid Bend session payload.' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const [existingForDate] = await db
    .select({ id: bendSessions.id })
    .from(bendSessions)
    .where(and(eq(bendSessions.userId, userId), eq(bendSessions.date, session.date)))
    .limit(1);

  const toSave: BendSession = existingForDate
    ? { ...session, id: existingForDate.id }
    : session;

  const sessionJson = JSON.stringify(toSave);

  if (existingForDate && existingForDate.id !== session.id) {
    await db.delete(bendSessions).where(eq(bendSessions.id, session.id));
  }

  await db
    .insert(bendSessions)
    .values({
      id: toSave.id,
      userId,
      date: toSave.date,
      timestamp: toSave.timestamp,
      routineName: toSave.routineName,
      sessionJson,
    })
    .onConflictDoUpdate({
      target: bendSessions.id,
      set: {
        date: toSave.date,
        timestamp: toSave.timestamp,
        routineName: toSave.routineName,
        sessionJson,
      },
    });

  return new Response(JSON.stringify({ ok: true, session: toSave }), {
    status: 200,
    headers: JSON_HEADERS,
  });
  } catch (err) {
    console.error('POST /api/bend-sessions error:', err);
    return apiError('Bend session save failed.');
  }
};

// DELETE /api/bend-sessions?id=uuid
export const DELETE: APIRoute = async ({ request, url }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    await ensureBendSchema();

  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'id is required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  await db
    .delete(bendSessions)
    .where(and(eq(bendSessions.userId, userId), eq(bendSessions.id, id)));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
  } catch (err) {
    console.error('DELETE /api/bend-sessions error:', err);
    return apiError('Bend session delete failed.');
  }
};
