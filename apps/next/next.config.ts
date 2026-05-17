import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@genesis-1/shared'],
  experimental: {
    optimizePackageImports: ['@genesis-1/shared'],
  },
};

export default nextConfig;
