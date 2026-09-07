export interface Preferences {
  pace: 'relaxed' | 'regular' | 'quick';
  largeCards: boolean;
  reducedMotion: boolean;
  coaching: boolean;
}
// 'regular' (1.3s per computer move) keeps a 4-player rotation under 4s;
// 'relaxed' is one tap away in Comfort settings for players who want more time.
export const DEFAULT_PREFERENCES: Preferences = {
  pace: 'regular', largeCards: true, reducedMotion: false, coaching: true,
};
export function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem('swipe-comfort-v1') || '{}');
    return {
      pace: ['relaxed', 'regular', 'quick'].includes(value.pace) ? value.pace : DEFAULT_PREFERENCES.pace,
      largeCards: value.largeCards !== false,
      reducedMotion: value.reducedMotion === true,
      coaching: value.coaching !== false,
    };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}
export function savePreferences(value: Preferences) {
  try { localStorage.setItem('swipe-comfort-v1', JSON.stringify(value)); } catch { /* Playing still works without storage. */ }
}
