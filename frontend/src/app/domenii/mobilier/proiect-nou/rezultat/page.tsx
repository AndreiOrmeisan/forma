import { furnitureRoutes } from "@/config/domains";
import { ProjectStepHeader } from "../step-header";
import { WardrobeResult } from "./wardrobe-result";
import styles from "../flow.module.css";
import resultStyles from "@/features/furniture/review.module.css";

export default function ResultPage() {
  return (
    <main id="main-content" className={`${styles.flowPage} ${resultStyles.widePage}`}>
      <ProjectStepHeader current={3} backHref={furnitureRoutes.reviewProject} />
      <WardrobeResult />
    </main>
  );
}
