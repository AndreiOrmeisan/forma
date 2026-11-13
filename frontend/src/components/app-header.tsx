import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";

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
      <Link href="/setari/furnizori" className="domain-back-link catalog-header-link">Furnizori și prețuri</Link>
      <div className="avatar" role="img" aria-label="Avatar utilizator">
        <UserRound size={20} strokeWidth={1.5} aria-hidden="true" />
      </div>
    </header>
  );
}
