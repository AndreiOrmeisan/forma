"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { furnitureRoutes } from "@/config/domains";
import { FolderOpen, House, UserRound } from "lucide-react";

export function BottomNavigation() {
  const pathname = usePathname().replace(/\/$/, "");
  const isHome = pathname === furnitureRoutes.home;
  const isProjects = pathname === furnitureRoutes.projects || pathname.startsWith(`${furnitureRoutes.projects}/`);
  const isProfile = pathname === `${furnitureRoutes.home}/profil`;
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
      <Link href={`${furnitureRoutes.home}/profil`} className={`nav-item${isProfile ? " nav-active" : ""}`} aria-current={isProfile ? "page" : undefined}><UserRound size={22} strokeWidth={1.6} aria-hidden="true" /><span>Profil</span></Link>
    </nav>
  );
}
