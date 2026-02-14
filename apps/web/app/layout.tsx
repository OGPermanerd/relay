import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { MarkerIO } from "@/components/marker-io";
import "./globals.css";

export const metadata: Metadata = {
  title: "EverySkill - Internal Skill Marketplace",
  description: "Connect with colleagues who have the skills you need",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
          <MarkerIO />
        </Providers>
      </body>
    </html>
  );
}
