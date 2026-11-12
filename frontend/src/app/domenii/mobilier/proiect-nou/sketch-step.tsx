"use client";

import { useRouter } from "next/navigation";
import { SketchUploader } from "@/components/image-upload/sketch-uploader";
import { furnitureRoutes } from "@/config/domains";

export function SketchStep() {
  const router = useRouter();
  return <SketchUploader onContinue={() => router.push(furnitureRoutes.reviewProject)} />;
}
