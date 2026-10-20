import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import App from "@/App";
import { translations } from "@/lib/i18n";
import { DEMO_DEPARTMENTS, DEMO_ZONES, demoSkus, demoTransactions } from "@/lib/demo/catalog";
import { displayDeptName, displayItemName, displayItemSubtitle, displayZoneName } from "@/lib/uiText";

const THAI = /[\u0E00-\u0E7F]/;

function collectStrings(value: unknown, out: string[], seen = new Set<unknown>()) {
  if (value == null || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (typeof value === "function") {
    const attempts = [
      ["Sample", 2, 3, 4],
      [1, 2, 3, 4],
      ["Art"],
    ];
    for (const args of attempts) {
      try {
        collectStrings((value as (...args: unknown[]) => unknown)(...args), out, seen);
        return;
      } catch {
        /* try the next sample */
      }
    }
    return;
  }
  if (typeof value === "object") {
    if (seen.has(value)) return;
    seen.add(value);
    for (const child of Object.values(value)) collectStrings(child, out, seen);
  }
}

function walkSource(dir: string, hits: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSource(full, hits);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const rel = path.relative(path.resolve(__dirname, ".."), full).split(path.sep).join("/");
    if (
      rel === "lib/i18n.ts" ||
      rel === "lib/i18nMessages.ts" ||
      rel === "lib/uiText.ts" ||
      rel === "lib/demo/catalog.ts"
    ) {
      continue;
    }
    const text = fs.readFileSync(full, "utf8");
    if (THAI.test(text)) hits.push(rel);
  }
}

describe("English locale has no Thai characters", () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
  });

  it("keeps every English catalog string free of Thai", () => {
    const strings: string[] = [];
    collectStrings(translations.en, strings);
    const bad = strings.filter((s) => THAI.test(s));
    expect(bad).toEqual([]);
  });

  it("projects English demo data without Thai", () => {
    const blob = [
      ...demoSkus("en").flatMap((s) => [displayItemName(s, "en"), displayItemSubtitle(s, "en"), s.category, s.location, s.unit, s.notes_th, s.last_handler]),
      ...demoTransactions("en").map((tx) => tx.person_name),
      ...DEMO_ZONES.map((z) => displayZoneName(z, "en")),
      ...DEMO_DEPARTMENTS.map((d) => displayDeptName(d, "en")),
    ].filter(Boolean).join("\n");
    expect(blob).not.toMatch(THAI);
  });

  it("allows Thai source text only in the locale catalogs and demo fixture", () => {
    const hits: string[] = [];
    walkSource(path.resolve(__dirname, ".."), hits);
    expect(hits).toEqual([]);
  });

  it("renders the demo inventory and scan screens in English", async () => {
    localStorage.setItem("lang", "en");
    sessionStorage.setItem("ctrl_inventory_demo", "1");
    window.history.pushState({}, "", "/?demo=1&lang=en");

    render(<App />);

    expect(await screen.findByText("Pressure kerosene lantern")).toBeTruthy();
    expect(screen.getAllByText("Art").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Check out/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByTitle("Check-out history")[0]);
    expect(await screen.findByText("Check-out history (studio)")).toBeTruthy();
    expect(screen.getAllByText("Alex (Camera)").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByTitle("Storage zone photos")[0]);
    expect(await screen.findByText(/Shelving unit 1/)).toBeTruthy();
    expect(document.body.textContent ?? "").not.toMatch(THAI);

    cleanup();
    window.history.pushState({}, "", "/scan?sku=ART-LIG-SIL-RUS-001&demo=1&lang=en");
    render(<App />);

    expect(await screen.findByText("ART-LIG-SIL-RUS-001")).toBeTruthy();
    expect(screen.getByText("Pressure kerosene lantern")).toBeTruthy();
    expect(screen.getByText("Mind (Wardrobe)")).toBeTruthy();
    await waitFor(() => {
      expect(document.body.textContent ?? "").not.toMatch(THAI);
    });
  });
});
