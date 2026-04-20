'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'hiitsme_theme';

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const isDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);
  const isDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());

  useEffect(() => {
    applyThemeClass(mode);
  }, [mode]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeClass('system');

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode]);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleDark = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return { mode, isDark, setTheme, toggleDark };
}
