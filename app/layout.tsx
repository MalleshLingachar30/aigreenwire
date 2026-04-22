import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aigreenwire.com";
const SITE_DESCRIPTION =
  "Weekly AI signals across agriculture, agroforestry, forestry, and ecology from The AI Green Wire.";

export const metadata: Metadata = {
  title: "The AI Green Wire",
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "The AI Green Wire",
    description: SITE_DESCRIPTION,
    siteName: "The AI Green Wire",
    type: "website",
    url: SITE_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "The AI Green Wire weekly briefing thumbnail",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The AI Green Wire",
    description: SITE_DESCRIPTION,
    images: ["/twitter-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
