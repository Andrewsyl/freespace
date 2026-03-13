/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: true
  },
  images: {
    domains: ["images.unsplash.com", "lh3.googleusercontent.com", "maps.googleapis.com"],
    unoptimized: true
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
