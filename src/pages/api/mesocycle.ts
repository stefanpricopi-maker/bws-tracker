import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { mesocycles, users, blockHistory } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { isMesocycleComplete, isDeloadWeek, nextBlock, weeksElapsed, MESOCYCLE_WEEKS } from '../../lib/periodization';

// ── GET /api/mesocycle — current block status + history ────────────────────
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  try {
    const row = await getOrInitMesocycle(userId);
    const weeks   = weeksElapsed(row.blockStartDate);
    const complete = isMesocycleComplete(row.blockStartDate);

    const history = await db
      .select()
      .from(blockHistory)
      .where(eq(blockHistory.userId, userId))
      .orderBy(desc(blockHistory.startedAt))
      .limit(12);

    return new Response(JSON.stringify({
      currentBlock:      row.currentBlock,
      blockStartDate:    row.blockStartDate,
      weeksElapsed:      weeks,
      weeksRemaining:    Math.max(MESOCYCLE_WEEKS - weeks, 0),
      mesocycleComplete: complete,
      isDeloadWeek:      isDeloadWeek(weeks),
      displayWeek:       Math.min(weeks + 1, MESOCYCLE_WEEKS),
      suggestBlockAdvance: complete,
      blockHistory: history.map((h) => ({
        block: h.block,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
      })),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ── POST /api/mesocycle — advance to next block ────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  try {
    const row  = await getOrInitMesocycle(userId);
    const next = nextBlock(row.currentBlock);
    const now  = new Date().toISOString();

    await db.insert(blockHistory).values({
      userId,
      block: row.currentBlock,
      startedAt: row.blockStartDate,
      endedAt: now,
    });

    await db
      .update(mesocycles)
      .set({ currentBlock: next, blockStartDate: now, updatedAt: now })
      .where(eq(mesocycles.userId, userId));

    return new Response(JSON.stringify({
      currentBlock:   next,
      blockStartDate: now,
      message:        `Block ${next} started.`,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

async function getOrInitMesocycle(userId: number) {
  const [existing] = await db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    await db.insert(users).values({ id: userId, name: 'Athlete' }).onConflictDoNothing();
  }

  const started = new Date().toISOString();
  await db.insert(mesocycles).values({
    userId,
    currentBlock:   1,
    blockStartDate: started,
  });

  const [seeded] = await db.select().from(mesocycles).where(eq(mesocycles.userId, userId)).limit(1);
  return seeded!;
}
