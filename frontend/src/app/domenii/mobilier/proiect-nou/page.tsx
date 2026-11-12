import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";

export default function NewProjectPage() {
  return (
    <main id="main-content" className="placeholder-page">
      <Link href={furnitureRoutes.home} className="back-link">
        <ArrowLeft size={18} aria-hidden="true" /> Înapoi acasă
      </Link>
      <h1>Proiect nou</h1>
      <p>În curând, aici începe proiectul tău.</p>
    </main>
  );
}
