import { AppHeader } from "@/components/app-header";
import { DomainSelection } from "@/components/domain-selection";

export default function DomainDashboard() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main id="main-content" className="domain-content">
        <section className="hero" aria-labelledby="domains-title">
          <h1 id="domains-title">Alege domeniul<span>.</span></h1>
          <p>Ce tip de proiect vrei să realizezi?</p>
        </section>
        <DomainSelection />
      </main>
    </div>
  );
}
