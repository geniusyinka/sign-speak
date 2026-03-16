import type { UserSettings } from '../types/index.ts';

const SETTINGS_KEY = 'signspeak_settings';

const DEFAULT_SETTINGS: UserSettings = {
  voiceId: 'en-US-Neural2-F',
  voiceName: 'Emma',
  textSize: 'large',
  highContrast: false,
  showHistory: true,
  autoHideCamera: false,
  handsDownSegmentation: true,
};

export function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function getDefaultSettings(): UserSettings {
  return { ...DEFAULT_SETTINGS };
}
