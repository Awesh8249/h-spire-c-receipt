import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "H Spire C Main Site",
  description:
    "Construction planning, clear estimates and customer bill tracking from H Spire C.",
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
      <head>
        <link rel="preload" href="/assets/hero-construction-expanded-v5.webp" as="image" type="image/webp" media="(min-width: 601px)" fetchPriority="high" />
        <link rel="preload" href="/assets/hero-construction-mobile-v2.webp" as="image" type="image/webp" media="(max-width: 600px)" fetchPriority="high" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
