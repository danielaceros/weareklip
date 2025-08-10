// src/app/dashboard/facturacion/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { FileDown, CreditCard, Pause, XCircle, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

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

// chips con soporte dark
const getStatusChipStyle = (status: string) => {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
    case "trialing":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800";
    case "past_due":
      return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
    case "unpaid":
      return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
    case "canceled":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export default function FacturacionPage() {
  const t = useT();

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
          // demo
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
    <div className="min-h-[85vh] flex flex-col items-center bg-background py-10 px-2">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-sm p-10 text-foreground">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="text-primary" size={28} />
          <h1 className="text-3xl font-bold">{t("billing.title")}</h1>
        </div>
        <p className="mb-8 text-muted-foreground max-w-lg">{t("billing.subtitle")}</p>

        {/* Detalles de suscripción */}
        <section className="border border-border rounded-2xl p-6 mb-8 bg-muted/40">
          <h2 className="text-xl font-semibold mb-3">{t("billing.mySubscription")}</h2>
          {loadingSub ? (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="animate-spin" size={20} /> {t("billing.loadingSubscription")}
            </div>
          ) : !sub ? (
            <div className="text-muted-foreground">{t("billing.noSubscription")}</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("billing.status")}:</span>
                <span
                  className={clsx(
                    "px-3 py-1 rounded-full text-sm border",
                    getStatusChipStyle(sub.status)
                  )}
                >
                  {sub.status}
                </span>
                {sub.cancel_at_period_end && (
                  <span className="text-xs bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200 px-2 py-1 rounded ml-2">
                    {t("billing.cancelAtPeriodEnd")}
                  </span>
                )}
              </div>

              <div>
                <span className="font-medium">{t("billing.plan")}:</span>{" "}
                <span className="text-primary font-semibold">{sub.plan}</span>
              </div>

              <div>
                <span className="font-medium">{t("billing.price")}:</span>{" "}
                <span>
                  {sub.amount
                    ? `${sub.amount.toFixed(2)} ${sub.currency.toUpperCase()} / ${sub.interval}`
                    : t("billing.notAvailable")}
                </span>
              </div>

              <div>
                <span className="font-medium">{t("billing.renewal")}:</span>{" "}
                <span>
                  {sub.current_period_end
                    ? new Date(sub.current_period_end * 1000).toLocaleDateString()
                    : t("billing.notAvailable")}
                </span>
              </div>

              <Button asChild className="mt-2" variant="secondary">
                <a
                  href="https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("billing.manageSubscription")}
                </a>
              </Button>

              <div className="flex gap-2 mt-4">
                <Button variant="outline">
                  <Pause size={16} className="mr-2" /> {t("billing.pause")}
                </Button>
                <Button variant="destructive">
                  <XCircle size={16} className="mr-2" /> {t("billing.cancel")}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Facturas */}
        <section className="border border-border rounded-2xl p-6 bg-muted/40">
          <h2 className="text-xl font-semibold mb-3">{t("billing.recentInvoices")}</h2>
          {loadingInvoices ? (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Loader2 className="animate-spin" size={20} /> {t("billing.loadingInvoices")}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-muted-foreground">{t("billing.noInvoices")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-1 px-2">{t("billing.date")}</th>
                    <th className="py-1 px-2">{t("billing.amount")}</th>
                    <th className="py-1 px-2">{t("billing.download")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/60">
                      <td className="py-2 px-2">
                        {new Date(inv.created * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-2">
                        {(inv.amount_paid / 100).toFixed(2)} {inv.currency.toUpperCase()}
                      </td>
                      <td className="py-2 px-2">
                        <a
                          href={inv.url}
                          download
                          className="inline-flex items-center gap-1 text-primary hover:underline"
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
          <h2 className="text-xl font-semibold mb-2">{t("billing.upgradeTitle")}</h2>
          <Button className="mt-2">{t("billing.changePlan")}</Button>
        </section>
      </div>
    </div>
  );
}
