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

const PLAN_LIMIT = 4; // Por ejemplo, 4 reels/mes (pon aquí el límite de tu plan)
const PRECIO_EXTRA = 19.99; // Precio ficticio del reel extra

export default function ReelExtraPage() {
  const [usados, setUsados] = useState(0);
  const [planLimit, setPlanLimit] = useState(PLAN_LIMIT);
  const [solicitado, setSolicitado] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Simula consulta a la BD del usuario para saber cuántos reels ha usado este mes
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        // Aquí deberías consultar tu Firestore para saber los reels usados este mes
        // Por ahora, simulamos: el usuario ya ha consumido todos los créditos
        setUsados(4);
        setPlanLimit(PLAN_LIMIT);
      } catch (err) {
        console.error("Error leyendo créditos:", err);
        setUsados(PLAN_LIMIT);
      }
    });
  }, []);

  const handleSolicitar = async () => {
    setIsProcessing(true);
    // Aquí integrarías Stripe o lógica de créditos
    setTimeout(() => {
      setIsProcessing(false);
      setSolicitado(true);
      toast.success("¡Solicitud de reel extra enviada!");
    }, 1500);
  };

  const sinCreditos = usados >= planLimit;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-lg flex flex-col items-center">
        <PlusCircle className="text-blue-500 mb-3" size={40} />
        <h1 className="text-2xl font-bold mb-2 text-center">
          Solicitar Reel Extra
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          {sinCreditos
            ? "Has alcanzado tu límite de reels este mes. Puedes solicitar uno extra pagando de forma individual o usando tus créditos extra según tu plan."
            : "Aún te quedan reels disponibles este mes."}
        </p>

        {/* Info del consumo */}
        <div className="mb-6 w-full flex flex-col items-center gap-2">
          <span className="text-md font-medium">
            Reels usados este mes:{" "}
            <span className="font-bold text-blue-600">
              {usados}/{planLimit}
            </span>
          </span>
          {sinCreditos && (
            <span className="inline-flex items-center gap-1 text-sm text-orange-700 bg-orange-100 rounded-full px-3 py-1">
              <Info size={16} /> Sin créditos disponibles
            </span>
          )}
        </div>

        {/* Botón de solicitar reel extra */}
        {sinCreditos ? (
          !solicitado ? (
            <Button
              className="flex items-center gap-2 px-6 py-3 text-lg font-semibold"
              onClick={handleSolicitar}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  Procesando...
                </>
              ) : (
                <>
                  <BadgeDollarSign size={22} /> Solicitar Reel Extra{" "}
                  <span className="text-base text-blue-700 font-bold ml-1">
                    ({PRECIO_EXTRA} €)
                  </span>
                </>
              )}
            </Button>
          ) : (
            <div className="flex flex-col items-center mt-4">
              <CheckCircle2 className="text-green-500 mb-2" size={40} />
              <span className="text-green-700 font-semibold">
                ¡Solicitud enviada! Nuestro equipo la gestionará en breve.
              </span>
            </div>
          )
        ) : (
          <div className="text-green-700 font-semibold flex items-center gap-2">
            <CheckCircle2 size={22} /> Aún puedes usar tus créditos este mes.
          </div>
        )}
      </div>
    </div>
  );
}
