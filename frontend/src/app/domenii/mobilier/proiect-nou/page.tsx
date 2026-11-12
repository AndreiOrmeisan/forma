import { furnitureRoutes } from "@/config/domains";
import { ProjectStepHeader } from "./step-header";
import { SketchStep } from "./sketch-step";
import styles from "./flow.module.css";

export default function NewProjectPage() {
  return (
    <main id="main-content" className={styles.flowPage}>
      <ProjectStepHeader current={1} backHref={furnitureRoutes.home} />
      <section className={styles.flowContent} aria-labelledby="upload-title">
        <div className={styles.introduction}>
          <p className={styles.domainLabel}>MOBILIER / DULAP</p>
          <h1 id="upload-title">Începe cu o schiță<span>.</span></h1>
          <p>Fotografiază desenul dulapului sau încarcă o imagine din telefon.</p>
        </div>
        <SketchStep />
      </section>
    </main>
  );
}
