import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bunny Companion Prototype",
  description: "A minimal bunny companion state prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
