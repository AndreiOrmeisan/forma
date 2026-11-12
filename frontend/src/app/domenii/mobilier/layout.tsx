import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function FurnitureLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AppHeader showDomainLink />
      {children}
      <BottomNavigation />
    </div>
  );
}
