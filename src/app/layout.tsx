// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext"; 
import { SyncStripe } from "@/components/shared/syncstripe"
import { Toaster } from "react-hot-toast"; // Cambiado de sonner a react-hot-toast

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SyncStripe />
          {children}
        </AuthProvider>
        <Toaster position="bottom-right" /> {/* Usando react-hot-toast */}
        <div id="recaptcha-container" />
      </body>
    </html>
  );
}