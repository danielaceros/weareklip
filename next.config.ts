// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

// Crea el plugin apuntando a tu archivo de request
// Ajusta la ruta si tu request.ts está en otro lugar
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  // ...otros ajustes de Next.js
};

export default withNextIntl(nextConfig);
