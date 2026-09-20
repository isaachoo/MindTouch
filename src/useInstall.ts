import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
}

// Capture the event as early as possible: Chrome may fire it before React mounts.
let pending: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent) => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pending = e as BeforeInstallPromptEvent;
  listeners.forEach((fn) => fn(pending!));
});

export type InstallState =
  | { kind: 'none' }
  | { kind: 'prompt'; install: () => Promise<void> }
  | { kind: 'ios-hint' };

/** Exposes a way to trigger the browser's PWA install dialog, or an iOS hint. */
export function useInstall(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(() => pending);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => setDeferred(e);
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      pending = null;
    };
    listeners.add(onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      listeners.delete(onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return { kind: 'none' };
  if (deferred) {
    return {
      kind: 'prompt',
      install: async () => {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') setInstalled(true);
        setDeferred(null);
        pending = null;
      },
    };
  }
  if (isIOS()) return { kind: 'ios-hint' };
  return { kind: 'none' };
}
