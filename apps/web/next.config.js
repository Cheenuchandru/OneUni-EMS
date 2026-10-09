/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/uploads/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/uploads/:path*` 
          : 'http://127.0.0.1:8200/uploads/:path*',
      },
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*` 
          : 'http://127.0.0.1:8200/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
