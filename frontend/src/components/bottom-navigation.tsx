import Link from "next/link";
import { FolderOpen, House, UserRound } from "lucide-react";

export function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Navigare principală">
      <Link href="/" className="nav-item nav-active" aria-current="page"><House size={22} strokeWidth={1.6} aria-hidden="true" /><span>Acasă</span></Link>
      <a href="#proiecte" className="nav-item"><FolderOpen size={22} strokeWidth={1.6} aria-hidden="true" /><span>Proiecte</span></a>
      <button type="button" className="nav-item" disabled><UserRound size={22} strokeWidth={1.6} aria-hidden="true" /><span>Profil<span className="sr-only"> — în curând</span></span></button>
    </nav>
  );
}
