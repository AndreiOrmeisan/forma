import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";

export default function NewProjectPage() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main id="main-content" className="placeholder-page">
        <Link href="/" className="back-link"><ArrowLeft size={18} aria-hidden="true" /> Înapoi acasă</Link>
        <h1>Proiect nou</h1>
        <p>În curând, aici începe proiectul tău.</p>
      </main>
    </div>
  );
}
