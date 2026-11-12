import Link from "next/link";
import { ArrowUpRight, Armchair, Droplets, Fan, HardHat, PaintRoller, Zap } from "lucide-react";
import { domains, type DomainIcon } from "@/config/domains";

const domainIcons = {
  furniture: Armchair,
  electrical: Zap,
  plumbing: Droplets,
  construction: HardHat,
  interiors: PaintRoller,
  hvac: Fan,
} satisfies Record<DomainIcon, typeof Armchair>;

export function DomainSelection() {
  return (
    <ul className="domain-grid" aria-label="Domenii de proiect">
      {domains.map((domain) => {
        const Icon = domainIcons[domain.icon];
        const content = (
          <>
            <span className="domain-card-top">
              <Icon size={30} strokeWidth={1.4} aria-hidden="true" />
              <span className="domain-status">
                {domain.status === "available" ? "Disponibil" : "În curând"}
                {domain.status === "available" && <ArrowUpRight size={16} aria-hidden="true" />}
              </span>
            </span>
            <h2>{domain.displayName}</h2>
            <p>{domain.description}</p>
          </>
        );

        return (
          <li key={domain.id}>
            {domain.status === "available" ? (
              <Link href={domain.route} className="domain-card domain-card-available">{content}</Link>
            ) : (
              <div className="domain-card domain-card-upcoming">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
