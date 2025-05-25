import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const userId = searchParams!.get('userId');
  const quantity = searchParams!.get('quantity');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && quantity) {
      updateCredits();
    }
  }, [userId, quantity]);

  const updateCredits = async () => {
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
    } catch (error) {
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
