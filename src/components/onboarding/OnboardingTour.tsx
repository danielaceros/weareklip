// src/components/dashboard/DashboardTour.tsx
"use client";

import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useT } from "@/lib/i18n";

export default function DashboardTour() {
  const t = useT();

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("dashboardTourSeen");
    if (hasSeenTour) return;

    const isMobile = window.innerWidth < 768;

    // Sidebar steps (móvil vs desktop)
    const sidebarItems = [
      { id: isMobile ? "#mobile-home" : "#sidebar-home", k: "home" },
      { id: isMobile ? "#mobile-viralIdeas" : "#sidebar-viralIdeas", k: "viralIdeas" },
      { id: isMobile ? "#mobile-scripts" : "#sidebar-scripts", k: "scripts" },
      { id: isMobile ? "#mobile-audio" : "#sidebar-audio", k: "audio" },
      { id: isMobile ? "#mobile-lipsync" : "#sidebar-lipsync", k: "lipsync" },
      { id: isMobile ? "#mobile-video" : "#sidebar-video", k: "video" },
      { id: isMobile ? "#mobile-clones" : "#sidebar-clones", k: "clones" },
    ] as const;

    const sidebarSteps: DriveStep[] = sidebarItems.map(({ id, k }) => ({
      element: id,
      popover: {
        title: t(`tour.dashboard.sidebar.${k}.title`),
        description: t(`tour.dashboard.sidebar.${k}.description`),
        side: isMobile ? "top" : "right",
        ...(isMobile ? { align: "center" as const } : {}),
      },
    }));

    const steps: DriveStep[] = [
      ...sidebarSteps,
      {
        element: "#consumo-badge",
        popover: {
          title: t("tour.dashboard.badges.consumo.title"),
          description: t("tour.dashboard.badges.consumo.description"),
          side: "bottom",
        },
      },
      {
        element: "#user-dropdown",
        popover: {
          title: t("tour.dashboard.userMenu.title"),
          description: t("tour.dashboard.userMenu.description"),
          side: "bottom",
        },
      },
    ];

    // Esperar a que existan todos los elementos antes de arrancar el tour
    const waitForElements = (
      selectors: string[],
      callback: () => void,
      retries = 20
    ) => {
      const allPresent = selectors.every((sel) => document.querySelector(sel));
      if (allPresent) {
        callback();
      } else if (retries > 0) {
        setTimeout(() => waitForElements(selectors, callback, retries - 1), 500);
      } else {
        console.warn(t("tour.dashboard.warn.missingElements"));
      }
    };

    const selectors = steps.map((s) => s.element as string);

    waitForElements(selectors, () => {
      const tour = driver({
        showProgress: true,
        allowClose: true,
        steps,
      });
      tour.drive();
      localStorage.setItem("dashboardTourSeen", "true");
    });
  }, [t]);

  return null;
}
