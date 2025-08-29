// src/app/dashboard/layout.tsx
import "@/app/globals.css";
import { Sidebar } from "@/components/shared/Sidebar";
import PaywallClickGuard from "@/components/billing/PaywallClickGuard";
import { ReactNode } from "react";
import { Topbar } from "@/components/shared/Topbar";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton";
import DashboardTour from "@/components/onboarding/OnboardingTour";
import FcmInit from "@/components/shared/FcmInit";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar fijo (desktop izquierda / móvil abajo) */}
      <aside className="md:fixed md:top-0 md:left-0 md:h-screen md:z-50">
        <Sidebar aria-label="Menú lateral del dashboard" />
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col md:ml-20">
        {/* Barra superior fija */}
        <header className="fixed top-0 left-0 md:left-20 right-0 z-40 border-b border-border bg-card">
          <Topbar />
        </header>

        {/* Paywall que bloquea clicks si es necesario */}
        <PaywallClickGuard />

        {/* Contenido scrollable */}
        <main className="flex-1 overflow-y-auto bg-muted pt-20 pb-16 md:pb-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-9xl mx-auto w-full">{children}</div>
        </main>

        <DashboardTour />
      </div>

      {/* Botones flotantes */}
      <CreateReelGlobalButton />

      {/* Inicializa FCM */}
      <FcmInit />
    </div>
  );
}
