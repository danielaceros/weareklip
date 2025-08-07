import React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import getRequestConfig from '../i18n/request';
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
  // En servidor: obtén locale y mensajes
  const { locale, messages } = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <SyncStripe />
            {children}
          </AuthProvider>
          <Toaster position="bottom-right" />
          <div id="recaptcha-container" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
