/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
