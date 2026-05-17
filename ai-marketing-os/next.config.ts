import type { NextConfig } from 'next'

const BASE_PATH = process.env.BASE_PATH || ''

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg', '@prisma/adapter-pg', '@prisma/client'],
  basePath: BASE_PATH || undefined,
  assetPrefix: BASE_PATH || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
}

export default nextConfig
