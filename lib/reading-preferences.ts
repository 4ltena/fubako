export const READING_PREFERENCES_KEY = "fubako.reading-preferences.v1";

export type ReadingFontSize = "standard" | "large";
export type ReadingPreferences = {
  fontSize: ReadingFontSize;
  paperEffects: boolean;
};

export type ReadingPreferenceStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  fontSize: "standard",
  paperEffects: true,
};

/** 壊れた端末内設定は既定値に戻す。投稿やアカウントの情報はここへ保存しない。 */
export function parseReadingPreferences(raw: string | null): ReadingPreferences {
  if (!raw) return { ...DEFAULT_READING_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Partial<ReadingPreferences>;
    return {
      fontSize: value.fontSize === "large" ? "large" : "standard",
      paperEffects: typeof value.paperEffects === "boolean" ? value.paperEffects : true,
    };
  } catch {
    return { ...DEFAULT_READING_PREFERENCES };
  }
}

export function serializeReadingPreferences(preferences: ReadingPreferences): string {
  return JSON.stringify(preferences);
}

/** private browsing などで失敗しても画面の設定変更は続けられる。 */
export function saveReadingPreferences(store: ReadingPreferenceStore | null, preferences: ReadingPreferences, key = READING_PREFERENCES_KEY): boolean {
  if (!store) return false;
  try {
    store.setItem(key, serializeReadingPreferences(preferences));
    return true;
  } catch {
    return false;
  }
}
