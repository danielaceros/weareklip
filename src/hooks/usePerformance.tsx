"use client";

import { useCallback } from "react";
import { perf } from "@/lib/firebase";
import { trace } from "firebase/performance";

/**
 * Hook para crear trazas personalizadas con Firebase Performance
 *
 * Ejemplo:
 * const { startTrace } = usePerformance();
 *
 * const loadData = async () => {
 *   const endTrace = startTrace("cargar_voces");
 *   await fetch("/api/voices");
 *   endTrace(); // cierra y envía la traza
 * };
 */
export function usePerformance() {
  const startTrace = useCallback((name: string) => {
    if (!perf) {
      console.warn("⚠️ Performance no está inicializado o no está soportado en este entorno.");
      return () => {};
    }

    try {
      const t = trace(perf, name);
      t.start();

      return () => {
        try {
          t.stop();
        } catch (err) {
          console.error("Error al detener la traza:", err);
        }
      };
    } catch (err) {
      console.error("Error al iniciar la traza de Performance:", err);
      return () => {};
    }
  }, []);

  return { startTrace };
}
