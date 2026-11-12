import { ImageDraftProvider } from "@/components/image-upload/image-draft-context";
import { WardrobeProjectProvider } from "@/features/furniture/wardrobe-project-context";
import { ProjectEditor } from "@/features/furniture/project-editor";
import { Suspense } from "react";

export default function SavedProjectPage() {
  return <Suspense fallback={<main id="main-content" className="placeholder-page"><p>Deschidem proiectul…</p></main>}><ImageDraftProvider><WardrobeProjectProvider><ProjectEditor /></WardrobeProjectProvider></ImageDraftProvider></Suspense>;
}
