'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { colors, getThemeColors, ThemeMode, ThemeColors } from '@entry-hub/shared';
import { supabase } from '../supabase/client';

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    // 1. localStorage 저장값 확인
    const savedTheme = localStorage.getItem('entry_hub_theme') as ThemeMode | null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.documentElement.style.colorScheme = savedTheme;
    } else if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setThemeState('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    }

    // 초기 테마를 웹뷰/확장프로그램과 동기화하기 위한 postMessage
    const initialTheme = savedTheme || 'light';
    window.postMessage({ type: 'ENTRY_HUB_THEME_CHANGED', theme: initialTheme }, '*');
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('entry_hub_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.documentElement.style.colorScheme = newTheme;

    // 확장프로그램 및 자식 iframe/content script와 동기화
    window.postMessage({ type: 'ENTRY_HUB_THEME_CHANGED', theme: newTheme }, '*');

    // 로그인된 유저가 있다면 Supabase 프로필에도 테마 저장
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        supabase.from('users').update({ theme: newTheme }).eq('id', data.user.id).then();
      }
    });
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const activeColors = getThemeColors(theme);

  return (
    <ThemeContext.Provider value={{ theme, colors: activeColors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'light' as ThemeMode,
      colors: colors,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
}
