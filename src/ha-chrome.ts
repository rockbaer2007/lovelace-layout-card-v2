import { DashboardLayoutChromeConfig } from "./types";

type StoredStyle = {
  display: string;
  visibility: string;
  width: string;
  minWidth: string;
};

const hiddenElements = new Map<HTMLElement, StoredStyle>();
let requestedHidden = false;
let observerStarted = false;

function normalizedList(value?: string | string[]) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function collectElementsDeep(root: Document | ShadowRoot | Element, selector: string, result: HTMLElement[] = []) {
  if (root instanceof HTMLElement && root.matches(selector)) {
    result.push(root);
  }
  if ("querySelectorAll" in root) {
    result.push(...Array.from(root.querySelectorAll(selector)).filter((element): element is HTMLElement => element instanceof HTMLElement));
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if ((element as HTMLElement).shadowRoot) {
        collectElementsDeep((element as HTMLElement).shadowRoot!, selector, result);
      }
    }
  }
  return result;
}

function currentUserMaySeeHaChrome(hass: any, chrome?: DashboardLayoutChromeConfig) {
  const user = hass?.user;
  if (!chrome?.hide_ha_chrome) return true;
  if (!user) return true;
  if (chrome.admin_always_visible !== false && user?.is_admin) return true;

  const allowedUsers = normalizedList(chrome.visible_users);
  if (!allowedUsers.length) return false;

  const userValues = [user?.id, user?.name, user?.username]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  return userValues.some((value) => allowedUsers.includes(value));
}

function setHidden(element: HTMLElement) {
  if (!hiddenElements.has(element)) {
    hiddenElements.set(element, {
      display: element.style.display,
      visibility: element.style.visibility,
      width: element.style.width,
      minWidth: element.style.minWidth,
    });
  }
  element.style.display = "none";
  element.style.visibility = "hidden";
  element.style.width = "0";
  element.style.minWidth = "0";
}

function restoreHiddenElements() {
  for (const [element, style] of hiddenElements.entries()) {
    element.style.display = style.display;
    element.style.visibility = style.visibility;
    element.style.width = style.width;
    element.style.minWidth = style.minWidth;
  }
  hiddenElements.clear();
}

function hideHaChromeNow() {
  const selectors = [
    "ha-sidebar",
    "app-drawer",
    "app-header",
    "app-toolbar",
    "ha-menu-button",
  ].join(",");
  for (const element of collectElementsDeep(document, selectors)) {
    setHidden(element);
  }
}

function ensureObserver() {
  if (observerStarted) return;
  observerStarted = true;
  new MutationObserver(() => {
    if (requestedHidden) hideHaChromeNow();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

export function applyHaChromeVisibility(hass: any, chrome?: DashboardLayoutChromeConfig) {
  ensureObserver();
  requestedHidden = !currentUserMaySeeHaChrome(hass, chrome);
  if (!requestedHidden) {
    restoreHiddenElements();
    return;
  }
  hideHaChromeNow();
}
