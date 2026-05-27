import { google } from 'googleapis';

const CLIENT_ID     = import.meta.env.GOOGLE_CLIENT_ID     ?? process.env.GOOGLE_CLIENT_ID     ?? '';
const CLIENT_SECRET = import.meta.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '';
const REDIRECT_URI  = import.meta.env.GOOGLE_REDIRECT_URI  ?? process.env.GOOGLE_REDIRECT_URI  ?? '';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
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
        dataTypeName: 'com.google.step_count.delta',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
      },
      {
        dataTypeName: 'com.google.calories.expended',
        dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
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
  let activeCalories = 0;
  let sleepMs = 0;

  for (const bucket of response.data.bucket ?? []) {
    for (const dataset of bucket.dataset ?? []) {
      const dataType = dataset.dataSourceId ?? '';

      for (const point of dataset.point ?? []) {
        if (dataType.includes('step_count')) {
          steps += point.value?.[0]?.intVal ?? 0;
        } else if (dataType.includes('calories')) {
          activeCalories += point.value?.[0]?.fpVal ?? 0;
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

  return {
    steps,
    activeCalories: Math.round(activeCalories),
    sleepHours: Math.round((sleepMs / 3_600_000) * 10) / 10,
  };
}
