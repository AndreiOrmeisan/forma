import { permanentRedirect } from "next/navigation";
import { furnitureRoutes } from "@/config/domains";
import { LegacyProjectRedirect } from "./legacy-project-redirect";

export default function LegacyNewProjectPage() {
  if (process.env.GITHUB_PAGES === "true") return <LegacyProjectRedirect />;
  permanentRedirect(furnitureRoutes.newProject);
}
