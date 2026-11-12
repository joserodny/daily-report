import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Playfair_Display({ subsets: ["latin"], weight: "600", style: "italic", variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Daily Report",
  description: "Create a clear, consistent daily work report.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
