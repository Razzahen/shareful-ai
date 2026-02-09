import { RootProvider } from "fumadocs-ui/provider/next";
import localFont from "next/font/local";
import "./global.css";

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
    <html lang="en" className={`${apercu.variable} font-sans`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ options: { api: "/docs/api/search" } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
