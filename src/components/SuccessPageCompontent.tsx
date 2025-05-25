"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SuccessPageComponent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const userId = searchParams?.get("userId");
      const quantity = searchParams?.get("quantity");

      if (userId && quantity) {
        updateCredits(userId, quantity);
      } else {
        toast.error("Datos inválidos para actualizar los créditos.");
      }
    }
  }, [searchParams, isClient]);

  const updateCredits = async (userId: string, quantity: string) => {
    try {
      const response = await fetch("/api/stripe/confirm-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, quantity }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Compra exitosa! Tus créditos han sido actualizados.");
        window.location.href = "/dashboard";
      } else {
        toast.error("Hubo un error al actualizar tus créditos.");
      }
    } catch {
      toast.error("Error al procesar la compra.");
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      {loading ? <p>Cargando...</p> : <p>Gracias por tu compra, tus créditos han sido actualizados.</p>}
    </div>
  );
}
