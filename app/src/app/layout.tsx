import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssBoy.com - Domain Marketplace",
  description: "Premium domains for sale. The internet's chillest hangout spot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bungee&family=Bungee+Shade&family=Fredoka+One&family=Nunito:wght@700;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
