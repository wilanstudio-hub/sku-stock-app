---
name: mobile-crash-debug
description: Playbook for "app doesn't work / crashes / logs out on iPhone (or Android/iPad)" reports on this project. Covers checking whether production is actually up to date, remote-debugging iOS Safari from a Mac via Web Inspector, and the URL-param bisection technique used to isolate a real WebKit crash to one component. Trigger whenever the user reports the app failing, crashing, "can't open", freezing, or dropping session specifically on a phone/tablet.
---

# Mobile crash / session-drop debugging playbook

Distilled from the 2026-09-02 session that root-caused an iPhone crash-loop. See `ios_crash_debug_2026-09-02.md` in project memory for the full incident writeup — this file is the reusable *process*, not that specific bug.

## 1. Before touching code: is production even current?

Never assume a committed/previously-"fixed" bug is actually live. This project has shipped fixes that sat unrequested in git for two weeks.

```bash
git log --oneline -5
npx wrangler pages deployment list --project-name wilan-stockcheck | head -5
```

Compare the top deployment's commit hash to `HEAD`. If they don't match, that alone may fully explain "the fix didn't work" — deploy first (`npm run deploy`) and ask the user to retest before doing anything else.

Also sanity-check the actual served HTML/bundle against what you expect, since Cloudflare's edge cache can lag a deploy by several seconds:
```bash
curl -s https://wilan-stockcheck.pages.dev/ | grep -E "script|modulepreload"
```

## 2. If it's still broken on a real device: get a live console, not guesses

Chrome desktop and even Chrome-on-Mac browser automation **cannot** reproduce WebKit-only bugs — verify there but don't trust a clean Chrome run to mean iOS is fine. There's no tool available to control Safari or the Mac desktop directly (browser automation tools are Chrome-only); everything below has to be relayed step-by-step to a human with the physical device + a Mac.

Remote-debug iOS Safari from a Mac:
1. On iPhone: **Settings > Safari > Advanced > Web Inspector** (enable it), trust the Mac if prompted.
2. On Mac: **Safari > Settings > Advanced > Show Develop menu**, then **Develop > [device name] > [tab]**.
3. Useful panels: **Console** (JS errors — if truly empty even during a crash, it's a *native* crash, not a catchable JS exception), **Network** (what actually loaded, in what order, before death), **Timelines** (CPU/JS/Network over time — a sustained ~100%+ CPU bar for many seconds = busy-loop/expensive-render; near-zero CPU right up to a crash = more likely a genuine WebKit engine bug or OOM jetsam kill, not app logic).

Caveats learned the hard way:
- Chrome for iOS uses the same WebKit engine as Safari (Apple requires it) — if a bug reproduces in both, it's engine-level, not Safari-UI-specific. Chrome iOS **cannot** be remote-debugged via Safari Web Inspector though, so it only gives you pass/fail.
- A private/incognito tab does not guarantee a logged-out state if storage wasn't actually cleared — check the Network panel for auth/token requests to confirm before trusting a "clean" test.
- The Timelines recorder can itself hang trying to render a huge trace (e.g. from a tight loop) — if so, don't wait it out; pivot to the bisection technique below instead of fighting the Inspector.
- CPU/JS activity signatures can differ between runs of the *same* underlying bug (sometimes pegged, sometimes idle-then-crash). Don't rule a cause out just because one profile didn't show the pattern you expected.

## 3. Bisect with a temporary URL-param override, not more guessing

When Inspector data is inconclusive, add a cheap, reversible diagnostic flag, deploy, and ask for a one-word pass/fail — far more reliable than asking a non-engineer to catch a millisecond-scale timing window.

Pattern used successfully:
```ts
// TEMP diagnostic — remove once root cause is confirmed.
const skipHeavyThing = new URLSearchParams(window.location.search).get("safemode") === "1";
```
or a numeric override (`?maxrows=N`) to shrink a list/loop bound. Test `?param=0` (fully isolate the suspect component/path) before testing intermediate values — going straight to the extreme gives a cleaner signal than guessing a threshold.

**Always remove the diagnostic flags once the real fix lands** — grep for `TEMP diagnostic` before considering the work done.

## 4. Known anti-pattern in this codebase: eager per-item rendering

The actual 2026-09-02 root cause: a component (`QrSheet.tsx`) rendered one expensive thing (a 264×264 canvas QR code) per item in the *full filtered list*, hidden via CSS, regardless of pagination — so even a single visible table row still triggered ~1,500 hidden canvas renders. `display:none`/`.hidden` does **not** skip the render/paint work for canvas or image elements.

Before assuming a mobile-only crash is about "too much data" proportional to what's *visible*, grep for any `.map()` over the full/unfiltered item list (not the paginated slice) feeding a canvas, image, or otherwise expensive child — especially anything justified as "pre-rendered so a ref is ready later" (print sheets, hidden QR/barcode generators, off-screen canvases). Fix by rendering that item's worth of work only when actually needed (on demand, e.g. at print time), driven by local state rather than an eagerly-passed full list.
