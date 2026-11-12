"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { furnitureRoutes } from "@/config/domains";

export function LegacyProjectRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(furnitureRoutes.newProject); }, [router]);
  return (
    <main className="app-shell placeholder-page">
      <h1>Proiect nou</h1>
      <Link href={furnitureRoutes.newProject} className="back-link">Continuă către încărcarea schiței</Link>
    </main>
  );
}
