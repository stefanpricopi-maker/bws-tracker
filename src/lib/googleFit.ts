import { google } from 'googleapis';
import { deriveActiveCalories } from './fitness';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
];

// Read env vars lazily inside the function so they are never inlined at build time
export function createOAuth2Client() {
  const clientId     = process.env['GOOGLE_CLIENT_ID']     ?? '';
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? '';
  const redirectUri  = process.env['GOOGLE_REDIRECT_URI']  ?? 'http://localhost:4321/api/auth/google/callback';
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Step 1 — generate consent URL */
export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force refresh_token on every consent
  });
}

/** Step 2 — exchange auth code for tokens */
export async function getTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

export interface DailyMetrics {
  steps: number;
  activeCalories: number;
  sleepHours: number;
}

/**
 * Step 3 — fetch aggregate metrics for a specific date.
 * Uses Google Fit Aggregation API with 86400000ms (1 day) bucket.
 *
 * @param accessToken  - Valid OAuth2 access token
 * @param refreshToken - Refresh token (used to auto-refresh if expired)
 * @param date         - 'YYYY-MM-DD'
 */
export async function fetchDailyMetrics(
  accessToken: string,
  refreshToken: string | null | undefined,
  date: string,
): Promise<DailyMetrics> {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });

  // Midnight → midnight for the requested date (ms)
  const start = new Date(`${date}T00:00:00`).getTime();
  const end   = new Date(`${date}T23:59:59`).getTime();

  const fitness = google.fitness({ version: 'v1', auth: client });

  const body = {
    aggregateBy: [
      {
        // merge_step_deltas = only registered devices (Huawei Watch via Health Sync)
        // NOT estimated_steps which adds Google's phone pedometer and double-counts
        dataTypeName: 'com.google.step_count.delta',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:merge_step_deltas',
      },
      // Activity calories since midnight (steps, NEAT, watch HR estimates) — NOT gym sessions only.
      {
        dataTypeName: 'com.google.calories.expended',
        dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
      },
      {
        dataTypeName: 'com.google.calories.bmr',
      },
      {
        dataTypeName: 'com.google.sleep.segment',
      },
    ],
    bucketByTime: { durationMillis: String(end - start + 1) },
    startTimeMillis: String(start),
    endTimeMillis:   String(end),
  };

  const response = await fitness.users.dataset.aggregate({
    userId: 'me',
    requestBody: body,
  });

  let steps = 0;
  let totalExpended = 0;
  let dailyBmr = 0;
  let sleepMs = 0;

  for (const bucket of response.data.bucket ?? []) {
    for (const dataset of bucket.dataset ?? []) {
      const dataType = dataset.dataSourceId ?? '';

      for (const point of dataset.point ?? []) {
        if (dataType.includes('step_count')) {
          steps += point.value?.[0]?.intVal ?? 0;
        } else if (dataType.includes('calories.expended')) {
          totalExpended += point.value?.[0]?.fpVal ?? 0;
        } else if (dataType.includes('calories.bmr')) {
          dailyBmr = Math.max(dailyBmr, point.value?.[0]?.fpVal ?? 0);
        } else if (dataType.includes('sleep')) {
          // sleep segment: value[0].intVal = sleep stage (1=awake,2=sleep,3=out-of-bed,4=light,5=deep,6=rem)
          // count any stage >= 2 as sleep time
          const stage = point.value?.[0]?.intVal ?? 0;
          if (stage >= 2) {
            const segStart = Number(point.startTimeNanos) / 1e6;
            const segEnd   = Number(point.endTimeNanos)   / 1e6;
            sleepMs += segEnd - segStart;
          }
        }
      }
    }
  }

  const dayProgress = (Date.now() - start) / Math.max(1, end - start + 1);
  const activeCalories = deriveActiveCalories(totalExpended, dailyBmr, dayProgress);

  return {
    steps,
    activeCalories,
    sleepHours: Math.round((sleepMs / 3_600_000) * 10) / 10,
  };
}

