import Link from "next/link";
import { furnitureRoutes } from "@/config/domains";
import { ArrowUpRight, Rows3, Columns3, Ellipsis, PanelsTopLeft } from "lucide-react";

const upcomingCategories = [
  { name: "Comodă", icon: Rows3 },
  { name: "Bucătărie", icon: PanelsTopLeft },
  { name: "Mai multe", icon: Ellipsis },
];

export function FurnitureCategories() {
  return (
    <section className="categories" aria-labelledby="categories-title">
      <h2 id="categories-title">Ce vrei să creezi?</h2>
      <ul className="category-grid">
        <li>
          <Link href={furnitureRoutes.newProject} className="category category-active">
            <Columns3 size={29} strokeWidth={1.25} aria-hidden="true" />
            <span className="category-name">Dulap</span>
            <span className="category-status">Disponibil <ArrowUpRight size={12} aria-hidden="true" /></span>
          </Link>
        </li>
        {upcomingCategories.map(({ name, icon: Icon }) => (
          <li key={name}>
            <div className="category category-upcoming">
              <Icon size={29} strokeWidth={1.25} aria-hidden="true" />
              <span className="category-name">{name}</span>
              <span className="category-status">În curând</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
