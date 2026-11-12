import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

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
