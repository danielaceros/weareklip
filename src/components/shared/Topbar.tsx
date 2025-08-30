"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import UserDropdown from "@/components/layout/UserDropdown";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton"; // 👈 importa tu componente

type Summary = {
  subscription: { status: string | null; active: boolean; plan: string | null };
  trialCreditCents: number;
  usage: { script: number; voice: number; lipsync: number; edit: number };
  pendingUsageCents: number;
  overdueCents?: number;
  hasOverdue?: boolean;
};

const euro = (cents: number | undefined | null) =>
  (Math.max(0, cents ?? 0) / 100).toFixed(2);

export function Topbar() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const token = await getIdToken(user, true);
        const res = await fetch("/api/billing/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setSummary(data);
        } else {
          console.error("Summary error:", data.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <>
      {/* 🔴 Banner si hay deuda */}
      {summary?.hasOverdue && (
        <div className="w-full bg-red-100 text-red-800 text-sm py-2 px-4 flex justify-between items-center font-medium">
          <span>
            ⚠️ Tienes una deuda pendiente de{" "}
            <b> {euro(summary.overdueCents ?? 0)}€ </b>
            Por favor regulariza tu pago para seguir usando la plataforma.
          </span>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 rounded-md bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 transition"
          >
            Pagar ahora
          </a>
        </div>
      )}

      {/* Topbar */}
      <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        {/* 📌 Izquierda: en mobile mostramos los botones de CreateReelGlobalButton */}
        <div className="md:hidden">
          <CreateReelGlobalButton />
        </div>

        {/* 📌 Derecha: consumo + user */}
        <div className="flex items-center gap-4 ml-auto">
          {loading ? (
            <Skeleton className="h-6 w-28 rounded-md" />
          ) : summary ? (
            <Popover>
              <PopoverTrigger asChild>
                <Badge
                  id="consumo-badge"
                  variant={summary.hasOverdue ? "destructive" : "secondary"}
                  className={`cursor-pointer px-3 py-1 rounded-md ${
                    summary.hasOverdue
                      ? "bg-red-600 text-white"
                      : "bg-neutral-800 text-white"
                  }`}
                >
                  {summary.hasOverdue
                    ? `Deuda: € ${euro(summary.overdueCents)}`
                    : `Consumo: € ${euro(summary.pendingUsageCents ?? 0)}`}
                </Badge>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-80 rounded-xl border bg-popover p-4 shadow-lg"
              >
                <h4 className="font-medium mb-3">Detalle de consumo</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Crédito de prueba</span>
                    <span>€ {euro(summary.trialCreditCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pendiente a liquidar</span>
                    <span>€ {euro(summary.pendingUsageCents)}</span>
                  </div>
                  {summary.hasOverdue && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Deuda vencida</span>
                      <span>€ {euro(summary.overdueCents)}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-muted-foreground">
                      Operaciones (periodo actual):
                    </span>
                    <span>
                      Guiones: {summary.usage.script ?? 0} · Voz:{" "}
                      {summary.usage.voice ?? 0} · LipSync:{" "}
                      {summary.usage.lipsync ?? 0} · Edición:{" "}
                      {summary.usage.edit ?? 0}
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}

          {user && (
            <div id="user-dropdown">
              <UserDropdown user={{ email: user.email ?? "—" }} />
            </div>
          )}
        </div>
      </header>
    </>
  );
}
