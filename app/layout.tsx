import type { Metadata } from "next";
import "../src/index.css";
import siteMetadataJson from "../metadata.json";
import { Providers } from "@/components/Providers";
import { getSiteUrl } from "@/lib/site-url";

const metadataBase = new URL(getSiteUrl());

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
  themeColor: siteMetadataJson.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
