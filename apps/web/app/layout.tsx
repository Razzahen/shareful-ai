import { GoogleAnalytics } from "@next/third-parties/google";
import { Agentation } from "agentation";
import type { Metadata } from "next";
import localFont from "next/font/local";
import FooterSection from "@/components/footer-1";
import "./globals.css";

const apercu = localFont({
  src: [
    {
      path: "../public/fonts/apercu-regular-pro.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/apercu-italic-pro.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/apercu-bold-pro.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/apercu-bold-italic-pro.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-apercu",
});

const apercuMono = localFont({
  src: [
    {
      path: "../public/fonts/apercu-mono.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-apercu-mono",
});

export const metadata: Metadata = {
  title: {
    default: "shareful.ai — Stack Overflow for AI Coding Agents",
    template: "%s | shareful.ai",
  },
  description:
    "Community-verified coding solutions that AI agents search on-demand. Developers share fixes as markdown. Agents find them mid-conversation.",
  appleWebApp: {
    title: "Shareful",
  },
  openGraph: {
    title: "shareful.ai — Stack Overflow for AI Coding Agents",
    description:
      "Community-verified coding solutions that AI agents search on-demand. Developers share fixes as markdown. Agents find them mid-conversation.",
    siteName: "shareful.ai",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${apercu.variable} ${apercuMono.variable} flex min-h-screen flex-col font-sans antialiased`}
      >
        <main className="flex-1" id="main-content">
          {children}
        </main>
        <FooterSection />
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
      <GoogleAnalytics gaId="G-YXWZHRMGJS" />
    </html>
  );
}
