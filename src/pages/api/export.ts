import type { APIRoute } from 'astro';
import { db } from '../../db';
import { dailyLogs, workouts, workoutSets } from '../../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { resolveUserId, unauthorizedResponse } from '../../lib/auth';

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const GET: APIRoute = async ({ request, url }) => {
  const userId = await resolveUserId(request);
  if (userId === null) return unauthorizedResponse();

  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 90));
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const [logs, wos] = await Promise.all([
    db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId)).orderBy(desc(dailyLogs.date)),
    db.select().from(workouts).where(eq(workouts.userId, userId)).orderBy(desc(workouts.date)),
  ]);

  const recentLogs = logs.filter((r) => r.date >= sinceStr);
  const recentWos  = wos.filter((w) => w.date >= sinceStr);
  const woIds      = recentWos.map((w) => w.id);

  const allSets =
    woIds.length > 0
      ? await db.select().from(workoutSets).where(inArray(workoutSets.workoutId, woIds))
      : [];

  const lines: string[] = ['type,date,col1,col2,col3,col4,col5,col6'];

  for (const r of recentLogs) {
    lines.push(
      ['log', r.date, r.weightKg, r.steps, r.caloriesIn, r.proteinG, r.carbsG, r.fatG]
        .map(csvEscape)
        .join(','),
    );
  }
  for (const w of recentWos) {
    lines.push(['workout', w.date, w.dayType, '', '', '', '', ''].map(csvEscape).join(','));
  }
  for (const s of allSets) {
    const w = recentWos.find((x) => x.id === s.workoutId);
    lines.push(
      ['set', w?.date ?? '', s.exerciseName, s.setNumber, s.weight, s.reps, s.rpe ?? '']
        .map(csvEscape)
        .join(','),
    );
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bws-export-${sinceStr}.csv"`,
    },
  });
};
