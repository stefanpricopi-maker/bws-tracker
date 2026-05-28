import type { APIRoute } from 'astro';
import { db } from '../../db';
import { mesocycles, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { isMesocycleComplete, nextBlock, weeksElapsed, MESOCYCLE_WEEKS } from '../../lib/periodization';

const USER_ID = 1;

// ── GET /api/mesocycle — current block status ──────────────────────────────
export const GET: APIRoute = async () => {
  try {
    const row = await getOrInitMesocycle();
    const weeks   = weeksElapsed(row.blockStartDate);
    const complete = isMesocycleComplete(row.blockStartDate);

    return new Response(JSON.stringify({
      currentBlock:      row.currentBlock,
      blockStartDate:    row.blockStartDate,
      weeksElapsed:      weeks,
      weeksRemaining:    Math.max(MESOCYCLE_WEEKS - weeks, 0),
      mesocycleComplete: complete,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ── POST /api/mesocycle — advance to next block ────────────────────────────
export const POST: APIRoute = async () => {
  try {
    const row  = await getOrInitMesocycle();
    const next = nextBlock(row.currentBlock);
    const now  = new Date().toISOString();

    await db
      .update(mesocycles)
      .set({ currentBlock: next, blockStartDate: now, updatedAt: now })
      .where(eq(mesocycles.userId, USER_ID));

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

// ── Helper — get or seed mesocycle row ────────────────────────────────────
async function getOrInitMesocycle() {
  const [existing] = await db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.userId, USER_ID))
    .limit(1);

  if (existing) return existing;

  // Seed: ensure user exists first
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, USER_ID)).limit(1);
  if (!user) {
    await db.insert(users).values({ id: USER_ID, name: 'Stefan' }).onConflictDoNothing();
  }

  await db.insert(mesocycles).values({
    userId:         USER_ID,
    currentBlock:   1,
    blockStartDate: new Date().toISOString(),
  });

  const [seeded] = await db.select().from(mesocycles).where(eq(mesocycles.userId, USER_ID)).limit(1);
  return seeded!;
}
