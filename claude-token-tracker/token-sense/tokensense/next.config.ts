import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node module — must run in Node.js runtime, not Edge
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
