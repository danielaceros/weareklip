// src/components/shared/ApiErrorHandler.tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function ApiErrorHandler() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const res = await originalFetch(...args);

      if (res.status === 429) {
        toast.error("🚦 Has hecho demasiadas peticiones, espera un momento.");
      }

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null; // no renderiza nada, solo intercepta
}

