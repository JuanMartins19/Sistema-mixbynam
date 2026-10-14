import type { NextConfig } from 'next';
const config: NextConfig = {
  // Diretório fixo e isolado para testes; publicação continua usando .next.
  distDir: process.env.MIXBYNAM_E2E === '1' ? '.next-e2e' : '.next',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }, { source: '/produtor/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }];
  },
};
export default config;
