"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useUserFlags from "@/hooks/useUserFlags";
import { Spinner } from "@/components/ui/shadcn-io/spinner";

export default function DashboardTermsGuard({ children }: { children: React.ReactNode }) {
  const { loading, isTermsAccepted, onboardingCompleted } = useUserFlags();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const inDashboard = pathname.startsWith("/dashboard");
    const inOnboarding = pathname.startsWith("/dashboard/onboarding");

    // 🔒 Si está en dashboard (fuera de onboarding) pero le falta algo → forzar onboarding
    if (inDashboard && !inOnboarding) {
      if (!isTermsAccepted || !onboardingCompleted) {
        router.replace("/dashboard/onboarding");
      }
    }

    // ✅ Si está en onboarding pero ya completó todo → redirigir al dashboard normal
    if (inOnboarding && isTermsAccepted && onboardingCompleted) {
      router.replace("/dashboard");
    }
  }, [loading, isTermsAccepted, onboardingCompleted, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
