// Resolve image URLs so Lovable-hosted assets (/__l5e/...) also work
// in the dev sandbox (localhost) and inside the Lovable preview iframe,
// where the "/__l5e/" path is not proxied by Vite.
const PROD_ORIGIN = "https://food-xpress.lovable.app";

export function resolveImg(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Absolute URL — use as is
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;

  // Lovable CDN asset — always resolve against the production origin,
  // which serves these paths from any environment.
  if (trimmed.startsWith("/__l5e/")) return `${PROD_ORIGIN}${trimmed}`;

  return trimmed;
}
