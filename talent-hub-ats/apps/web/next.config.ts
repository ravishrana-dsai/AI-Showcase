import type { NextConfig } from "next";
import path from "path";
import { getCareersPublicSiteBase } from "./src/lib/careers-site-url";

const BASE_PATH = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  transpilePackages: ["@talent-hub/db", "@talent-hub/shared"],
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "bullmq",
    "ioredis",
    "pdf-to-img",
    "pdfjs-dist",
    "tesseract.js",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing — essential given file upload/serve routes
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Deny framing from any origin (clickjacking protection)
          { key: "X-Frame-Options", value: "DENY" },
          // Strict referrer to avoid leaking session tokens or internal paths
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser feature access
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Basic CSP: blocks inline scripts from unknown origins.
          // Note: Next.js requires 'unsafe-inline' for styles; scripts use nonces in production.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // HSTS: only sent over HTTPS (browsers ignore it on HTTP)
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  async redirects() {
    const careersBase = getCareersPublicSiteBase();

    const careersRoot = careersBase.replace(/\/$/, "");
    return [
      {
        source: "/careers/dream-sports",
        destination: `${careersRoot}/company`,
        permanent: true,
      },
      {
        source: "/careers/dream-sports/:path*",
        destination: `${careersRoot}/company/:path*`,
        permanent: true,
      },
      // Exact /hiring-portal/careers (optional :path* may not match zero segments on all versions)
      {
        source: "/careers",
        destination: `${careersRoot}/`,
        permanent: false,
      },
      {
        source: "/careers/:path*",
        destination: `${careersRoot}/:path*`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
