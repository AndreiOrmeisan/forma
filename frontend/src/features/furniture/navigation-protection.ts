import { withinProjectWorkspace } from "./unsaved-project";

export type PendingNavigation = { href: string; resume: () => void };
export const historyPositionKey = "__formaDraftPosition";

function position(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[historyPositionKey];
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

/** Guards DOM navigation before Next's handlers. Keeps all existing router state. */
export function protectProjectNavigation(
  browser: Window,
  callbacks: {
    dirty: () => boolean;
    saving: () => boolean;
    request: (navigation: PendingNavigation) => void;
    leave: () => void;
    navigate: (href: string) => void;
  },
) {
  const history = browser.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  let currentPosition = position(history.state) ?? 0;
  let currentHref = browser.location.href;
  let currentState: unknown = history.state;
  let bypass = false;
  let restoring: { navigation: PendingNavigation; index: number } | null = null;

  const stamp = (state: unknown, index: number) => ({
    ...(state && typeof state === "object" ? state : {}),
    [historyPositionKey]: index,
  });
  originalReplace.call(history, stamp(history.state, currentPosition), "");
  currentState = history.state;

  const push: History["pushState"] = function (state: unknown, title, url) {
    const nextPosition = currentPosition + 1;
    originalPush.call(history, stamp(state, nextPosition), title, url);
    currentPosition = nextPosition;
    currentHref = browser.location.href;
    currentState = history.state;
    bypass = false;
  };
  const replace: History["replaceState"] = function (state: unknown, title, url) {
    originalReplace.call(history, stamp(state, currentPosition), title, url);
    currentHref = browser.location.href;
    currentState = history.state;
    bypass = false;
  };
  history.pushState = push;
  history.replaceState = replace;

  function leave(resume: () => void) {
    bypass = true;
    callbacks.leave();
    resume();
  }

  function click(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const href = new URL(anchor.href, browser.location.href);
    if (!["http:", "https:"].includes(href.protocol) || withinProjectWorkspace(currentHref, href.href)) return;
    if (restoring || callbacks.saving()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!callbacks.dirty()) {
      callbacks.leave();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    callbacks.request({ href: href.href, resume: () => leave(() => callbacks.navigate(href.href)) });
  }

  function pop(event: PopStateEvent) {
    const targetHref = browser.location.href;
    const targetPosition = position(event.state);
    if (restoring) {
      event.stopImmediatePropagation();
      const pending = restoring;
      restoring = null;
      currentPosition = pending.index;
      currentHref = browser.location.href;
      currentState = history.state;
      callbacks.request(pending.navigation);
      return;
    }
    if (bypass || withinProjectWorkspace(currentHref, targetHref) || (!callbacks.dirty() && !callbacks.saving())) {
      if (!withinProjectWorkspace(currentHref, targetHref)) callbacks.leave();
      currentPosition = targetPosition ?? currentPosition;
      currentHref = targetHref;
      currentState = event.state;
      bypass = false;
      return;
    }

    event.stopImmediatePropagation();
    const delta = targetPosition === null ? 0 : targetPosition - currentPosition;
    if (delta !== 0) {
      const navigation = { href: targetHref, resume: () => leave(() => history.go(delta)) };
      restoring = { navigation, index: currentPosition };
      history.go(-delta);
      return;
    }
    // Entries from before this guard/reload have no reliable traversal delta.
    // Restore this URL/router state and require an explicit new navigation.
    originalReplace.call(history, currentState, "", currentHref);
    callbacks.request({ href: targetHref, resume: () => leave(() => callbacks.navigate(targetHref)) });
  }

  function unload(event: BeforeUnloadEvent) {
    if (!bypass && (callbacks.dirty() || callbacks.saving())) {
      event.preventDefault();
      event.returnValue = "";
    }
  }

  browser.document.addEventListener("click", click, true);
  browser.addEventListener("popstate", pop, true);
  browser.addEventListener("beforeunload", unload);
  return () => {
    browser.document.removeEventListener("click", click, true);
    browser.removeEventListener("popstate", pop, true);
    browser.removeEventListener("beforeunload", unload);
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
  };
}
