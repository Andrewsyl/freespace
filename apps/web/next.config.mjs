/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: true
  },
  images: {
    domains: ["images.unsplash.com", "lh3.googleusercontent.com", "maps.googleapis.com"],
    unoptimized: true
  }
};

export default nextConfig;
