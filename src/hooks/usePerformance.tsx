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
    // Asegúrate de que Firebase Performance esté correctamente inicializado
    if (!perf) {
      console.warn("⚠️ Performance no está inicializado o no está soportado en este entorno.");
      return () => {};
    }

    try {
      const t = trace(perf, name);

      // Inicia la traza solo si el nombre es válido
      if (name && name.length > 0) {
        t.start();
      } else {
        console.warn("⚠️ Nombre de traza no válido.");
        return () => {}; // No iniciar la traza si no es válida
      }

      return () => {
        try {
          t.stop(); // Detener la traza una vez que haya terminado
        } catch (err) {
          console.error("Error al detener la traza:", err);
        }
      };
    } catch (err) {
      console.error("Error al iniciar la traza de Performance:", err);
      return () => {}; // Retornar un callback vacío en caso de error
    }
  }, []);

  return { startTrace };
}

