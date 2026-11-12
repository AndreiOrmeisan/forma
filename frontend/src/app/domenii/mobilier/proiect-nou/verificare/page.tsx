import { furnitureRoutes } from "@/config/domains";
import { ProjectStepHeader } from "../step-header";
import { SketchReview } from "./sketch-review";
import styles from "../flow.module.css";
import reviewStyles from "@/features/furniture/review.module.css";

export default function ReviewProjectPage() {
  return (
    <main id="main-content" className={`${styles.flowPage} ${reviewStyles.widePage}`}>
      <ProjectStepHeader current={2} backHref={furnitureRoutes.newProject} />
      <SketchReview />
    </main>
  );
}
