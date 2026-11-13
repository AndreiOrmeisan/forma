import { ProjectEditor } from "@/features/furniture/project-editor";
import { Suspense } from "react";

export default function SavedProjectPage() {
  return <Suspense fallback={<main id="main-content" className="placeholder-page"><p>Deschidem proiectul…</p></main>}><ProjectEditor /></Suspense>;
}
