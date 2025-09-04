"use client";

import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { checkIsAdmin } from "@/lib/users";

export function SyncStripe() {
  const ran = useRef(false);

  useEffect(() => {
    // Evita doble ejecución de StrictMode y re-montajes
    if (ran.current) return;
    ran.current = true;

    // Evita repetir en la MISMA pestaña
    if (sessionStorage.getItem("__klip_billing_refresh_done__") === "1") return;

    (async () => {
      const u = auth.currentUser;
      if (!u) return; // solo con sesión

      const isAdmin = await checkIsAdmin(u.uid);
      if (!isAdmin) return; // solo admins

      try {
        const token = await u.getIdToken();
        // Ruta existente mantenida por compatibilidad backend
        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: "boot" }),
          keepalive: true,
        });

        if (!res.ok) {
          if (process.env.NODE_ENV !== "production") {
            console.error("❌ Error actualizando la suscripción");
          }
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("✔️ Suscripción actualizada");
        }
        sessionStorage.setItem("__klip_billing_refresh_done__", "1");
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console.error("❌ Error actualizando la suscripción");
        }
      }
    })();
  }, []);

  return null;
}

