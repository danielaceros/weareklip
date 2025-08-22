// src/app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { cookies } from "next/headers";

import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { SyncStripe } from "@/components/shared/syncstripe";
import { Toaster } from "react-hot-toast";
import LocaleBootstrap from "@/components/i18n/LocaleBootstrap";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KLIP",
  description: "🤖 Automatizamos TODO tu contenido en redes",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ En tu versión, cookies() es async -> usa await
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale =
    cookieLocale === "en" || cookieLocale === "es" || cookieLocale === "fr"
      ? cookieLocale
      : "es";

  // 🔠 Carga de mensajes del locale seleccionado
  const messages: AbstractIntlMessages = (
    await import(`../locales/${locale}.json`)
  ).default;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* 💡 Pre-hidratación del acento (usa la MISMA key que en lib/theme.ts) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var STORAGE_KEY = 'accent';
    var a = localStorage.getItem(STORAGE_KEY) || 'blue';
    var root = document.documentElement;
    var cls = root.className.split(' ').filter(function(c){return c && c.indexOf('accent-') !== 0;});
    cls.push('accent-' + a);
    root.className = cls.join(' ').trim();
  } catch (e) {}
})();`,
          }}
        />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Detecta y persiste idioma al cargar en cliente */}
          <LocaleBootstrap />

          <NextIntlClientProvider locale={locale} messages={messages}>
            <AuthProvider>
              <SyncStripe />
              {children}
              <CreateReelGlobalButton />
            </AuthProvider>
            <Toaster position="top-center" />
            <div id="recaptcha-container" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
