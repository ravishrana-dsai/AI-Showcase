/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use a separate build directory per instance when NEXT_DIST_DIR is set
  // This allows multiple dev servers to run in parallel without conflicts
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
