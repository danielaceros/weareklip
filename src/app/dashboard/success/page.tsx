"use client";  // Asegura que este componente se ejecute solo en el cliente

import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SuccessPage() {
  const [loading, setLoading] = useState(true); // Estado solo para carga

  useEffect(() => {
    // Accede a los parámetros de la URL directamente usando URLSearchParams
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    const quantity = params.get("quantity");

    if (userId && quantity) {
      updateCredits(userId, quantity);
    } else {
      toast.error("Datos inválidos para actualizar los créditos.");
    }
  }, []); // Solo se ejecuta una vez cuando el componente se monta

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
