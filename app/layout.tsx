import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BunnyErrorBoundary } from "../components/chrome/error-boundary";

export const metadata: Metadata = {
  title: "Bunny — a quiet place to talk",
  description: "A gentle English companion for Yoyo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@300;400;500&family=Quicksand:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BunnyErrorBoundary>{children}</BunnyErrorBoundary>
      </body>
    </html>
  );
}
