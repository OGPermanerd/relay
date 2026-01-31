import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay - Internal Skill Marketplace",
  description: "Connect with colleagues who have the skills you need",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
