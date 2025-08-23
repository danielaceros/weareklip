// src/app/layout.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import {
  NextIntlClientProvider,
  type AbstractIntlMessages,
} from "next-intl";

import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { Toaster } from "@/components/ui/sonner";
import LocaleBootstrap from "@/components/i18n/LocaleBootstrap";
import { SyncStripe } from "@/components/shared/SyncStripe";
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
  // --- Locale seguro ---
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const supportedLocales = ["es", "en", "fr"] as const;
  const defaultLocale: (typeof supportedLocales)[number] = "es";

  const locale = (supportedLocales.includes(
    cookieLocale as (typeof supportedLocales)[number]
  )
    ? cookieLocale
    : defaultLocale) as (typeof supportedLocales)[number];

  let messages: AbstractIntlMessages = {};
  try {
    messages = (await import(`../locales/${locale}.json`)).default;
  } catch {
    // fallback si falta el archivo
    messages = (await import(`../locales/${defaultLocale}.json`)).default;
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Mantener la clase accent-* en <html> */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var root = document.documentElement;
                var a = localStorage.getItem('accent') || 'blue';
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
          <LocaleBootstrap />
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AuthProvider>
              <SyncStripe />
              {children}
            </AuthProvider>
            <Toaster closeButton position="top-center" />
            <div id="recaptcha-container" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
