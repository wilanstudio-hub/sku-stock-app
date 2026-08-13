import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Crash instrumentation ─────────────────────────────────────────────────────
// Writes to BOTH console (visible in Safari Web Inspector) AND localStorage
// (survives across the crash to show as an overlay on next load).

const TS = () => new Date().toISOString().slice(11, 23);

function dbg(entry: string) {
  console.log(`[DBG] ${entry}`);                                    // Web Inspector
  try {
    const prev = localStorage.getItem("dbg_crash") ?? "";
    localStorage.setItem("dbg_crash", `${prev}[${TS()}] ${entry}\n`);
  } catch { /* private mode / storage full */ }
}

dbg(`STARTUP — ${location.href}`);                                  // ← first thing

// Errors
window.onerror = (msg, src, line, col, err) => {
  dbg(`ERROR: ${msg} @ ${src}:${line}:${col}\n${err?.stack ?? ""}`);
  return false;
};
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason instanceof Error ? e.reason.stack ?? e.reason.message : String(e.reason);
  dbg(`UNHANDLED REJECTION: ${r}`);
});

// Navigation
try { (location as any).assign  = (u: string) => { dbg(`location.assign(${u})`);  location.assign(u); };  } catch { /* read-only */ }
try { (location as any).replace = (u: string) => { dbg(`location.replace(${u})`); location.replace(u); }; } catch { /* read-only */ }
try { (location as any).reload  = ()          => { dbg("location.reload()");       location.reload(); };   } catch { /* read-only */ }

// Lifecycle
window.addEventListener("pagehide",        (e) => dbg(`pagehide persisted=${e.persisted}`));
window.addEventListener("beforeunload",    ()  => dbg("beforeunload"));
document.addEventListener("visibilitychange", () => dbg(`visibility → ${document.visibilityState}`));

// Heartbeat — every 5 s
let _n = 0;
const _t = setInterval(() => { dbg(`heartbeat #${++_n}`); if (_n >= 60) clearInterval(_t); }, 5000);

// Show previous crash log as overlay
(function showLog() {
  const log = localStorage.getItem("dbg_crash");
  if (!log) return;
  localStorage.removeItem("dbg_crash");
  const trimmed = log.length > 4000 ? "…" + log.slice(-4000) : log;
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0a000acc;padding:16px;overflow:auto;font:11px/1.6 monospace;color:#ff9090;white-space:pre-wrap;word-break:break-all";
  el.textContent = "=== CRASH LOG — tap to dismiss ===\n\n" + trimmed;
  el.onclick = () => el.remove();
  (document.body ?? document.documentElement).appendChild(el);
})();

// ─────────────────────────────────────────────────────────────────────────────

dbg("calling createRoot…");
createRoot(document.getElementById("root")!).render(<App />);
dbg("createRoot rendered");
