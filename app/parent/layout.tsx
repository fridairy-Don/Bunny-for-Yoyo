import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bunny · Parent Tools",
  description: "Configure Bunny for your child. Parent-only area.",
  robots: { index: false, follow: false },
};

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  // Lightweight layout. No header chrome, no ambient motes, no drawer
  // shell — the parent area is intentionally utilitarian so it reads as
  // "settings", not "the bunny lives here too".
  return <div className="parent-shell">{children}</div>;
}
