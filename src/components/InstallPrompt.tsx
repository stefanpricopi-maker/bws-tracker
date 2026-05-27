import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
  }

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-50
                    flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl
                    bg-gray-800 border border-violet-500/40">
      <span className="text-2xl">📲</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Install BWS Tracker</p>
        <p className="text-xs text-gray-400">Add to home screen for the best experience</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setVisible(false)}
          className="text-xs text-gray-500 px-2 py-1"
        >
          Later
        </button>
        <button
          onClick={handleInstall}
          className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg"
        >
          Install
        </button>
      </div>
    </div>
  );
}
