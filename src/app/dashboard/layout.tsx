"use client";

import "@/app/globals.css";
import { Sidebar } from "@/components/shared/Sidebar";
import PaywallClickGuard from "@/components/billing/PaywallClickGuard";
import { ReactNode, useEffect, useState } from "react";
import { Topbar } from "@/components/shared/Topbar";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton";
import DashboardTour from "@/components/onboarding/OnboardingTour";
import FcmInit from "@/components/shared/FcmInit";
import ApiErrorHandler from "@/components/shared/ApiErrorComponent";
import { Spinner } from "@/components/ui/shadcn-io/spinner"; // Importar el Spinner de shadcn

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulación de carga inicial (p. ej. validación de sesión, datos mínimos)
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner /> {/* Spinner de shadcn en lugar de elipses personalizado */}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar aria-label="Menú lateral del dashboard" />

      <div className="flex flex-1 flex-col relative bg-muted">
        <PaywallClickGuard />
        <Topbar />

        <main className="flex-1 max-w-9xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <DashboardTour />
      </div>

      <CreateReelGlobalButton />
      <FcmInit />
      <ApiErrorHandler />
    </div>
  );
}
