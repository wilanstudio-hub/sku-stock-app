import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Chrome iOS crash instrumentation ─────────────────────────────────────────
// Intercepts all navigation calls and uncaught errors so we can identify what
// causes "Can't open this page" on Chrome iOS. Data persists across the reload
// in localStorage under "dbg_crash". Remove after root cause is found.

const TS = () => new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm

function dbgWrite(entry: string) {
  try {
    const prev = localStorage.getItem("dbg_crash") ?? "";
    localStorage.setItem("dbg_crash", `${prev}[${TS()}] ${entry}\n`);
  } catch { /* storage full / private mode */ }
}

// Intercept location navigation methods
const _assign  = location.assign.bind(location);
const _replace = location.replace.bind(location);
const _reload  = location.reload.bind(location);

(location as Location & { assign: typeof location.assign }).assign = (url: string | URL) => {
  dbgWrite(`[DBG-nav] location.assign(${url})\n${new Error().stack ?? ""}`);
  _assign(url);
};
(location as Location & { replace: typeof location.replace }).replace = (url: string | URL) => {
  dbgWrite(`[DBG-nav] location.replace(${url})\n${new Error().stack ?? ""}`);
  _replace(url);
};
(location as Location & { reload: typeof location.reload }).reload = () => {
  dbgWrite(`[DBG-nav] location.reload()\n${new Error().stack ?? ""}`);
  _reload();
};

// Intercept window.open
const _open = window.open.bind(window);
window.open = (...args) => {
  dbgWrite(`[DBG-nav] window.open(${args[0]})`);
  return _open(...args);
};

// Unhandled JS errors
window.onerror = (msg, src, line, col, err) => {
  dbgWrite(`[DBG-err] ${msg} @ ${src}:${line}:${col}\n${err?.stack ?? ""}`);
  return false; // don't suppress default handler
};
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason instanceof Error ? e.reason.stack ?? e.reason.message : String(e.reason);
  dbgWrite(`[DBG-rej] ${reason}`);
});

// Page-is-leaving signal (fires before unload/reload)
window.addEventListener("beforeunload", () => {
  dbgWrite("[DBG-bye] beforeunload fired — page is navigating away");
});

// Visibility tracking — captures tab hide/show cycles (Supabase trigger)
document.addEventListener("visibilitychange", () => {
  dbgWrite(`[DBG-vis] visibility → ${document.visibilityState}`);
});

// ── Startup: surface any previous crash data ──────────────────────────────────
// Show the log in a red overlay so a tester can screenshot it on the next load.
(function showPreviousCrashLog() {
  const log = localStorage.getItem("dbg_crash");
  if (!log) return;

  // Keep at most the last 3000 chars so the overlay stays readable.
  const trimmed = log.length > 3000 ? "…" + log.slice(-3000) : log;
  localStorage.removeItem("dbg_crash"); // clear so next load starts fresh

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed;inset:0;z-index:99999",
    "background:#1a0000cc;backdrop-filter:blur(4px)",
    "padding:16px;overflow:auto;font:12px/1.5 monospace",
    "color:#ff9090;white-space:pre-wrap;word-break:break-all",
  ].join(";");
  overlay.textContent = "=== CRASH LOG (tap to dismiss) ===\n\n" + trimmed;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
})();

// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
