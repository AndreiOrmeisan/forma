"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { furnitureRoutes } from "@/config/domains";

// Retain old bookmarks, including on the static GitHub Pages deployment.
export default function LegacySuppliersPage() {
  const router=useRouter();
  useEffect(()=>{router.replace(furnitureRoutes.suppliers);},[router]);
  return <main id="main-content" className="app-shell"><p>Catalogul s-a mutat în domeniul Mobilier.</p><Link href={furnitureRoutes.suppliers}>Deschide furnizorii de mobilier</Link></main>;
}
