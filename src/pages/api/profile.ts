import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { db } from '../../db';
import { users, userGoals, googleTokens, type NewUserGoals } from '../../db/schema';
import { isAuthEnabled } from '../../lib/auth';
import { eq } from 'drizzle-orm';


export const GET: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [goals = null] = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  const [gfit] = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId)).limit(1);

  const payload = {
    name: user.name,
    createdAt: user.createdAt,
    authEnabled: isAuthEnabled(),
    googleFit: {
      connected: !!gfit?.refreshToken || !!gfit?.accessToken,
      hasRefreshToken: !!gfit?.refreshToken,
    },
    goals: goals
      ? {
          targetWeightKg: goals.targetWeightKg,
          weeklyWeightLossKg: goals.weeklyWeightLossKg,
          tdeeKcal: goals.tdeeKcal,
          targetCaloriesKcal: goals.targetCaloriesKcal,
          targetProteinG: goals.targetProteinG,
          targetCarbsG: goals.targetCarbsG,
          targetFatG: goals.targetFatG,
          targetSteps: goals.targetSteps,
        }
      : null,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const body = (await request.json()) as Partial<NewUserGoals> & { name?: string };

  if (body.name !== undefined) {
    await db.update(users).set({ name: body.name }).where(eq(users.id, userId));
  }

  const insertValues: NewUserGoals = {
    userId: userId,
    targetWeightKg: body.targetWeightKg ?? null,
    weeklyWeightLossKg: body.weeklyWeightLossKg ?? 0.5,
    tdeeKcal: body.tdeeKcal ?? null,
    targetCaloriesKcal: body.targetCaloriesKcal ?? 1850,
    targetProteinG: body.targetProteinG ?? 180,
    targetCarbsG: body.targetCarbsG ?? 113,
    targetFatG: body.targetFatG ?? 75,
    targetSteps: body.targetSteps ?? 10000,
    updatedAt: new Date().toISOString(),
  };

  const updateSet: Partial<NewUserGoals> = { updatedAt: new Date().toISOString() };
  if (body.targetWeightKg !== undefined) updateSet.targetWeightKg = body.targetWeightKg;
  if (body.weeklyWeightLossKg !== undefined) updateSet.weeklyWeightLossKg = body.weeklyWeightLossKg;
  if (body.tdeeKcal !== undefined) updateSet.tdeeKcal = body.tdeeKcal;
  if (body.targetCaloriesKcal !== undefined) updateSet.targetCaloriesKcal = body.targetCaloriesKcal;
  if (body.targetProteinG !== undefined) updateSet.targetProteinG = body.targetProteinG;
  if (body.targetCarbsG !== undefined) updateSet.targetCarbsG = body.targetCarbsG;
  if (body.targetFatG !== undefined) updateSet.targetFatG = body.targetFatG;
  if (body.targetSteps !== undefined) updateSet.targetSteps = body.targetSteps;

  await db.insert(userGoals)
    .values(insertValues)
    .onConflictDoUpdate({ target: userGoals.userId, set: updateSet });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
