import type { ReactNode } from "react";
import { ImageDraftProvider } from "@/components/image-upload/image-draft-context";
import { WardrobeProjectProvider } from "@/features/furniture/wardrobe-project-context";

export default function NewProjectLayout({ children }: { children: ReactNode }) {
  return <ImageDraftProvider><WardrobeProjectProvider>{children}</WardrobeProjectProvider></ImageDraftProvider>;
}
