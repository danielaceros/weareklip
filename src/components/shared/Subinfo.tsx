"use client";

import { Button } from "@/components/ui/button";
import clsx from "clsx";

interface SubscriptionInfoProps {
  loading: boolean;
  subscription: {
    status: string;
    plan: string;
    current_period_end: number | null;
    amount: number | null;
    interval: string;
    currency: string;
    cancel_at_period_end: boolean;
  } | null;
}

export default function SubscriptionInfo({ loading, subscription }: SubscriptionInfoProps) {
  const getStatusChipStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300";
      case "trialing":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "past_due":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "unpaid":
        return "bg-red-100 text-red-700 border-red-300";
      case "canceled":
        return "bg-gray-200 text-gray-600 border-gray-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  return (
    <section className="border rounded-lg p-4 bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Mi Suscripción</h2>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando suscripción...</p>
      ) : subscription ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Estado:</span>
            <span
              className={clsx(
                "px-3 py-1 rounded-full text-sm border",
                getStatusChipStyle(subscription.status)
              )}
            >
              {subscription.status}
            </span>
          </div>

          <p>
            <strong>Plan:</strong> {subscription.plan}
          </p>
          <p>
            <strong>Precio:</strong>{" "}
            {subscription.amount
              ? `${subscription.amount.toFixed(2)} ${subscription.currency.toUpperCase()} / ${subscription.interval}`
              : "No disponible"}
          </p>
          <p>
            <strong>Renovación:</strong>{" "}
            {subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toLocaleDateString("es-ES")
              : "No disponible"}
          </p>
          <p>
            <strong>Cancelación al final del periodo:</strong>{" "}
            {subscription.cancel_at_period_end ? "Sí" : "No"}
          </p>

          <Button className="mt-4" asChild>
            <a
              href="https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00"
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir portal de facturación
            </a>
          </Button>
        </div>
      ) : (
        <p>No tienes suscripción activa.</p>
      )}
    </section>
  );
}

