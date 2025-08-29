// next-pwa.config.ts
const runtimeCaching = [
  {
    urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "firebase-storage",
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
    handler: "StaleWhileRevalidate" as const,
    options: {
      cacheName: "youtube-thumbnails",
    },
  },
  {
    urlPattern: /^https:\/\/app\.weareklip\.com\/.*/i,
    handler: "NetworkFirst" as const,
    options: {
      cacheName: "pages",
    },
  },
];

export default { runtimeCaching } as { runtimeCaching: any[] };
