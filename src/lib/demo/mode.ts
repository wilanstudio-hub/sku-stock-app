const DEMO_KEY = "ctrl_inventory_demo";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      sessionStorage.setItem(DEMO_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}
