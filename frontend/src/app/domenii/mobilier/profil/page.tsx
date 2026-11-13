import Link from "next/link";
import { AccountPanel } from "@/features/auth/account-panel";
import { furnitureRoutes } from "@/config/domains";
import styles from "@/features/furniture/projects.module.css";

export default function ProfilePage() {
  return <main id="main-content" className={styles.page}>
    <header className={styles.heading}><h1>Profilul meu</h1></header>
    <AccountPanel />
    <Link href="/setari/date-firma" className={styles.primary}>Datele firmei pentru PDF</Link>
    <p><Link href="/domenii/mobilier/profiluri-prelucrare" className={styles.textLink}>Profiluri de prelucrare · setări de atelier</Link></p>
    <p><Link href="/setari/backup-si-restaurare" className={styles.textLink}>Backup și restaurare · proiecte, catalog și firmă</Link></p>
    <p>Dacă ai deschis conectarea dintr-un proiect, revino la fila inițială. Sesiunea se actualizează automat, iar schița rămâne acolo.</p>
    <Link href={furnitureRoutes.projects} className={styles.textLink}>Proiectele mele</Link>
  </main>;
}
