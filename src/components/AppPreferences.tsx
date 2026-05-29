import { useEffect, useState } from 'react';
import { getStoredLocale, setStoredLocale, t, type Locale } from '../lib/i18n';

export default function AppPreferences() {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [googleFit, setGoogleFit] = useState<{ connected: boolean; hasRefreshToken: boolean } | null>(null);
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [reminders, setReminders] = useState(false);

  useEffect(() => {
    setLocale(getStoredLocale());
    const th = localStorage.getItem('bws_theme');
    if (th === 'light' || th === 'dark') {
      setTheme(th);
      document.documentElement.dataset.theme = th;
    }
    setReminders(localStorage.getItem('bws_reminders') === '1');

    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        setAuthEnabled(!!d.authEnabled);
        setGoogleFit(d.googleFit ?? null);
      })
      .catch(() => {});

    fetch('/api/auth/me')
      .then((r) => setLoggedIn(r.ok))
      .catch(() => setLoggedIn(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setLoginError('Wrong password');
      return;
    }
    setLoggedIn(true);
    setPassword('');
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setLoggedIn(false);
  }

  function changeLocale(next: Locale) {
    setLocale(next);
    setStoredLocale(next);
    window.location.reload();
  }

  function changeTheme(next: 'dark' | 'light') {
    setTheme(next);
    localStorage.setItem('bws_theme', next);
    document.documentElement.dataset.theme = next;
  }

  async function toggleReminders() {
    const next = !reminders;
    setReminders(next);
    localStorage.setItem('bws_reminders', next ? '1' : '0');
    if (next && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setReminders(false);
        localStorage.setItem('bws_reminders', '0');
      }
    }
  }

  return (
    <div className="rounded-2xl bg-gray-800/40 border border-gray-700/40 p-5 flex flex-col gap-4">
      <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold">App</span>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-300 font-medium">{t('reminders_title', locale)}</p>
        <button
          type="button"
          onClick={() => void toggleReminders()}
          className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors
            ${reminders ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-300'}`}
        >
          {t('reminders_enable', locale)}
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => changeTheme('dark')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${theme === 'dark' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
          {t('theme_dark', locale)}
        </button>
        <button type="button" onClick={() => changeTheme('light')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${theme === 'light' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
          {t('theme_light', locale)}
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => changeLocale('en')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${locale === 'en' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`}>EN</button>
        <button type="button" onClick={() => changeLocale('ro')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${locale === 'ro' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'}`}>RO</button>
      </div>

      {googleFit && (
        <p className={`text-xs ${googleFit.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
          Google Fit: {googleFit.connected
            ? googleFit.hasRefreshToken ? 'Connected (auto-refresh)' : 'Connected — reconnect if sync fails'
            : 'Not connected — use Connect Google Fit below'}
        </p>
      )}

      <a
        href="/api/export?days=90"
        className="text-center py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-semibold text-white transition-colors"
      >
        Export CSV (90 days)
      </a>

      {authEnabled && (
        <div className="border-t border-gray-700/50 pt-3 flex flex-col gap-2">
          {loggedIn ? (
            <button type="button" onClick={() => void handleLogout()} className="py-2 rounded-xl text-sm text-gray-400 hover:text-white">
              Log out
            </button>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="App password"
                className="rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm"
              />
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <button type="submit" className="py-2 rounded-xl bg-violet-600 text-white text-sm font-bold">Log in</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
