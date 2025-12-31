import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sol Launchpad - Create Solana Tokens",
  description:
    "Launch your own SPL token on Solana blockchain with immutable supply and on-chain metadata. No fees, personal use.",
  keywords: [
    "Solana",
    "SPL Token",
    "Token Launch",
    "Crypto",
    "Blockchain",
    "Memecoin",
  ],
  authors: [{ name: "Sol Launchpad" }],
  robots: "noindex, nofollow",
  openGraph: {
    title: "Sol Launchpad - Create Solana Tokens",
    description: "Launch your own SPL token on Solana blockchain.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
