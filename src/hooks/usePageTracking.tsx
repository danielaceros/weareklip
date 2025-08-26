"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";

export function usePageTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!analytics || !pathname) return;

    // Llamamos a GA4 para registrar un page_view
    logEvent(analytics, "page_view", {
      page_path: pathname,
      page_location: window.location.href,
    });

    // Si quieres, también puedes enviar un custom event tipo "screen_view":
    // logEvent(analytics, "screen_view", { screen_name: pathname });

    console.log("📊 GA4 page_view:", pathname);
  }, [pathname, searchParams]);
}
