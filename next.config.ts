// next.config.ts
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import withPWAInit from "next-pwa";
import pwaConfig from "./next-pwa.config";

// Configuración de next-intl
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Configuración de next-pwa
const withPWA = withPWAInit({
  dest: "public", // genera sw.js en /public
  register: true, // se registra automáticamente
  skipWaiting: true, // actualiza al instante
  disable: process.env.NODE_ENV === "development", // solo en prod
  ...pwaConfig,
});

// Config base Next.js
const baseConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["firebasestorage.googleapis.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

// ✅ Encadenar primero PWA y luego Intl
export default withNextIntl(withPWA(baseConfig as any) as any);

