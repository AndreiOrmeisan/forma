"use client";

import { useSyncExternalStore } from "react";

const storageKey = "forma-mode";
const changeEvent = "forma-mode-change";
type Mode = "simple" | "professional";
let fallbackMode: Mode = "simple";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function getSnapshot(): Mode {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return fallbackMode;
    return stored === "professional" ? "professional" : "simple";
  } catch {
    return fallbackMode;
  }
}

function selectMode(mode: Mode) {
  fallbackMode = mode;
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // Keep the control usable when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function ModeSwitcher() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => "simple");
  return (
    <fieldset className="mode-switcher">
      <legend className="sr-only">Alege modul de lucru</legend>
      {([
        ["simple", "Mod Simplu", "Pentru oricine"],
        ["professional", "Mod Profesional", "Pentru producători"],
      ] as const).map(([value, title, description]) => (
        <label key={value} className="mode-option">
          <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => selectMode(value)} />
          <span className="mode-label">
            <span className="mode-title">{title}</span>
            <span className="mode-description">{description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
