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
    const key = "dbg_crash";
    const prev = localStorage.getItem(key) ?? "";
    localStorage.setItem(key, `${prev}[${TS()}] ${entry}\n`);
  } catch { /* storage full / private mode — silently ignore */ }
}

// Prove this code ran at all — written once at startup, separate from crash log
try {
  localStorage.setItem("dbg_started", `${new Date().toISOString()} | ${location.href}`);
} catch { /* ignore */ }

// ── Intercept location.href setter ───────────────────────────────────────────
// Most navigations in web apps go through this setter, not assign/replace.
try {
  const locProto = Object.getPrototypeOf(location);
  const hrefDesc = Object.getOwnPropertyDescriptor(locProto, "href");
  if (hrefDesc?.set) {
    const origSet = hrefDesc.set;
    Object.defineProperty(location, "href", {
      get: hrefDesc.get ? hrefDesc.get.bind(location) : () => location.toString(),
      set(url: string) {
        dbgWrite(`[DBG-href] location.href = "${url}"\n${new Error().stack ?? ""}`);
        origSet.call(location, url);
      },
      configurable: true,
    });
  }
} catch (e) {
  dbgWrite(`[DBG-init] could not intercept href setter: ${e}`);
}

// ── Intercept location.assign / replace / reload ──────────────────────────────
const _assign  = location.assign.bind(location);
const _replace = location.replace.bind(location);
const _reload  = location.reload.bind(location);
try { (location as any).assign  = (url: string) => { dbgWrite(`[DBG-nav] assign(${url})\n${new Error().stack ?? ""}`);  _assign(url); }; } catch { /* read-only in some envs */ }
try { (location as any).replace = (url: string) => { dbgWrite(`[DBG-nav] replace(${url})\n${new Error().stack ?? ""}`); _replace(url); }; } catch { /* read-only */ }
try { (location as any).reload  = ()            => { dbgWrite(`[DBG-nav] reload()\n${new Error().stack ?? ""}`);         _reload(); };  } catch { /* read-only */ }

// ── Intercept window.open ─────────────────────────────────────────────────────
const _open = window.open.bind(window);
window.open = (...args: Parameters<typeof window.open>) => {
  dbgWrite(`[DBG-nav] window.open(${args[0]})`);
  return _open(...args);
};

// ── Unhandled JS errors / rejections ─────────────────────────────────────────
window.onerror = (msg, src, line, col, err) => {
  dbgWrite(`[DBG-err] ${msg} @ ${src}:${line}:${col}\n${err?.stack ?? ""}`);
  return false;
};
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason instanceof Error ? e.reason.stack ?? e.reason.message : String(e.reason);
  dbgWrite(`[DBG-rej] ${r}`);
});

// ── Page lifecycle events ─────────────────────────────────────────────────────
// beforeunload is unreliable on iOS WKWebView — pagehide is more reliable.
window.addEventListener("beforeunload", () => dbgWrite("[DBG-bye] beforeunload"));
window.addEventListener("pagehide",     (e) => dbgWrite(`[DBG-bye] pagehide persisted=${e.persisted}`));
window.addEventListener("pageshow",     (e) => dbgWrite(`[DBG-show] pageshow persisted=${e.persisted}`));

// ── Visibility / focus tracking ───────────────────────────────────────────────
document.addEventListener("visibilitychange", () =>
  dbgWrite(`[DBG-vis] visibility → ${document.visibilityState}`)
);
window.addEventListener("blur",  () => dbgWrite("[DBG-focus] window blur"));
window.addEventListener("focus", () => dbgWrite("[DBG-focus] window focus"));

// ── Heartbeat — write every 5 s so we can see how far execution got ───────────
let _hbCount = 0;
const _hbTimer = setInterval(() => {
  dbgWrite(`[DBG-hb] heartbeat #${++_hbCount}`);
  if (_hbCount >= 60) clearInterval(_hbTimer); // auto-stop after 5 min
}, 5000);

// ── Startup: surface any previous crash data ──────────────────────────────────
(function showPreviousCrashLog() {
  const log     = localStorage.getItem("dbg_crash");
  const started = localStorage.getItem("dbg_started");
  if (!log && !started) return;

  localStorage.removeItem("dbg_crash");
  localStorage.removeItem("dbg_started");

  const startLine = started ? `dbg_started: ${started}\n\n` : "";
  const body      = log ?? "(no crash log written)";
  const trimmed   = body.length > 4000 ? "…" + body.slice(-4000) : body;

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed;inset:0;z-index:99999",
    "background:#0a000acc;backdrop-filter:blur(6px)",
    "padding:16px;overflow:auto;font:11px/1.6 monospace",
    "color:#ff9090;white-space:pre-wrap;word-break:break-all",
  ].join(";");
  overlay.textContent = "=== CRASH LOG — tap to dismiss ===\n\n" + startLine + trimmed;
  overlay.onclick = () => overlay.remove();

  // Wait for body to exist before appending
  if (document.body) {
    document.body.appendChild(overlay);
  } else {
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(overlay));
  }
})();

// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
