import { useEffect, useState } from 'react';

export type NavPrefs = {
  swipeEnabled: boolean;
  swipeThreshold: number; // px, lower = more sensitive
  animationSpeed: number; // multiplier: 0.5 fast, 1 normal, 2 slow
};

const KEY = 'nav-prefs-v1';
const DEFAULTS: NavPrefs = {
  swipeEnabled: true,
  swipeThreshold: 70,
  animationSpeed: 1,
};

function read(): NavPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function getNavPrefs(): NavPrefs {
  return read();
}

export function useNavPrefs() {
  const [prefs, setPrefs] = useState<NavPrefs>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPrefs(read());
    };
    const onLocal = () => setPrefs(read());
    window.addEventListener('storage', onStorage);
    window.addEventListener('nav-prefs-changed', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('nav-prefs-changed', onLocal);
    };
  }, []);

  const update = (patch: Partial<NavPrefs>) => {
    const next = { ...read(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPrefs(next);
    window.dispatchEvent(new Event('nav-prefs-changed'));
  };

  return { prefs, update };
}
