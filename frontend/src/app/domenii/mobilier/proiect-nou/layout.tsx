import type { ReactNode } from "react";
import { ImageDraftProvider } from "@/components/image-upload/image-draft-context";

export default function NewProjectLayout({ children }: { children: ReactNode }) {
  return <ImageDraftProvider>{children}</ImageDraftProvider>;
}
