"use client";

import "@/app/globals.css";
import { Sidebar } from "@/components/shared/Sidebar";
import PaywallClickGuard from "@/components/billing/PaywallClickGuard";
import { ReactNode, useEffect, useState } from "react";
import { Topbar } from "@/components/shared/Topbar";
import CreateReelGlobalButtonPortal from "@/components/shared/CreateReelGlobalButtonPortal";
import DashboardTour from "@/components/onboarding/OnboardingTour";
import FcmInit from "@/components/shared/FcmInit";
import ApiErrorHandler from "@/components/shared/ApiErrorComponent";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import DashboardTermsGuard from "@/components/shared/DashboardTermsGuard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner />
      </div>
    );
  }

  return (
    <DashboardTermsGuard>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Sidebar fijo */}
        <div className="hidden md:block fixed inset-y-0 left-0 w-20 border-r bg-sidebar border-sidebar-border z-40">
          <Sidebar aria-label="Menú lateral del dashboard" />
        </div>

        {/* Contenedor principal */}
        <div className="flex flex-1 flex-col md:ml-20">
          <PaywallClickGuard>
            {/* Topbar fijo */}
            <div className="fixed top-0 left-0 md:left-20 right-0 z-30">
              <Topbar />
            </div>

            {/* Contenido scrollable */}
            <main className="flex-1 overflow-y-auto pt-14 px-4 sm:px-6 lg:px-8 bg-muted">
              <div className="max-w-9xl mx-auto py-6">{children}</div>
            </main>

            <DashboardTour />
          </PaywallClickGuard>
        </div>
      </div>

      {/* Botón global fuera del flujo */}
      <CreateReelGlobalButtonPortal />
      <FcmInit />
      <ApiErrorHandler />
    </DashboardTermsGuard>
  );
}

