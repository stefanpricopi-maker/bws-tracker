import type { Page } from '@playwright/test';

const PUSH_EXERCISE = 'Dumbbell Floor Press';

/** Skip first-run onboarding overlay in E2E. */
export async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('bws_onboarding_v1', 'done');
  });
}

/** Stub APIs so Workout Player E2E does not need Turso or a real LLM. */
export async function mockWorkoutPlayerApis(page: Page) {
  await page.route('**/api/mesocycle', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentBlock:        1,
        blockStartDate:      new Date().toISOString().slice(0, 10),
        weeksElapsed:        0,
        weeksRemaining:      8,
        mesocycleComplete:   false,
        isDeloadWeek:        false,
        displayWeek:         1,
        suggestBlockAdvance: false,
        blockHistory:        [],
      }),
    });
  });

  await page.route('**/api/generate-weekly-plan', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plan: {
          split_type: '7-day',
          isDeloadWeek: false,
          days: [
            {
              day_name:  'Monday',
              category:  'Push',
              exercises: [{ name: PUSH_EXERCISE, sets: 2 }],
            },
            { day_name: 'Tuesday',   category: 'Pull',      exercises: [] },
            { day_name: 'Wednesday', category: 'Rest',      exercises: [] },
            { day_name: 'Thursday',  category: 'Legs',      exercises: [] },
            { day_name: 'Friday',    category: 'Upper',     exercises: [] },
            { day_name: 'Saturday',  category: 'Legs+Arms', exercises: [] },
            { day_name: 'Sunday',    category: 'Rest',      exercises: [] },
          ],
        },
      }),
    });
  });

  await page.route('**/api/exercises**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        exercises: [{ id: 1, name: PUSH_EXERCISE, targetMuscle: 'Chest', category: 'Push', isCustom: false, imageUrl: null }],
        total:     1,
        limit:     200,
        offset:    0,
      }),
    });
  });

  await page.route('**/api/workouts?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lastWeight:   40,
        lastReps:     8,
        maxWeight:    40,
        maxReps:      8,
        needs_deload: false,
      }),
    });
  });

  await page.route('**/api/workout-set', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ workout_id: 42 }),
      });
      return;
    }
    await route.continue();
  });
}
