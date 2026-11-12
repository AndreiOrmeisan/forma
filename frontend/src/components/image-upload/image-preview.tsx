import Image from "next/image";
import type { ValidatedImage } from "./validate-image";
import styles from "./upload.module.css";

export function ImagePreview({ image }: { image: ValidatedImage }) {
  const size = image.file.size < 1024 * 1024
    ? `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(image.file.size / 1024)} KB`
    : `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(image.file.size / (1024 * 1024))} MB`;

  return (
    <figure className={styles.preview}>
      <div className={styles.imageFrame}>
        <Image
          src={image.url}
          alt="Previzualizarea imaginii selectate"
          width={image.width}
          height={image.height}
          unoptimized
          className={styles.image}
        />
      </div>
      <figcaption className={styles.fileDetails}>
        <span className={styles.fileName}>{image.file.name}</span>
        <span className={styles.fileSize}>{size}</span>
      </figcaption>
    </figure>
  );
}
