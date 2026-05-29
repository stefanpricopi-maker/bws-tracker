export type Locale = 'en' | 'ro';

const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    nav_home: 'Home',
    nav_workout: 'Workout',
    nav_diet: 'Diet',
    nav_stats: 'Stats',
    nav_profile: 'Profile',
    theme_light: 'Light',
    theme_dark: 'Dark',
    reminders_title: 'Daily reminders',
    reminders_enable: 'Enable browser reminders',
  },
  ro: {
    nav_home: 'Acasă',
    nav_workout: 'Antrenament',
    nav_diet: 'Dietă',
    nav_stats: 'Statistici',
    nav_profile: 'Profil',
    theme_light: 'Deschis',
    theme_dark: 'Întunecat',
    reminders_title: 'Memento zilnic',
    reminders_enable: 'Activează notificări',
  },
};

export function t(key: string, locale: Locale = 'en'): string {
  return STRINGS[locale][key] ?? STRINGS.en[key] ?? key;
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const v = localStorage.getItem('bws_locale');
  return v === 'ro' ? 'ro' : 'en';
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem('bws_locale', locale);
}
