"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export default function DashboardTour() {
  useEffect(() => {
    // solo lo lanzamos en la primera visita
    const hasSeenTour = localStorage.getItem("dashboardTourSeen");
    if (hasSeenTour) return;

    const tour = driver({
      showProgress: true,
      allowClose: true,
      steps: [
        // -------- Sidebar --------
        {
          element: "#sidebar-home",
          popover: {
            title: "🏠 Inicio",
            description: "Aquí ves el resumen general de tu cuenta y entregas.",
            side: "right",
          },
        },
        {
          element: "#sidebar-viralIdeas",
          popover: {
            title: "✨ Ideas virales",
            description: "Descubre tendencias de reels y contenidos para inspirarte.",
            side: "right",
          },
        },
        {
          element: "#sidebar-scripts",
          popover: {
            title: "📜 Guiones",
            description: "Gestiona los guiones generados con IA y pide cambios.",
            side: "right",
          },
        },
        {
          element: "#sidebar-audio",
          popover: {
            title: "🎤 Audio",
            description: "Convierte tu guion en voz realista con IA.",
            side: "right",
          },
        },
        {
          element: "#sidebar-lipsync",
          popover: {
            title: "🎭 Video con Lipsync",
            description: "Genera un avatar que sincroniza labios con tu audio.",
            side: "right",
          },
        },
        {
          element: "#sidebar-video",
          popover: {
            title: "🎬 Edición de video",
            description: "Edita y mejora tus vídeos con subtítulos y branding.",
            side: "right",
          },
        },
        {
          element: "#sidebar-clones",
          popover: {
            title: "🧑‍🎤 Clonación",
            description: "Sube tus vídeos de referencia para entrenar tu clon.",
            side: "right",
          },
        },

        // -------- Topbar --------
        {
          element: "#consumo-badge",
          popover: {
            title: "💳 Consumo",
            description:
              "Aquí puedes ver tu consumo actual, créditos de prueba y operaciones.",
            side: "bottom",
          },
        },
        {
          element: "#user-dropdown",
          popover: {
            title: "👤 Usuario",
            description:
              "En este menú puedes gestionar tu cuenta, idioma y cerrar sesión.",
            side: "bottom",
          },
        },

        // -------- Floating buttons --------
        {
          element: "#btn-create-reel",
          popover: {
            title: "🚀 Crear reel",
            description: "Con este botón puedes crear un nuevo reel en cualquier momento.",
          },
        },
        {
          element: "#btn-notifications",
          popover: {
            title: "🚨 Notificaciones",
            description:
              "Aquí verás alertas importantes y mensajes sobre tu contenido.",
          },
        },
      ],
    });

    tour.drive();
    localStorage.setItem("dashboardTourSeen", "true");
  }, []);

  return null;
}
