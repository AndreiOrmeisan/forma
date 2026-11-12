import type { WardrobeViewMode } from "./wardrobe-preview-geometry";
import styles from "./wardrobe-preview.module.css";

export function WardrobeViewSwitcher({ value, onChange }: {
  value: WardrobeViewMode;
  onChange: (mode: WardrobeViewMode) => void;
}) {
  return (
    <fieldset className={styles.switcher}>
      <legend className="sr-only">Vedere dulap</legend>
      {([ ["interior", "Interior"], ["doors", "Cu uși"] ] as const).map(([mode, label]) => (
        <label key={mode} className={styles.viewOption}>
          <input type="radio" name="wardrobe-view" value={mode} checked={value === mode} onChange={() => onChange(mode)} />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
