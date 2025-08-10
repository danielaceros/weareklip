"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  PlusCircle,
  Loader2,
  Info,
  BadgeDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useT } from "@/lib/i18n";

const PLAN_LIMIT = 4;
const PRECIO_EXTRA = 19.99;

export default function ReelExtraPage() {
  const t = useT();
  const [usados, setUsados] = useState(0);
  const [planLimit, setPlanLimit] = useState(PLAN_LIMIT);
  const [solicitado, setSolicitado] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        // Simulación
        setUsados(4);
        setPlanLimit(PLAN_LIMIT);
      } catch (err) {
        console.error("Error leyendo créditos:", err);
        setUsados(PLAN_LIMIT);
      }
    });
    return () => unsub();
  }, []);

  const handleSolicitar = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSolicitado(true);
      toast.success(t("extraReelPage.requestSentTitle"));
    }, 1500);
  };

  const sinCreditos = usados >= planLimit;

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-sm p-8 text-foreground">
        <PlusCircle className="text-primary mb-3 mx-auto" size={40} />
        <h1 className="text-2xl font-bold mb-2 text-center">
          {t("extraReelPage.title")}
        </h1>

        <p className="text-muted-foreground mb-6 text-center">
          {sinCreditos
            ? t("extraReelPage.limitReached")
            : t("extraReelPage.creditsRemaining")}
        </p>

        {/* Info del consumo */}
        <div className="mb-6 w-full flex flex-col items-center gap-2">
          <span className="text-md font-medium">
            {t("extraReelPage.reelsUsed", { used: usados, limit: planLimit })}
          </span>

          {sinCreditos && (
            <span className="inline-flex items-center gap-1 text-sm rounded-full px-3 py-1
                             bg-amber-500/15 text-amber-500">
              <Info size={16} /> {t("extraReelPage.noCredits")}
            </span>
          )}
        </div>

        {/* CTA */}
        {sinCreditos ? (
          !solicitado ? (
            <Button
              className="w-full flex items-center justify-center gap-2 px-6 py-6 text-base font-semibold"
              onClick={handleSolicitar}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t("extraReelPage.processing")}
                </>
              ) : (
                <>
                  <BadgeDollarSign size={20} />
                  {t("extraReelPage.requestButton")}
                  <span className="ml-1 font-bold opacity-90">
                    {t("extraReelPage.price", { price: PRECIO_EXTRA })}
                  </span>
                </>
              )}
            </Button>
          ) : (
            <div className="flex flex-col items-center mt-4">
              <CheckCircle2 className="text-emerald-500 mb-2" size={40} />
              <span className="text-emerald-600 font-semibold text-center">
                {t("extraReelPage.requestSentBody")}
              </span>
            </div>
          )
        ) : (
          <div className="text-emerald-500 font-semibold flex items-center gap-2 justify-center">
            <CheckCircle2 size={20} /> {t("extraReelPage.creditsAvailable")}
          </div>
        )}
      </div>
    </div>
  );
}