// Human-readable labels for the activity types we care about
const ACTIVITY_LABELS: Record<number, string> = {
  1:   'Aerobics',
  3:   'Biking',
  7:   'Running',
  8:   'Running (treadmill)',
  9:   'Rowing',
  17:  'Cross training',
  21:  'Elliptical',
  26:  'Gymnastics',
  29:  'Hiking',
  35:  'Jump rope',
  42:  'Martial arts',
  45:  'Pilates',
  63:  'Swimming',
  64:  'Swimming (pool)',
  74:  'Volleyball',
  82:  'Walking',
  83:  'Walking (fitness)',
  84:  'Walking (Nordic)',
  85:  'Walking (treadmill)',
  93:  'Stretching',
  97:  'Weight training',
  99:  'Yoga',
  108: 'Other activity',
};

export interface WorkoutSession {
  id: string;
  name: string;
  activityType: number;
  activityLabel: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMin: number;
  calories: number | null;
}

/**
 * Fetch workout sessions from Google Fit for a date range.
 * Uses the Sessions API (not the Aggregation API).
 *
 * @param accessToken  - Valid OAuth2 access token
 * @param refreshToken - Refresh token
 * @param startDate    - 'YYYY-MM-DD' (inclusive)
 * @param endDate      - 'YYYY-MM-DD' (inclusive), defaults to startDate
 */
export async function fetchWorkoutSessions(
  accessToken: string,
  refreshToken: string | null | undefined,
  startDate: string,
  endDate?: string,
): Promise<WorkoutSession[]> {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });

  const startMs = new Date(`${startDate}T00:00:00`).getTime();
  const endMs   = new Date(`${endDate ?? startDate}T23:59:59`).getTime();

  const fitness = google.fitness({ version: 'v1', auth: client });

  const sessionsResp = await fitness.users.sessions.list({
    userId: 'me',
    startTime: new Date(startMs).toISOString(),
    endTime:   new Date(endMs).toISOString(),
  });

  // Exclude auto-detected non-workout sessions:
  //   72  = Sleep (already tracked separately)
  //   108 = Other / "Evening other" (auto-generated by Health Sync for general movement)
  //   80  = Still
  //   3   = Still (legacy)
  //   0   = In vehicle
  const EXCLUDED_TYPES = new Set([0, 3, 72, 80]);

  const sessions = (sessionsResp.data.session ?? []).filter((s) => {
    const type = s.activityType ?? -1;
    if (EXCLUDED_TYPES.has(type)) return false;
    const durMin = (Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60_000;
    // Discard sessions < 5 min (noise) or > 300 min (clearly wrong)
    if (durMin < 5 || durMin > 300) return false;
    return true;
  });

  // Fetch calories for each session via aggregation bucketed by session
  const results: WorkoutSession[] = [];

  for (const s of sessions) {
    const activityType = s.activityType ?? 0;
    const sessStart = Number(s.startTimeMillis);
    const sessEnd   = Number(s.endTimeMillis);
    const durationMin = Math.round((sessEnd - sessStart) / 60_000);

    // Get calories for this session window
    let calories: number | null = null;
    try {
      const calResp = await fitness.users.dataset.aggregate({
        userId: 'me',
        requestBody: {
          aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
          bucketByTime: { durationMillis: String(sessEnd - sessStart) },
          startTimeMillis: String(sessStart),
          endTimeMillis:   String(sessEnd),
        },
      });
      let cal = 0;
      for (const bucket of calResp.data.bucket ?? []) {
        for (const dataset of bucket.dataset ?? []) {
          for (const point of dataset.point ?? []) {
            cal += point.value?.[0]?.fpVal ?? 0;
          }
        }
      }
      if (cal > 0) calories = Math.round(cal);
    } catch {
      // calories optional — don't fail the whole fetch
    }

    results.push({
      id:            s.id ?? `${sessStart}`,
      name:          s.name ?? ACTIVITY_LABELS[activityType] ?? 'Workout',
      activityType,
      activityLabel: ACTIVITY_LABELS[activityType] ?? `Activity ${activityType}`,
      startTimeMs:   sessStart,
      endTimeMs:     sessEnd,
      durationMin,
      calories,
    });
  }

  // Most recent first
  return results.sort((a, b) => b.startTimeMs - a.startTimeMs);
}
