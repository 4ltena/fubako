import { createRoot } from "react-dom/client";
import App from "./App";
import { ReadingPreferencesProvider } from "@/components/ReadingPreferences";
import { getPreviewState, navigate, previewFetch } from "./store";
import "../app/globals.css";
import "./preview.css";

// この静的文書の通信とフォームだけを、架空データへの操作に置き換える。
// 通常のアプリにはこのエントリーを読み込まない。CSPもHTTP APIへの通信を禁止する。
window.fetch = previewFetch;
document.addEventListener("submit", (event) => {
  if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
  const form = event.target;
  event.preventDefault();
  const action = new URL(form.getAttribute("action") ?? getPreviewState().path, location.origin);
  const body = new FormData(form);
  if (action.pathname.startsWith("/api/")) {
    void previewFetch(action.pathname + action.search, { method: form.method.toUpperCase(), body }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json();
        window.alert(typeof result.error === "string" ? result.error : "操作できませんでした。");
      }
    });
  } else if (action.pathname === "/archive") {
    navigate(`/archive?${new URLSearchParams([...body.entries()].map(([key, value]) => [key, String(value)]))}`);
  }
});

window.addEventListener("hashchange", () => {
  const path = location.hash.slice(1);
  if (path.startsWith("/") && path !== getPreviewState().path) navigate(path);
});
if (location.hash.startsWith("#/")) navigate(location.hash.slice(1));
createRoot(document.getElementById("root")!).render(<ReadingPreferencesProvider storageKey="ui-preview:reading-preferences:v1"><App /></ReadingPreferencesProvider>);
