import { AppHeader } from "@/components/app-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { FurnitureCategories } from "@/components/furniture-categories";
import { HeroSection } from "@/components/hero-section";
import { ModeSwitcher } from "@/components/mode-switcher";
import { NewProjectCard } from "@/components/new-project-card";
import { RecentProjects } from "@/components/recent-projects";

export default function Home() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main id="main-content" className="home-content">
        <HeroSection />
        <div className="workspace-grid">
          <div className="creation-column">
            <ModeSwitcher />
            <NewProjectCard />
            <FurnitureCategories />
          </div>
          <RecentProjects />
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}
