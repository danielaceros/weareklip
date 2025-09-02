"use client";

import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export default function DashboardTour() {
  useEffect(() => {
    const hasSeenTour = localStorage.getItem("dashboardTourSeen");
    if (hasSeenTour) return;

    const isMobile = window.innerWidth < 768;

    const sidebarSteps: DriveStep[] = isMobile
      ? [
          { element: "#mobile-home", popover: { title: "🏠 Inicio", description: "Aquí ves el resumen general de tu cuenta y entregas.", side: "top", align: "center" } },
          { element: "#mobile-viralIdeas", popover: { title: "✨ Ideas virales", description: "Descubre tendencias de reels y contenidos para inspirarte.", side: "top", align: "center" } },
          { element: "#mobile-scripts", popover: { title: "📜 Guiones", description: "Gestiona los guiones generados con IA y pide cambios.", side: "top", align: "center" } },
          { element: "#mobile-audio", popover: { title: "🎤 Audio", description: "Convierte tu guion en voz realista con IA.", side: "top", align: "center" } },
          { element: "#mobile-lipsync", popover: { title: "🎭 Video con Lipsync", description: "Genera un avatar que sincroniza labios con tu audio.", side: "top", align: "center" } },
          { element: "#mobile-video", popover: { title: "🎬 Edición de video", description: "Edita y mejora tus vídeos con subtítulos y branding.", side: "top", align: "center" } },
          { element: "#mobile-clones", popover: { title: "🧑‍🎤 Clonación", description: "Sube tus vídeos de referencia para entrenar tu clon.", side: "top", align: "center" } },
        ]
      : [
          { element: "#sidebar-home", popover: { title: "🏠 Inicio", description: "Aquí ves el resumen general de tu cuenta y entregas.", side: "right" } },
          { element: "#sidebar-viralIdeas", popover: { title: "✨ Ideas virales", description: "Descubre tendencias de reels y contenidos para inspirarte.", side: "right" } },
          { element: "#sidebar-scripts", popover: { title: "📜 Guiones", description: "Gestiona los guiones generados con IA y pide cambios.", side: "right" } },
          { element: "#sidebar-audio", popover: { title: "🎤 Audio", description: "Convierte tu guion en voz realista con IA.", side: "right" } },
          { element: "#sidebar-lipsync", popover: { title: "🎭 Video con Lipsync", description: "Genera un avatar que sincroniza labios con tu audio.", side: "right" } },
          { element: "#sidebar-video", popover: { title: "🎬 Edición de video", description: "Edita y mejora tus vídeos con subtítulos y branding.", side: "right" } },
          { element: "#sidebar-clones", popover: { title: "🧑‍🎤 Clonación", description: "Sube tus vídeos de referencia para entrenar tu clon.", side: "right" } },
        ];

    const steps: DriveStep[] = [
      ...sidebarSteps,
      {
        element: "#consumo-badge",
        popover: {
          title: "💳 Consumo",
          description: "Aquí puedes ver tu consumo actual, créditos de prueba y operaciones.",
          side: "bottom",
        },
      },
      {
        element: "#user-dropdown",
        popover: {
          title: "👤 Usuario",
          description: "En este menú puedes gestionar tu cuenta, idioma y cerrar sesión.",
          side: "bottom",
        },
      },
    ];

    // 👉 Esperar a que existan todos los elementos antes de arrancar el tour
    const waitForElements = (selectors: string[], callback: () => void, retries = 20) => {
      const allPresent = selectors.every((sel) => document.querySelector(sel));
      if (allPresent) {
        callback();
      } else if (retries > 0) {
        setTimeout(() => waitForElements(selectors, callback, retries - 1), 500);
      } else {
        console.warn("⚠️ DashboardTour: no se encontraron algunos elementos del tour");
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
  }, []);

  return null;
}
