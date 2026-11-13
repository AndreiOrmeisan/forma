export type ProjectStorageMode = "browser" | "api";

export function getProjectStorageMode(): ProjectStorageMode {
  const mode = process.env.NEXT_PUBLIC_PROJECT_STORAGE || "browser";
  if (mode !== "browser" && mode !== "api") throw new Error("Modul de salvare a proiectelor este invalid.");
  return mode;
}

export const browserStorageNotice = "Proiectele se salvează doar în acest browser, pe acest dispozitiv, fără cont. Nu se sincronizează și se pot pierde dacă ștergi datele site-ului sau folosești navigarea privată. Imaginea originală nu este salvată.";
