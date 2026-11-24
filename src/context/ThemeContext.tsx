import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
export type ThemeMode = 'system' | 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  nextThemeLabel: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_MODE_KEY = 'lowervibe_theme_mode_v3';

function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveThemeForMode(mode: ThemeMode, system: Theme): Theme {
  return mode === 'system' ? system : mode;
}

function applyThemeToDocument(resolved: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    document.getElementById('lv-theme-color')?.setAttribute('content', '#0A0B0A');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    document.getElementById('lv-theme-color')?.setAttribute('content', '#F4F6F2');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_MODE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {}
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    update();
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const resolvedTheme = resolveThemeForMode(themeMode, systemTheme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {}
    applyThemeToDocument(resolvedTheme);
  }, [themeMode, resolvedTheme]);

  const applyAndPersistMode = (nextMode: ThemeMode) => {
    try {
      localStorage.setItem(THEME_MODE_KEY, nextMode);
    } catch {}
    applyThemeToDocument(resolveThemeForMode(nextMode, getSystemTheme()));
    setThemeModeState(nextMode);
  };

  const toggleTheme = () => {
    applyAndPersistMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    applyAndPersistMode(newTheme);
  };

  const setThemeMode = (mode: ThemeMode) => {
    applyAndPersistMode(mode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        isDark: resolvedTheme === 'dark',
        toggleTheme,
        setTheme,
        setThemeMode,
        nextThemeLabel: resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
