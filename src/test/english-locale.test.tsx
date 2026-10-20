import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import App from "@/App";
import { translations } from "@/lib/i18n";
import { DEMO_DEPARTMENTS, DEMO_ZONES, demoSkus, demoTransactions, resetDemoRuntime } from "@/lib/demo/catalog";
import { writePrintDocument } from "@/components/QrSheet";
import type { Sku } from "@/components/SkuDialog";
import type { Lang } from "@/lib/i18n";
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

function labelHtml(items: Sku[], lang: Lang) {
  let html = "";
  const w = { document: { write: (chunk: string) => { html += chunk; } } } as unknown as Window;
  writePrintDocument(w, items, new Map(), lang);
  return html;
}

function field(label: string) {
  const el = screen.getByText((_content, node) => {
    if (!node || node.tagName !== "LABEL") return false;
    return (node.textContent ?? "").trim().startsWith(label);
  });
  const input = el.parentElement?.querySelector("input, textarea");
  if (!input) throw new Error(`no field for ${label}`);
  return input as HTMLInputElement;
}

describe("English locale has no Thai characters", () => {
  afterEach(() => {
    cleanup();
    resetDemoRuntime();
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
      ...demoSkus("en").flatMap((s) => [s.name_th, s.name_en, displayItemName(s, "en"), displayItemSubtitle(s, "en"), s.category, s.location, s.unit, s.notes_th, s.notes_en, s.last_handler]),
      ...demoTransactions("en").map((tx) => tx.person_name),
      ...DEMO_ZONES.map((z) => displayZoneName(z, "en")),
      ...DEMO_DEPARTMENTS.map((d) => displayDeptName(d, "en")),
    ].filter(Boolean).join("\n");
    expect(blob).not.toMatch(THAI);
    expect(demoSkus("en").every((s) => s.name_th === s.name_en)).toBe(true);
    expect(demoSkus("th").some((s) => THAI.test(s.name_th))).toBe(true);
  });

  it("prints only the display name on English QR labels", () => {
    const code = "WD-CST-NAV-004";
    const en = demoSkus("en").find((s) => s.sku_code === code)!;
    const th = demoSkus("th").find((s) => s.sku_code === code)!;
    const htmlEn = labelHtml([en], "en");
    const htmlTh = labelHtml([th], "th");
    expect(htmlEn).toContain("Navy suit");
    expect(htmlEn.match(/Navy suit/g)).toHaveLength(1);
    expect(htmlEn).not.toMatch(THAI);
    expect(htmlTh).toContain("Navy suit");
    expect(htmlTh).toMatch(THAI);
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

  it("keeps the edit dialog, QR preview, new item, and sync in English", async () => {
    localStorage.setItem("lang", "en");
    sessionStorage.setItem("ctrl_inventory_demo", "1");
    window.history.pushState({}, "", "/?demo=1&lang=en");
    render(<App />);

    expect(await screen.findByText("Pressure kerosene lantern")).toBeTruthy();
    const lanternRow = screen.getByText("ART-LIG-SIL-RUS-001").closest("tr")!;
    const lanternButtons = [...lanternRow.querySelectorAll("button")];
    const edit = lanternButtons[lanternButtons.findIndex((b) => b.getAttribute("title") === "QR Code") + 1];
    fireEvent.click(edit);

    expect(await screen.findByText(/Edit SKU/)).toBeTruthy();
    const thaiName = field("Name (Thai)");
    expect(thaiName.value).toBe("Pressure kerosene lantern");
    expect(field("Name (English)").value).toBe("Pressure kerosene lantern");
    await waitFor(() => {
      expect(screen.getByRole("dialog").textContent ?? "").toContain("Lighting");
    });
    expect(screen.getByRole("dialog").textContent ?? "").not.toMatch(THAI);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getAllByText("WD")[0]);
    expect(await screen.findByText("Navy suit")).toBeTruthy();
    const suitRow = screen.getByText("WD-CST-NAV-004").closest("tr")!;
    fireEvent.click(suitRow.querySelector('[title="QR Code"]')!);
    const qr = await screen.findByRole("dialog");
    expect(qr.textContent ?? "").toContain("Navy suit");
    expect(qr.textContent?.match(/Navy suit/g)).toHaveLength(1);
    expect(qr.textContent ?? "").not.toMatch(THAI);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getAllByText("Art")[0]);
    expect(await screen.findByText("Pressure kerosene lantern")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sync Sheets" }));
    expect(await screen.findByText("Sync complete: 0 new, 2 updated")).toBeTruthy();
    expect(await screen.findByText("Last sync")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add SKU/ }));
    const addDialog = await screen.findByRole("dialog");
    expect(addDialog.textContent ?? "").toContain("Add SKU");
    expect(addDialog.textContent ?? "").not.toMatch(THAI);
    const category = addDialog.querySelector('[role="combobox"]') as HTMLElement;
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    fireEvent.pointerDown(category, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(category);
    expect(await screen.findByRole("option", { name: "Lighting" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Props" })).toBeTruthy();
    fireEvent.keyDown(category, { key: "Escape" });
    fireEvent.change(field("SKU Code"), { target: { value: "ART-DEMO-001" } });
    fireEvent.change(field("Name (Thai)"), { target: { value: "Demo lantern" } });
    fireEvent.change(field("Name (English)"), { target: { value: "Demo lantern" } });
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => "blob:demo-preview";
    const fileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    const file = new File(["preview"], "lamp.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText("Uploaded 1 image")).toBeTruthy();
    expect(screen.queryByText("Please sign in to upload")).toBeNull();
    URL.createObjectURL = createObjectURL;

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("ART-DEMO-001")).toBeTruthy();
    const search = screen.getByPlaceholderText(/Search SKU/);
    fireEvent.change(search, { target: { value: "Demo lantern" } });
    expect(await screen.findByText("ART-DEMO-001")).toBeTruthy();
    expect(screen.queryByText("ART-PRP-CLK-008")).toBeNull();
    const addedRow = screen.getByText("ART-DEMO-001").closest("tr")!;
    fireEvent.click(addedRow.querySelector('[title="QR Code"]')!);
    const addedQr = await screen.findByRole("dialog");
    expect(addedQr.textContent ?? "").toContain("Demo lantern");
    expect(addedQr.textContent ?? "").not.toMatch(THAI);
    expect(document.body.textContent ?? "").not.toMatch(THAI);
  });
});
