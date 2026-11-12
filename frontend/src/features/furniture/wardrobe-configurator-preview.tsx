"use client";

import { useState } from "react";
import { useWardrobeProject } from "./wardrobe-project-context";
import { WardrobePreview2D } from "./wardrobe-preview-2d";
import { WardrobeViewSwitcher } from "./wardrobe-view-switcher";
import type { WardrobeViewMode } from "./wardrobe-preview-geometry";
import { validateWardrobeDraft } from "./wardrobe-configuration";
import styles from "./wardrobe-preview.module.css";

export function WardrobeConfiguratorPreview() {
  const { draft } = useWardrobeProject();
  const [viewMode, setViewMode] = useState<WardrobeViewMode>("interior");
  if (!draft) return null;
  const { configuration } = validateWardrobeDraft(draft);

  return (
    <section className={styles.previewCard} aria-label="Previzualizare 2D dulap">
      <div className={styles.previewHeader}>
        <h2>Previzualizare 2D</h2>
        <WardrobeViewSwitcher value={viewMode} onChange={setViewMode} />
      </div>
      <WardrobePreview2D
        widthMm={configuration?.width_mm ?? Number.NaN}
        heightMm={configuration?.height_mm ?? Number.NaN}
        depthMm={configuration?.depth_mm ?? Number.NaN}
        doorsCount={configuration?.doors_count ?? Number.NaN}
        shelvesCount={configuration?.shelves_count ?? Number.NaN}
        viewMode={viewMode}
      />
    </section>
  );
}
