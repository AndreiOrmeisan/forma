export const catalogBackupMaxBytes = 16 * 1024 * 1024;
export const fullBackupMaxBytes = 32 * 1024 * 1024;
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).byteLength;
export function requireByteLimit(text: string, limit: number, label = "Fișierul") {
  if (utf8Bytes(text) > limit) throw new Error(`${label} poate avea maximum ${limit / 1024 / 1024} MB (UTF-8). Datele nu au fost trunchiate.`);
}
