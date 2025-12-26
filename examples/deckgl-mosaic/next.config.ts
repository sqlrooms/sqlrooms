import type {NextConfig} from 'next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
};

module.exports = nextConfig;
