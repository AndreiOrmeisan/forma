import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecentProjects } from "@/components/recent-projects";
import { furnitureRoutes } from "@/config/domains";

export default function FurnitureProjectsPage() {
  return (
    <main id="main-content" className="placeholder-page projects-page">
      <Link href={furnitureRoutes.home} className="back-link">
        <ArrowLeft size={18} aria-hidden="true" /> Înapoi acasă
      </Link>
      <RecentProjects title="Proiecte" heading="h1" />
    </main>
  );
}
