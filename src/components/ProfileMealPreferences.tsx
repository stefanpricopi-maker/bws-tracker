import { useEffect, useState } from 'react';
import MealFoodPreferences from './MealFoodPreferences';
import { defaultMealPreferences, type MealPreferences } from '../lib/mealPreferences';

export default function ProfileMealPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [mealPreferences, setMealPreferences] = useState<MealPreferences>(defaultMealPreferences());

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: { goals?: { mealPreferences?: MealPreferences } | null }) => {
        if (d.goals?.mealPreferences) {
          setMealPreferences(d.goals.mealPreferences);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealPreferences }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('err');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-64 rounded-2xl bg-gray-800/40 border border-gray-700/40 animate-pulse" />
    );
  }

  return (
    <MealFoodPreferences
      preferences={mealPreferences}
      onChange={setMealPreferences}
      onSave={handleSave}
      saving={saving}
      saveStatus={saveStatus}
      listMaxHeightClass="max-h-[min(60vh,28rem)]"
    />
  );
}
