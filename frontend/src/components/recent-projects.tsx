import { FilePenLine } from "lucide-react";

export function RecentProjects() {
  return (
    <section id="proiecte" className="recent-projects" aria-labelledby="recent-title">
      <h2 id="recent-title">Proiecte recente</h2>
      <div className="empty-projects">
        <span className="empty-icon"><FilePenLine size={30} strokeWidth={1.25} aria-hidden="true" /></span>
        <h3>Nu ai încă proiecte.</h3>
        <p>Primul tău proiect începe cu o schiță.</p>
      </div>
    </section>
  );
}
