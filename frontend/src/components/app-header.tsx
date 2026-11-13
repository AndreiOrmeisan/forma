import Link from "next/link";
import { ArrowLeft, Store, UserRound } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";

export function AppHeader({ showDomainLink = false }: { showDomainLink?: boolean }) {
  return (
    <header className="app-header">
      <a href="#main-content" className="skip-link">Sari la conținut</a>
      <div className="header-brand">
        <Link href="/" className="wordmark" aria-label="FORMA — Alege domeniul">FORMA</Link>
        {showDomainLink && (
          <Link href="/" className="domain-back-link">
            <ArrowLeft size={14} aria-hidden="true" /> Domenii
          </Link>
        )}
      </div>
      {showDomainLink && <Link href={furnitureRoutes.suppliers} className="catalog-header-link"><Store size={16} aria-hidden="true" /><span>Furnizori și prețuri</span></Link>}
      <div className="avatar" role="img" aria-label="Avatar utilizator">
        <UserRound size={20} strokeWidth={1.5} aria-hidden="true" />
      </div>
    </header>
  );
}
