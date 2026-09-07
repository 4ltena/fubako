import { describe, expect, it } from "vitest";
import {
  DEFAULT_READING_PREFERENCES,
  parseReadingPreferences,
  READING_PREFERENCES_KEY,
  saveReadingPreferences,
  type ReadingPreferenceStore,
} from "./reading-preferences";

describe("読みやすさ設定", () => {
  it("端末内の設定を安全に読み込む", () => {
    expect(parseReadingPreferences('{"fontSize":"large","paperEffects":false}')).toEqual({ fontSize: "large", paperEffects: false });
    expect(parseReadingPreferences('{"fontSize":"unknown"}')).toEqual(DEFAULT_READING_PREFERENCES);
    expect(parseReadingPreferences("壊れている")).toEqual(DEFAULT_READING_PREFERENCES);
  });

  it("名前空間のある鍵だけへ保存する", () => {
    const values: Record<string, string> = {};
    const store: ReadingPreferenceStore = { getItem: (key) => values[key] ?? null, setItem: (key, value) => { values[key] = value; } };
    expect(saveReadingPreferences(store, { fontSize: "large", paperEffects: false })).toBe(true);
    expect(parseReadingPreferences(values[READING_PREFERENCES_KEY])).toEqual({ fontSize: "large", paperEffects: false });
    expect(Object.keys(values)).toEqual([READING_PREFERENCES_KEY]);
  });

  it("別の画面は別の端末内鍵を選べる", () => {
    const values: Record<string, string> = {};
    const store: ReadingPreferenceStore = { getItem: (key) => values[key] ?? null, setItem: (key, value) => { values[key] = value; } };
    saveReadingPreferences(store, { fontSize: "large", paperEffects: true }, "fubako.ui-preview.reading-preferences.v1");
    expect(values[READING_PREFERENCES_KEY]).toBeUndefined();
    expect(parseReadingPreferences(values["fubako.ui-preview.reading-preferences.v1"])).toEqual({ fontSize: "large", paperEffects: true });
  });

  it("保存できない端末でも例外にしない", () => {
    const blocked: ReadingPreferenceStore = { getItem: () => null, setItem: () => { throw new Error("denied"); } };
    expect(saveReadingPreferences(null, DEFAULT_READING_PREFERENCES)).toBe(false);
    expect(saveReadingPreferences(blocked, DEFAULT_READING_PREFERENCES)).toBe(false);
  });
});
