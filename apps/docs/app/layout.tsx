import { GoogleAnalytics } from "@next/third-parties/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://shareful.ai"),
  title: {
    default: "shareful.ai | Documentation",
    template: "%s | shareful.ai",
  },
  description:
    "Share AI coding solutions as markdown in GitHub repos. Two CLI skills let your agents discover verified fixes on-demand.",
  openGraph: {
    title: "shareful.ai | Documentation",
    description:
      "Share AI coding solutions as markdown in GitHub repos. Two CLI skills let your agents discover verified fixes on-demand.",
    siteName: "shareful.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    title: "Shareful",
  },
};

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

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${apercu.variable} font-sans`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from static schema objects
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "shareful.ai",
              url: "https://shareful.ai",
            }),
          }}
          type="application/ld+json"
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from static schema objects
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "shareful.ai",
              url: "https://shareful.ai",
            }),
          }}
          type="application/ld+json"
        />
        <RootProvider search={{ options: { api: "/docs/api/search" } }}>
          {children}
        </RootProvider>
      </body>
      <GoogleAnalytics gaId="G-YXWZHRMGJS" />
    </html>
  );
}
