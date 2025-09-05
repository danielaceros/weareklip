// src/app/layout.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Roboto_Mono } from "next/font/google";
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
import { ClientLayout } from "@/components/layout/ClientLayout";

// ✅ Fuentes desde Google Fonts
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "KLIP",
  description: "🤖 Automatizamos TODO tu contenido en redes",
  manifest: "/manifest.json",
  themeColor: "#000000",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    messages = (await import(`../locales/${defaultLocale}.json`)).default;
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Script para manejar "accent" */}
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

        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
        {/* End Meta Pixel Code */}

        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="KLIP" />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>
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
              <ClientLayout>{children}</ClientLayout>
            </AuthProvider>
            <Toaster closeButton position="top-center" />
            <div id="recaptcha-container" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
