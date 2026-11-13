import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";
import styles from "./furniture-catalog-card.module.css";

export function FurnitureCatalogCard() {
  return (
    <Link href={furnitureRoutes.suppliers} className={styles.card}>
      <span className={styles.icon}><Store size={24} strokeWidth={1.5} aria-hidden="true" /></span>
      <span className={styles.copy}>
        <span className={styles.label}>SPAȚIUL TĂU DE MOBILIER</span>
        <span className={styles.title}>Furnizori și prețuri</span>
        <span className={styles.description}>Organizează furnizorii de mobilier și prețurile pentru proiectele tale.</span>
      </span>
      <ArrowUpRight size={22} aria-hidden="true" className={styles.arrow} />
    </Link>
  );
}
