import { GoogleAnalytics } from "@next/third-parties/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./global.css";

export const metadata: Metadata = {
  other: {
    "apple-mobile-web-app-title": "Shareful",
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
        <RootProvider search={{ options: { api: "/docs/api/search" } }}>
          {children}
        </RootProvider>
      </body>
      <GoogleAnalytics gaId="G-YXWZHRMGJS" />
    </html>
  );
}
