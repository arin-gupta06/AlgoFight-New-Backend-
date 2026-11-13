import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import ThemeSwitchLoader from '../components/Common/ThemeSwitchLoader';
import { THEMES, THEME_ORDER, THEME_LIST, DEFAULT_THEME_ID, getThemeConfig } from '../config/themes';
import { updateUserThemePreference } from '../services/api';

export const DEFAULT_UNLOCKED_THEMES = ['custom', 'regular', 'light'];

const ThemeContext = createContext({
  theme: DEFAULT_THEME_ID,
  targetTheme: DEFAULT_THEME_ID,
  isSwitching: false,
  activeThemeConfig: THEMES[DEFAULT_THEME_ID],
  themes: THEME_LIST,
  unlockedThemes: DEFAULT_UNLOCKED_THEMES,
  isThemeUnlocked: () => true,
  unlockTheme: () => {},
  previewTheme: () => {},
  clearPreviewTheme: () => {},
  previewThemeId: null,
  setTheme: () => {},
  toggleTheme: () => {},
  cycleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('algofight_theme');
      return THEMES[saved] ? saved : DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  });

  const [previewThemeId, setPreviewThemeId] = useState(null);

  const [unlockedThemes, setUnlockedThemes] = useState(() => {
    try {
      const saved = localStorage.getItem('algofight_unlocked_themes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return Array.from(new Set([...DEFAULT_UNLOCKED_THEMES, ...parsed]));
        }
      }
    } catch {}
    return DEFAULT_UNLOCKED_THEMES;
  });

  const isThemeUnlocked = (themeId) => {
    if (DEFAULT_UNLOCKED_THEMES.includes(themeId)) return true;
    try {
      const stored = localStorage.getItem('algofight_user_profile');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role === 'ADMIN' || u?.userType === 'ADMIN') {
          return true;
        }
      }
    } catch {}
    return unlockedThemes.includes(themeId);
  };

  const unlockTheme = (themeId) => {
    if (!THEMES[themeId]) return;
    setUnlockedThemes((prev) => {
      const next = Array.from(new Set([...prev, themeId]));
      try {
        localStorage.setItem('algofight_unlocked_themes', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [isSwitching, setIsSwitching] = useState(false);
  const [targetTheme, setTargetTheme] = useState(theme);
  const switchTimerRef = useRef(null);
  const finishTimerRef = useRef(null);

  // Apply theme attributes and CSS variables whenever active theme or preview changes
  useEffect(() => {
    try {
      const activeId = previewThemeId || theme;
      const config = getThemeConfig(activeId);
      document.documentElement.setAttribute('data-theme', activeId);

      // Only persist permanent theme in localStorage
      if (!previewThemeId) {
        localStorage.setItem('algofight_theme', theme);
      }

      // Inject theme-specific CSS variables dynamically for instant reciprocation
      if (config && config.tokens) {
        Object.entries(config.tokens).forEach(([token, val]) => {
          document.documentElement.style.setProperty(token, val);
        });
      }

      // Inject scene properties as CSS variables for Hero Scene & components
      if (config && config.scene) {
        document.documentElement.style.setProperty('--scene-light-primary', config.scene.lightPrimary);
        document.documentElement.style.setProperty('--scene-light-secondary', config.scene.lightSecondary);
        document.documentElement.style.setProperty('--scene-glow-intensity', config.scene.glowIntensity);
        document.documentElement.style.setProperty('--scene-stage-glow', config.scene.stageGlow);
        document.documentElement.style.setProperty('--scene-vignette-edge', config.scene.vignetteEdge);
        document.documentElement.style.setProperty('--scene-vignette-mid', config.scene.vignetteMid);
        document.documentElement.style.setProperty('--scene-particle-color', config.scene.particleColor);
      }
    } catch {
      // Ignore storage/DOM errors in restricted contexts
    }
  }, [theme, previewThemeId]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  // Synchronize existing user's saved profile preference if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem('algofight_user_profile');
      if (stored) {
        const u = JSON.parse(stored);
        const pref = u?.themePreference || u?.studentIdentityMetadata?.themePreference;
        if (pref && THEMES[pref]) {
          const userExplicitlySet = localStorage.getItem('algofight_theme_user_set');
          if (!userExplicitlySet && pref !== theme) {
            initiateThemeSwitch(pref, false);
          }
        }
      }
    } catch {}
  }, []);

  const previewTheme = (themeId) => {
    if (THEMES[themeId]) {
      setPreviewThemeId(themeId);
    }
  };

  const clearPreviewTheme = () => {
    setPreviewThemeId(null);
  };

  const initiateThemeSwitch = (nextTheme, withLoader = false) => {
    const validated = THEMES[nextTheme] ? nextTheme : DEFAULT_THEME_ID;
    setPreviewThemeId(null);
    if (validated === theme && !isSwitching) return;

    try {
      localStorage.setItem('algofight_theme', validated);
      localStorage.setItem('algofight_theme_user_set', 'true');
    } catch {}

    // Persist to backend profile if logged in
    try {
      const token = localStorage.getItem('algofight_session_token');
      if (token) {
        updateUserThemePreference(validated);
      }
    } catch {}

    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);

    if (withLoader) {
      setTargetTheme(validated);
      setIsSwitching(true);

      switchTimerRef.current = setTimeout(() => {
        setThemeState(validated);
      }, 300);

      finishTimerRef.current = setTimeout(() => {
        setIsSwitching(false);
      }, 720);
    } else {
      // Seamless in-place switch: update immediately so hero scene & layers crossfade in view
      setTargetTheme(validated);
      setThemeState(validated);
    }
  };

  const setTheme = (newTheme, options = {}) => {
    const withLoader = typeof options === 'boolean' ? options : !!options?.withLoader;
    initiateThemeSwitch(newTheme, withLoader);
  };

  const cycleTheme = (withLoader = false) => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    initiateThemeSwitch(THEME_ORDER[nextIndex], withLoader);
  };

  const toggleTheme = () => {
    // For backward-compatibility with binary toggle buttons:
    cycleTheme(false);
  };

  const activeThemeConfig = useMemo(() => getThemeConfig(previewThemeId || theme), [theme, previewThemeId]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        targetTheme,
        isSwitching,
        activeThemeConfig,
        themes: THEME_LIST,
        unlockedThemes,
        isThemeUnlocked,
        unlockTheme,
        previewTheme,
        clearPreviewTheme,
        previewThemeId,
        setTheme,
        toggleTheme,
        cycleTheme,
      }}
    >
      {children}
      <ThemeSwitchLoader isSwitching={isSwitching} targetTheme={targetTheme} />
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

export default ThemeContext;
