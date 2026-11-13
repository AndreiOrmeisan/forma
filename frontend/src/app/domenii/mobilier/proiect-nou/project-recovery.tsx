import Link from "next/link";
import { ImagePlus } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";
import styles from "./flow.module.css";

export function ProjectRecovery() {
  return (
    <section className={styles.recovery} aria-labelledby="recovery-title">
      <ImagePlus size={36} strokeWidth={1.4} aria-hidden="true" />
      <h1 id="recovery-title">Adaugă din nou schița.</h1>
      <p>Fotografia și modificările nesalvate sunt temporare. Dacă ai salvat proiectul, îl poți redeschide din Proiectele mele. Pentru o schiță nesalvată, selectează din nou fotografia.</p>
      <Link href={furnitureRoutes.newProject} className={styles.returnLink}>Încarcă o schiță</Link>
      <Link href={furnitureRoutes.projects} className={styles.returnLink}>Proiectele mele</Link>
    </section>
  );
}
