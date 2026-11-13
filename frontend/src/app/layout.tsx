import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/features/auth/auth-context";
import { ProjectWorkspace } from "@/features/furniture/project-workspace";

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FORMA",
  description: "Transformă o schiță de mobilier într-un proiect complet, cu listă de debitare, materiale și costuri.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={geist.variable}>
      <body><AuthProvider><ProjectWorkspace>{children}</ProjectWorkspace></AuthProvider></body>
    </html>
  );
}
