import { FilePenLine } from "lucide-react";
import Link from "next/link";
import { furnitureRoutes } from "@/config/domains";

export function RecentProjects({
  title = "Proiecte recente",
  heading: Heading = "h2",
}: {
  title?: string;
  heading?: "h1" | "h2";
}) {
  const EmptyHeading = Heading === "h1" ? "h2" : "h3";
  return (
    <section id="proiecte" className="recent-projects" aria-labelledby="recent-title">
      <div className="section-heading">
        <Heading id="recent-title">{title}</Heading>
        {Heading === "h2" && <Link href={furnitureRoutes.projects} className="projects-link">Vezi proiectele</Link>}
      </div>
      <div className="empty-projects">
        <span className="empty-icon"><FilePenLine size={30} strokeWidth={1.25} aria-hidden="true" /></span>
        <EmptyHeading className="empty-projects-title">Nu ai încă proiecte.</EmptyHeading>
        <p>Primul tău proiect începe cu o schiță.</p>
      </div>
    </section>
  );
}
