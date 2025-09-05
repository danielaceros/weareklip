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

    const timeout = setTimeout(() => {
      const inDashboard = pathname.startsWith("/dashboard");
      const inOnboarding = pathname.startsWith("/onboarding");

      if (inDashboard && !inOnboarding) {
        if (!isTermsAccepted || !onboardingCompleted) {
          router.replace("/onboarding");
        }
      }

      if (inOnboarding && isTermsAccepted && onboardingCompleted) {
        router.replace("/dashboard");
      }
    }, 400); // 👈 da tiempo a que Firestore actualice

    return () => clearTimeout(timeout);
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
