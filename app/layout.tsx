import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit Heist — Pick your orbit. Take the heist.",
  description:
    "A free multiplayer space strategy game for 2–6 friends. Make secret moves, dodge cosmic storms, and collect the biggest fictional gem haul in six rounds. No accounts needed.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
