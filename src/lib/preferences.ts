export interface Preferences {
  pace: 'relaxed' | 'regular' | 'quick';
  largeCards: boolean;
  reducedMotion: boolean;
  coaching: boolean;
}
export const DEFAULT_PREFERENCES: Preferences = {
  pace: 'relaxed', largeCards: true, reducedMotion: false, coaching: true,
};
export function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem('swipe-comfort-v1') || '{}');
    return {
      pace: ['relaxed', 'regular', 'quick'].includes(value.pace) ? value.pace : 'relaxed',
      largeCards: value.largeCards !== false,
      reducedMotion: value.reducedMotion === true,
      coaching: value.coaching !== false,
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}
export function savePreferences(value: Preferences) {
  try { localStorage.setItem('swipe-comfort-v1', JSON.stringify(value)); } catch { /* Playing still works without storage. */ }
}
