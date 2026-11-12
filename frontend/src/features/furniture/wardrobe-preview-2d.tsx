import { useId } from "react";
import { createWardrobeLayout, previewViewport, type WardrobePreviewProps } from "./wardrobe-preview-geometry";
import styles from "./wardrobe-preview.module.css";

export function WardrobePreview2D(props: WardrobePreviewProps) {
  const titleId = useId();
  const descriptionId = useId();
  const layout = createWardrobeLayout(props);

  if (!layout) {
    return (
      <div className={styles.invalidDrawing} role="status">
        <p>Completează valorile valide pentru a actualiza desenul.</p>
        <span>Poți continua editarea în formular.</span>
      </div>
    );
  }

  const { outline, widthDimensionY, heightDimensionX } = layout;
  const right = outline.x + outline.width;
  const bottom = outline.y + outline.height;
  const centerX = outline.x + outline.width / 2;
  const centerY = outline.y + outline.height / 2;
  const viewLabel = props.viewMode === "interior" ? "interior" : "cu uși";

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.drawing}
        viewBox={`0 0 ${previewViewport.width} ${previewViewport.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>{`Dulap ${viewLabel}, ${props.widthMm} × ${props.heightMm} mm`}</title>
        <desc id={descriptionId}>Vedere frontală proporțională. Grosimea panourilor este schematică. Adâncimea este indicată separat.</desc>
        <g className={styles.cabinet}>
          <rect {...outline} className={styles.backPanel} />
          {layout.panels.map((panel, index) => <rect key={index} {...panel} className={styles.panel} data-part="panel" />)}
          {layout.shelves.map((shelf, index) => <rect key={index} {...shelf} className={styles.shelf} data-part="shelf" />)}
          {layout.doors.map((door, index) => (
            <g key={index}>
              <rect x={door.x} y={door.y} width={door.width} height={door.height} className={styles.door} data-part="door" />
              <line x1={door.handleX} x2={door.handleX} y1={door.handleY} y2={door.handleY + door.handleLength} className={styles.handle} data-part="handle" />
            </g>
          ))}
          <rect {...outline} fill="none" className={styles.outline} />
        </g>
        <g className={styles.dimensions} aria-hidden="true">
          <path d={`M ${outline.x} ${bottom + 5} V ${widthDimensionY + 5} M ${right} ${bottom + 5} V ${widthDimensionY + 5} M ${outline.x} ${widthDimensionY} H ${right}`} />
          <path d={`M ${outline.x - 3} ${widthDimensionY + 3} l 6 -6 M ${right - 3} ${widthDimensionY + 3} l 6 -6`} />
          <text x={centerX} y={widthDimensionY + 20} textAnchor="middle">{props.widthMm} mm</text>
          <path d={`M ${outline.x - 5} ${outline.y} H ${heightDimensionX - 5} M ${outline.x - 5} ${bottom} H ${heightDimensionX - 5} M ${heightDimensionX} ${outline.y} V ${bottom}`} />
          <path d={`M ${heightDimensionX - 3} ${outline.y + 3} l 6 -6 M ${heightDimensionX - 3} ${bottom + 3} l 6 -6`} />
          <text x={heightDimensionX - 13} y={centerY} textAnchor="middle" transform={`rotate(-90 ${heightDimensionX - 13} ${centerY})`}>{props.heightMm} mm</text>
        </g>
      </svg>
      <figcaption className={styles.caption}>
        <span>Adâncime <strong>{props.depthMm} mm</strong></span>
        <span>Vedere frontală</span>
      </figcaption>
    </figure>
  );
}
