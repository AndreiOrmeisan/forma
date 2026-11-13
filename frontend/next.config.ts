import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (authUrl || authKey) {
  let validUrl = false;
  try {
    const parsed = new URL(authUrl || "");
    validUrl = parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch { /* Report a configuration error without echoing supplied values. */ }
  if (!authUrl || !authKey || !validUrl) {
    throw new Error("Set both public Supabase variables and use an HTTPS project URL.");
  }
  let publicKey = authKey.startsWith("sb_publishable_");
  if (!publicKey) {
    try { publicKey = JSON.parse(Buffer.from(authKey.split(".")[1], "base64url").toString()).role === "anon"; }
    catch { /* Fail before any accidentally supplied secret can enter the bundle. */ }
  }
  if (!publicKey) throw new Error("Frontend Supabase configuration requires a publishable/anon key, never a secret/service_role key.");
}

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? (process.env.NEXT_PUBLIC_BASE_PATH || "/forma") : "",
  trailingSlash: isGitHubPages,
  cacheComponents: !isGitHubPages,
  partialPrefetching: !isGitHubPages,
  turbopack: {
    rules: {
      // Preserve Next.js CSS Module processing and its exported class names.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
