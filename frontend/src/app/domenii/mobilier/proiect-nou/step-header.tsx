import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StepIndicator } from "@/components/step-indicator";
import styles from "./flow.module.css";

export function ProjectStepHeader({ current, backHref }: { current: number; backHref: string }) {
  return (
    <header className={styles.stepHeader}>
      <Link href={backHref} className={styles.backButton} aria-label="Înapoi">
        <ArrowLeft size={21} strokeWidth={1.6} aria-hidden="true" />
      </Link>
      <div className={styles.projectTitle}>
        <p>Proiect nou</p>
      </div>
      <StepIndicator current={current} total={3} />
    </header>
  );
}
