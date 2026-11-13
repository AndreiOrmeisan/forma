"use client";

import type { ReactNode } from "react";
import { ImageDraftProvider } from "../../components/image-upload/image-draft-context";
import { WardrobeProjectProvider } from "./wardrobe-project-context";
import { ProjectNavigationGuard } from "./project-navigation-guard";

// Kept above route/Activity boundaries so accepted SPA navigation cannot destroy
// the draft while a navigation decision or a save is still pending.
export function ProjectWorkspace({ children }: { children: ReactNode }) {
  return <ImageDraftProvider>
    <WardrobeProjectProvider>
      <ProjectNavigationGuard>{children}</ProjectNavigationGuard>
    </WardrobeProjectProvider>
  </ImageDraftProvider>;
}
