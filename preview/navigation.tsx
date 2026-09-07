import { useSyncExternalStore } from "react";
import { getPreviewState, navigate, refresh, subscribePreview } from "./store";

function previewPath() { return getPreviewState().path; }

/** Vite の表示確認だけで使う next/navigation 互換層。経路はサンプル状態にだけ保持する。 */
export function useRouter() {
  return {
    push: navigate,
    replace: navigate,
    back: () => {
      if (typeof window !== "undefined") window.history.back();
    },
    refresh,
    prefetch: async (path: string) => { void path; },
  };
}

export function usePathname() {
  return useSyncExternalStore(subscribePreview, previewPath, () => "/c/preview-room").split("?")[0];
}

export function useSearchParams() {
  const path = useSyncExternalStore(subscribePreview, previewPath, () => "/c/preview-room");
  return new URLSearchParams(path.split("?")[1] ?? "");
}

export function previewNavigate(path: string) {
  navigate(path);
}
