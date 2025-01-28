/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sqlrooms/ui'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
