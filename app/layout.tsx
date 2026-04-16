import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The AI Green Wire",
  description:
    "A weekly newsletter on AI in agriculture, agroforestry, forestry and ecology — by Grobet India Agrotech.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
