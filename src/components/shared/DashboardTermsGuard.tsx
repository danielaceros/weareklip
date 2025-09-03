"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useTermsAccepted from "@/hooks/useTermsAccepted";
import { Spinner } from "@/components/ui/shadcn-io/spinner";

export default function DashboardTermsGuard({ children }: { children: React.ReactNode }) {
  const { loading, accepted } = useTermsAccepted();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // 👉 si está en dashboard pero no en onboarding, y no aceptó términos → redirige
      if (pathname.startsWith("/dashboard") && !pathname.startsWith("/dashboard/onboarding")) {
        if (!accepted) {
          router.replace("/dashboard/onboarding");
        }
      }
    }
  }, [loading, accepted, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
