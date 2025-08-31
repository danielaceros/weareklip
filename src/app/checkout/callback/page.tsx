"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

export default function CheckoutCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get("next") || "/dashboard";
  const success = searchParams.get("success");
  const cancel = searchParams.get("cancel");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (success) toast.success("¡Suscripción completada!");
        if (cancel) toast.warning("Has cancelado el proceso de pago.");
        router.replace(next);
      } else {
        toast.error("Debes iniciar sesión para continuar.");
        router.replace("/login");
      }
    });

    return () => unsub();
  }, [router, success, cancel, next]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Comprobando tu sesión...</p>
    </div>
  );
}
