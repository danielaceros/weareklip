import "@/app/globals.css";
import { Sidebar } from "@/components/shared/Sidebar";
import PaywallClickGuard from "@/components/billing/PaywallClickGuard";
import { ReactNode } from "react";
import { Topbar } from "@/components/shared/Topbar";
import FloatingActions from "@/components/wizard/CreateReelGlobalButton";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar persistente */}
      <Sidebar aria-label="Menú lateral del dashboard" />

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col relative bg-muted">
        {/* Paywall que bloquea clicks si es necesario */}
        <PaywallClickGuard />

        {/* Barra superior */}
        <Topbar />

        {/* Contenido del dashboard (scroll si se necesita) */}
        <main className="flex-1 max-w-9xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* Botones flotantes (crear reel + notificaciones) */}
      <FloatingActions />
    </div>
  );
}
