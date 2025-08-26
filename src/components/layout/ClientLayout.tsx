"use client";

import { usePageTracking } from "@/hooks/usePageTracking";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  // Aquí activamos el tracking de GA4
  usePageTracking();
  return <>{children}</>;
}
