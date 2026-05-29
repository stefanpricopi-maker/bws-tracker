import type { APIRoute } from 'astro';
import { requireUser } from '../../lib/apiAuth';
import { put } from '@vercel/blob';
import { db } from '../../db';
import { dailyLogs } from '../../db/schema';
import { eq, and } from 'drizzle-orm';


export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  try {
    const form = await request.formData();
    const file = form.get('photo') as File | null;
    const date = (form.get('date') as string | null) ?? new Date().toISOString().slice(0, 10);

    if (!file || file.size === 0) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!file.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'File must be an image' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Image must be under 10 MB' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `progress/${userId}/${date}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      allowOverwrite: true,
    });

    // Upsert photo_url into daily_logs for this date
    const [existing] = await db
      .select({ id: dailyLogs.id })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
      .limit(1);

    if (existing) {
      await db
        .update(dailyLogs)
        .set({ photoUrl: blob.url })
        .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
    } else {
      await db.insert(dailyLogs).values({
        userId: userId,
        date,
        photoUrl: blob.url,
      });
    }

    return new Response(JSON.stringify({ url: blob.url }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
