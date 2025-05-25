"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SuccessPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    // This will only run on the client side
    setIsClient(true);
  }, []);

  const userId = searchParams?.get('userId');
  const quantity = searchParams?.get('quantity');

  useEffect(() => {
    if (userId && quantity) {
      updateCredits(userId, quantity);
    }
  }, [userId, quantity]);

  const updateCredits = async (userId: string | null, quantity: string | null) => {
    if (!userId || !quantity) {
      toast.error("Datos inválidos para actualizar los créditos.");
      return;
    }
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
        window.location.href = "/dashboard"; // Redirigir al dashboard
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
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <p>Gracias por tu compra, tus créditos han sido actualizados.</p>
      )}
    </div>
  );
}
