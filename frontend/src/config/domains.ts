export type DomainIcon = "furniture" | "electrical" | "plumbing" | "construction" | "interiors" | "hvac";

type DomainDetails = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  icon: DomainIcon;
};

export type Domain = DomainDetails & (
  | { status: "available"; route: `/domenii/${string}` }
  | { status: "coming-soon"; route: null }
);

export const furnitureDomain = {
  id: "furniture",
  slug: "mobilier",
  displayName: "Mobilier & Tâmplărie",
  description: "De la schița unui dulap la materiale și deviz.",
  icon: "furniture",
  status: "available",
  route: "/domenii/mobilier",
} as const satisfies Domain;

export const furnitureRoutes = {
  home: furnitureDomain.route,
  newProject: `${furnitureDomain.route}/proiect-nou`,
  reviewProject: `${furnitureDomain.route}/proiect-nou/verificare`,
  resultProject: `${furnitureDomain.route}/proiect-nou/rezultat`,
  projects: `${furnitureDomain.route}/proiecte`,
} as const;

export const domains: readonly Domain[] = [
  furnitureDomain,
  {
    id: "electrical",
    slug: "electrice",
    displayName: "Instalații electrice",
    description: "Circuite, echipamente și materiale electrice.",
    icon: "electrical",
    status: "coming-soon",
    route: null,
  },
  {
    id: "plumbing",
    slug: "sanitare",
    displayName: "Instalații sanitare",
    description: "Rețele de apă, canalizare și obiecte sanitare.",
    icon: "plumbing",
    status: "coming-soon",
    route: null,
  },
  {
    id: "construction",
    slug: "constructii",
    displayName: "Construcții",
    description: "Lucrări, cantități și materiale de construcție.",
    icon: "construction",
    status: "coming-soon",
    route: null,
  },
  {
    id: "interiors",
    slug: "amenajari",
    displayName: "Amenajări interioare",
    description: "Finisaje și materiale pentru spațiul tău.",
    icon: "interiors",
    status: "coming-soon",
    route: null,
  },
  {
    id: "hvac",
    slug: "hvac",
    displayName: "HVAC",
    description: "Încălzire, ventilație și climatizare.",
    icon: "hvac",
    status: "coming-soon",
    route: null,
  },
];
