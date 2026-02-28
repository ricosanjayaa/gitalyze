import metadata from "../../metadata.json";

export function getSiteUrl() {
  const fromServer = process.env.SITE_URL;
  const fromClient = process.env.NEXT_PUBLIC_SITE_URL;
  const raw = fromServer || fromClient || metadata.origin || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

