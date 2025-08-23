// src/app/dashboard/layout.tsx
import "@/app/globals.css";
import { Sidebar } from "@/components/shared/Sidebar";
import { NotificationFloatingWrapper } from "@/components/shared/Floating";
import ZohoDeskScript from "@/components/shared/ZohoDeskScript";
import PaywallClickGuard from "@/components/billing/PaywallClickGuard";
import { ReactNode } from "react";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar persistente */}
      <Sidebar aria-label="Menú lateral del dashboard" />

      {/* Contenido principal */}
      <main
        className="flex-1 relative bg-muted overflow-y-auto"
        role="main"
        aria-label="Área principal del dashboard"
      >
        {/* Paywall que bloquea clicks si es necesario */}
        <PaywallClickGuard />

        {/* Contenido del dashboard */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
          <CreateReelGlobalButton />
        </div>

        {/* Script de soporte (mejor al final para no bloquear render) */}
        <ZohoDeskScript />
      </main>

      {/* Notificaciones flotantes */}
      <NotificationFloatingWrapper />
    </div>
  );
}
