import Link from "next/link";
import { UserRound } from "lucide-react";

export function AppHeader() {
  return (
    <header className="app-header">
      <a href="#main-content" className="skip-link">Sari la conținut</a>
      <Link href="/" className="wordmark" aria-label="FORMA — Acasă">FORMA</Link>
      <div className="avatar" role="img" aria-label="Avatar utilizator">
        <UserRound size={20} strokeWidth={1.5} aria-hidden="true" />
      </div>
    </header>
  );
}
