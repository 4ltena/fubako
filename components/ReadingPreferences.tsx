"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_READING_PREFERENCES,
  parseReadingPreferences,
  READING_PREFERENCES_KEY,
  saveReadingPreferences,
  type ReadingFontSize,
  type ReadingPreferences as Preferences,
} from "@/lib/reading-preferences";

type ReadingContextValue = {
  preferences: Preferences;
  storageAvailable: boolean | null;
  setFontSize: (fontSize: ReadingFontSize) => void;
  setPaperEffects: (paperEffects: boolean) => void;
};

const fallbackContext: ReadingContextValue = {
  preferences: DEFAULT_READING_PREFERENCES,
  storageAvailable: null,
  setFontSize: () => {},
  setPaperEffects: () => {},
};
const ReadingPreferencesContext = createContext<ReadingContextValue>(fallbackContext);

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function ReadingPreferencesProvider({ children, storageKey = READING_PREFERENCES_KEY }: { children: ReactNode; storageKey?: string }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_READING_PREFERENCES);
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storage = browserStorage();
      if (!storage) {
        setStorageAvailable(false);
        return;
      }
      try {
        setPreferences(parseReadingPreferences(storage.getItem(storageKey)));
        setStorageAvailable(true);
      } catch {
        setStorageAvailable(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const update = useCallback((next: Preferences) => {
    setPreferences(next);
    setStorageAvailable(saveReadingPreferences(browserStorage(), next, storageKey));
  }, [storageKey]);
  const value = useMemo<ReadingContextValue>(() => ({
    preferences,
    storageAvailable,
    setFontSize: (fontSize) => update({ ...preferences, fontSize }),
    setPaperEffects: (paperEffects) => update({ ...preferences, paperEffects }),
  }), [preferences, storageAvailable, update]);

  return <ReadingPreferencesContext.Provider value={value}><div className="reading-preferences" data-reading-font={preferences.fontSize}>{children}</div></ReadingPreferencesContext.Provider>;
}

export function useReadingPreferences(): ReadingContextValue {
  return useContext(ReadingPreferencesContext);
}

export function ReadingPreferences() {
  const { preferences, storageAvailable, setFontSize, setPaperEffects } = useReadingPreferences();
  return (
    <section aria-labelledby="reading-preferences-title" className="space-y-5">
      <header className="border-b border-line pb-4">
        <h1 id="reading-preferences-title" className="text-[20px] font-bold">読みやすさ</h1>
        <p className="mt-3 text-sm leading-[2.1] text-ink-dim">文字の大きさと、紙の模様・色褪せをこの端末だけで整えられます。</p>
      </header>
      <fieldset className="border-b border-line pb-5">
        <legend className="label text-[12px] text-ink-dim">文字の大きさ</legend>
        <div className="mt-3 flex gap-2">
          {(["standard", "large"] as const).map((size) => (
            <button key={size} type="button" aria-pressed={preferences.fontSize === size} onClick={() => setFontSize(size)} className={`label min-h-11 rounded-full border px-4 text-[12px] ${preferences.fontSize === size ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}>
              {size === "standard" ? "標準" : "大きめ"}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="border-b border-line pb-5">
        <legend className="label text-[12px] text-ink-dim">紙の模様・色褪せ</legend>
        <div className="mt-3 flex gap-2">
          {[true, false].map((enabled) => (
            <button key={String(enabled)} type="button" aria-pressed={preferences.paperEffects === enabled} onClick={() => setPaperEffects(enabled)} className={`label min-h-11 rounded-full border px-4 text-[12px] ${preferences.paperEffects === enabled ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}>
              {enabled ? "表示する" : "表示しない"}
            </button>
          ))}
        </div>
      </fieldset>
      {storageAvailable === false && <p role="status" className="label text-[12px] leading-[1.8] text-ink-dim">この端末では設定を保存できません。今開いている間は変更を使えます。</p>}
    </section>
  );
}
