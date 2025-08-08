// src/app/layout.tsx
import React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { cookies } from 'next/headers';

import './globals.css';
import { AuthProvider } from '@/context/authContext';
import { SyncStripe } from '@/components/shared/syncstripe';
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KLIP',
  description: '🤖 Automatizamos TODO tu contenido en redes',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 🔐 Locale desde cookie (set por changeLocale)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale === 'en' || cookieLocale === 'es' ? cookieLocale : 'es';

  // 🔠 Mensajes del locale seleccionado
  const messages: AbstractIntlMessages = (await import(`../locales/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* 💡 Pre-hidratación del acento (usa la MISMA key que en lib/theme.ts) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    // 👇 AJUSTA esta clave si en lib/theme.ts usas otra (por ejemplo 'accent' o 'klip.accent')
    var STORAGE_KEY = 'accent';
    var a = localStorage.getItem(STORAGE_KEY) || 'blue';
    var root = document.documentElement;

    // Limpia posibles clases accent-* y aplica la actual
    var cls = root.className.split(' ').filter(function(c){return c && c.indexOf('accent-') !== 0;});
    cls.push('accent-' + a);
    root.className = cls.join(' ').trim();
  } catch (e) {}
})();`,
          }}
        />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AuthProvider>
              <SyncStripe />
              {children}
            </AuthProvider>
            <Toaster position="bottom-right" />
            <div id="recaptcha-container" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
