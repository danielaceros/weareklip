"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getAuth } from "firebase/auth";
import firebaseApp from "@/lib/firebase" // Asegúrate de que esta sea la ruta correcta

export default function BillingPage() {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Obtener el email del usuario autenticado
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email); // Si hay un usuario autenticado, obtenemos su email
    } else {
      setUserEmail(null);
      toast.error("No estás autenticado. Por favor, inicia sesión.");
    }
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    const priceId = process.env.NEXT_PUBLIC_STRIPE_ONE_TIME_PRICE_ID;
    if (!priceId || !userEmail) {
      toast.error("No se ha configurado el precio o no estás autenticado.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity,
          priceId,
          email: userEmail,  // Pasamos el correo del usuario autenticado
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.assign(data.url);
      } else {
        toast.error("No se pudo iniciar el checkout.");
      }
    } catch (error) {
      console.error("Error en checkout:", error);
      toast.error("Hubo un error al procesar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-3xl font-bold">Comprar reels IA</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pedido personalizado</CardTitle>
          <CardDescription>
            Cada reel cuesta <strong>15€</strong>. Puedes seleccionar cuántos deseas comprar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium" htmlFor="quantity">
              Cantidad:
            </label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-20"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Total: <strong>{15 * quantity}€</strong>
          </p>
          <Button
            className="w-full"
            onClick={handleCheckout}
            disabled={loading || quantity < 1}
          >
            {loading ? "Redirigiendo..." : `Comprar ${quantity} reel${quantity > 1 ? "s" : ""}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
