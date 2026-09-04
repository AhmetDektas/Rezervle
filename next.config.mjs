/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { dirs: ['src', 'prisma', 'tests'] },
  // Playwright geliştirme sunucusuna 127.0.0.1 üzerinden bağlanır.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    // Demo görselleri uzak kaynaktan gelir; yüklenmezse bileşenler gradient'e düşer.
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};
export default nextConfig;
