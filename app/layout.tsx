import type { Metadata, Viewport } from "next";
import "../src/index.css";
import siteMetadataJson from "../metadata.json";
import { Providers } from "@/components/Providers";
import { getSiteUrl } from "@/lib/site-url";
import Footer from "@/components/Footer";

const metadataBase = new URL(getSiteUrl());

export const viewport: Viewport = {
  themeColor: siteMetadataJson.themeColor,
};

export const metadata: Metadata = {
  title: {
    default: siteMetadataJson.name,
    template: `%s | ${siteMetadataJson.name}`,
  },
  description: siteMetadataJson.description,
  applicationName: siteMetadataJson.name,
  verification: {
    google: "bxMOApuAcwtwMKB9mCQmf-bjHE-MtRePe65UmgwopJk",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
  metadataBase,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: {
      default: siteMetadataJson.name,
      template: `%s | ${siteMetadataJson.name}`,
    },
    description: siteMetadataJson.description,
    url: "/",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
