// src/app/dashboard/success/page.tsx
"use client"
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-3xl font-bold">¡Pago exitoso!</h1>
      <p className="text-lg">
        ¡Gracias por tu compra! Tu pago ha sido procesado exitosamente.
      </p>
      <Button
        onClick={() => router.push("/dashboard")}
        className="mt-4"
      >
        Regresar al dashboard
      </Button>
    </div>
  );
}
