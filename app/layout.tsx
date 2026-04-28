import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BunnyErrorBoundary } from "../components/chrome/error-boundary";

export const metadata: Metadata = {
  title: "Bunny — a quiet place to talk",
  description: "A gentle English companion for Yoyo.",
  // PWA manifest powers Android "Install" + Chrome desktop install.
  // iOS Safari reads the title/icons from the manifest as a hint, but
  // primarily uses the apple-touch-icon link and the appleWebApp block
  // below.
  manifest: "/manifest.webmanifest",
  // App-icon stack. The 180×180 variant is what iOS Safari grabs when
  // the user taps "Add to Home Screen"; everything else is for PWA /
  // Android / browser favicons.
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  // iPad + iPhone "Add to Home Screen" → opens in standalone mode (no
  // Safari chrome). Title is the label shown under the home-screen
  // icon. Status-bar style "default" keeps black text on the cream bg
  // so it stays readable on iPad iOS.
  appleWebApp: {
    capable: true,
    title: "Bunny",
    statusBarStyle: "default",
  },
  // Be explicit that the page is mobile/tablet friendly so Safari does
  // not pop up its old "view as desktop" toggle.
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Don't let an enthusiastic 6yo zoom the bunny by mistake — pinch
  // zoom gestures shouldn't break the layout. (Note: iOS Safari may
  // still allow accessibility zoom system-wide, which is correct.)
  maximumScale: 1,
  // Let the page paint into the iPad rounded-corner safe area when
  // launched from the home screen.
  viewportFit: "cover",
  // Cream theme color → Safari address bar, iOS standalone status bar,
  // Android system UI all tint to the app's palette instead of white.
  themeColor: "#fae9d9",
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
