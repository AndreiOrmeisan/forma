import Link from "next/link";
import { ArrowUpRight, Camera } from "lucide-react";

export function NewProjectCard() {
  return (
    <Link href="/proiect-nou" className="new-project-card">
      <span className="camera-mark"><Camera size={27} strokeWidth={1.5} aria-hidden="true" /></span>
      <span className="new-project-copy">
        <span className="new-project-title">Proiect nou</span>
        <span className="new-project-description">Fotografiază o schiță sau încarcă o imagine.</span>
      </span>
      <span className="action-arrow"><ArrowUpRight size={24} strokeWidth={1.5} aria-hidden="true" /></span>
    </Link>
  );
}
