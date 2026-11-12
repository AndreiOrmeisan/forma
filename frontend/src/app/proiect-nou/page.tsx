import { permanentRedirect } from "next/navigation";
import { furnitureRoutes } from "@/config/domains";

export default function LegacyNewProjectPage() {
  permanentRedirect(furnitureRoutes.newProject);
}
