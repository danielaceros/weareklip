"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { FileDown, CreditCard, Pause, XCircle, Loader2 } from "lucide-react";

interface StripeSubscription {
  status: string;
  plan: string;
  current_period_end: number | null;
  amount: number | null;
  interval: string;
  currency: string;
  cancel_at_period_end: boolean;
}

interface StripeInvoice {
  id: string;
  created: number;
  amount_paid: number;
  currency: string;
  url: string;
}

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

export default function FacturacionPage() {
  const [sub, setSub] = useState<StripeSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    const loadSub = async () => {
      setLoadingSub(true);
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          setLoadingSub(false);
          return;
        }
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/stripe/subscription", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("No se pudo obtener la suscripción");
          const data = await res.json();
          setSub(data);
        } catch (err) {
          console.error("Error obteniendo suscripción:", err);
          setSub(null);
        } finally {
          setLoadingSub(false);
        }
      });
    };

    const loadInvoices = async () => {
      setLoadingInvoices(true);
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          setLoadingInvoices(false);
          return;
        }
        try {
          // const token = await user.getIdToken(); // Comentado porque no se usa en la demo
          // En producción llama a /api/stripe/invoices
          // Aquí simulamos
          setTimeout(() => {
            setInvoices([
              {
                id: "in_001",
                created: Date.now() / 1000 - 3600 * 24 * 32,
                amount_paid: 2900,
                currency: "eur",
                url: "#",
              },
              {
                id: "in_002",
                created: Date.now() / 1000 - 3600 * 24 * 62,
                amount_paid: 2900,
                currency: "eur",
                url: "#",
              },
            ]);
            setLoadingInvoices(false);
          }, 800);
        } catch (err) {
          console.error("Error obteniendo facturas:", err);
          setInvoices([]);
          setLoadingInvoices(false);
        }
      });
    };

    loadSub();
    loadInvoices();
  }, []);

  return (
    <div className="min-h-[85vh] flex flex-col items-center bg-gradient-to-br from-white to-blue-50 py-10 px-2">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-10">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="text-blue-600" size={28} />
          <h1 className="text-3xl font-bold">Facturación y Suscripciones</h1>
        </div>
        <p className="mb-8 text-gray-600 max-w-lg">
          Consulta y gestiona tu suscripción, descarga tus facturas y gestiona
          tu plan de forma sencilla.
        </p>

        {/* Detalles de suscripción */}
        <section className="border rounded-2xl p-6 mb-8 bg-gradient-to-r from-blue-50 via-white to-blue-50 shadow">
          <h2 className="text-xl font-semibold mb-3">Mi suscripción</h2>
          {loadingSub ? (
            <div className="flex items-center gap-2 text-blue-400">
              <Loader2 className="animate-spin" size={20} /> Cargando
              suscripción...
            </div>
          ) : !sub ? (
            <div className="text-gray-500">
              No tienes ninguna suscripción activa.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Estado:</span>
                <span
                  className={clsx(
                    "px-3 py-1 rounded-full text-sm border",
                    getStatusChipStyle(sub.status)
                  )}
                >
                  {sub.status}
                </span>
                {sub.cancel_at_period_end && (
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded ml-2">
                    Cancelada al finalizar el periodo
                  </span>
                )}
              </div>
              <div>
                <span className="font-medium">Plan:</span>{" "}
                <span className="text-blue-600 font-semibold">{sub.plan}</span>
              </div>
              <div>
                <span className="font-medium">Precio:</span>{" "}
                <span>
                  {sub.amount
                    ? `${sub.amount.toFixed(
                        2
                      )} ${sub.currency.toUpperCase()} / ${sub.interval}`
                    : "No disponible"}
                </span>
              </div>
              <div>
                <span className="font-medium">Renovación:</span>{" "}
                <span>
                  {sub.current_period_end
                    ? new Date(
                        sub.current_period_end * 1000
                      ).toLocaleDateString("es-ES")
                    : "No disponible"}
                </span>
              </div>
              <Button asChild className="mt-2" variant="secondary">
                <a
                  href="https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Gestionar suscripción en Stripe
                </a>
              </Button>
              <div className="flex gap-2 mt-4">
                <Button variant="outline">
                  <Pause size={16} className="mr-2" /> Pausar suscripción
                </Button>
                <Button variant="destructive">
                  <XCircle size={16} className="mr-2" /> Cancelar suscripción
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Facturas */}
        <section className="border rounded-2xl p-6 bg-gradient-to-r from-yellow-50 to-white shadow">
          <h2 className="text-xl font-semibold mb-3">Facturas recientes</h2>
          {loadingInvoices ? (
            <div className="flex items-center gap-2 text-yellow-500">
              <Loader2 className="animate-spin" size={20} /> Cargando
              facturas...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-gray-400">No hay facturas disponibles.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1 px-2">Fecha</th>
                    <th className="py-1 px-2">Importe</th>
                    <th className="py-1 px-2">Descargar</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2 px-2">
                        {new Date(inv.created * 1000).toLocaleDateString(
                          "es-ES"
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {(inv.amount_paid / 100).toFixed(2)}{" "}
                        {inv.currency.toUpperCase()}
                      </td>
                      <td className="py-2 px-2">
                        <a
                          href={inv.url}
                          download
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                        >
                          <FileDown size={16} /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Cambiar de plan */}
        <section className="mt-8 text-center">
          <h2 className="text-xl font-semibold mb-2">
            ¿Quieres mejorar tu plan?
          </h2>
          <Button className="mt-2" variant="default">
            Cambiar de plan
          </Button>
        </section>
      </div>
    </div>
  );
}
