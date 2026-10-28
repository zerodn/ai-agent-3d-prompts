import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Agent World",
  description: "A 3D office where six AI agents visibly collaborate on software tasks. Simulation mode: no live inference.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
