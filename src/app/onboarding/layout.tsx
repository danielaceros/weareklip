// src/app/onboarding/layout.tsx
"use client";

import "@/app/globals.css";
import { ReactNode, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import DashboardTermsGuard from "@/components/shared/DashboardTermsGuard";
import FcmInit from "@/components/shared/FcmInit";
import ApiErrorHandler from "@/components/shared/ApiErrorComponent";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⏳ Pequeño delay como en el dashboard
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
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        {/* 📌 Contenedor centrado */}
        <div className="w-full max-w-4xl">
          {children}
        </div>
      </div>

      {/* 🔧 Inicializaciones globales */}
      <FcmInit />
      <ApiErrorHandler />
    </DashboardTermsGuard>
  );
}
