"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { furnitureRoutes } from "@/config/domains";
import { FolderOpen, House, UserRound } from "lucide-react";

export function BottomNavigation() {
  const pathname = usePathname();
  const isHome = pathname === furnitureRoutes.home;
  const isProjects = pathname === furnitureRoutes.projects;
  return (
    <nav className="bottom-navigation" aria-label="Navigare principală">
      <Link
        href={furnitureRoutes.home}
        className={`nav-item${isHome ? " nav-active" : ""}`}
        aria-current={isHome ? "page" : undefined}
      >
        <House size={22} strokeWidth={1.6} aria-hidden="true" />
        <span>Acasă</span>
      </Link>
      <Link
        href={furnitureRoutes.projects}
        className={`nav-item${isProjects ? " nav-active" : ""}`}
        aria-current={isProjects ? "page" : undefined}
      >
        <FolderOpen size={22} strokeWidth={1.6} aria-hidden="true" />
        <span>Proiecte</span>
      </Link>
      <button type="button" className="nav-item" disabled><UserRound size={22} strokeWidth={1.6} aria-hidden="true" /><span>Profil<span className="sr-only"> — în curând</span></span></button>
    </nav>
  );
}
