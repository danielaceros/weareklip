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
    if (sessionStorage.getItem("__klip_syncstripe_done__") === "1") return;

    (async () => {
      const u = auth.currentUser;
      if (!u) return; // solo con sesión

      const isAdmin = await checkIsAdmin(u.uid);
      if (!isAdmin) return; // solo admins

      try {
        const token = await u.getIdToken();
        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: "manual_boot" }),
          keepalive: true,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("❌ Error sync Stripe", res.status, text);
          return;
        }

        console.log("✔️ Stripe sync OK");
        sessionStorage.setItem("__klip_syncstripe_done__", "1");
      } catch (err) {
        console.error("❌ Error sync Stripe", err);
      }
    })();
  }, []);

  return null;
}
