import { FurnitureCategories } from "@/components/furniture-categories";
import { HeroSection } from "@/components/hero-section";
import { ModeSwitcher } from "@/components/mode-switcher";
import { NewProjectCard } from "@/components/new-project-card";
import { RecentProjects } from "@/components/recent-projects";
import { FurnitureCatalogCard } from "@/components/furniture-catalog-card";

export default function Home() {
  return (
    <>
      <main id="main-content" className="home-content">
        <HeroSection />
        <div className="workspace-grid">
          <div className="creation-column">
            <ModeSwitcher />
            <NewProjectCard />
            <FurnitureCatalogCard />
            <FurnitureCategories />
          </div>
          <RecentProjects />
        </div>
      </main>
    </>
  );
}
