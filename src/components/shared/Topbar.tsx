// src/components/shared/Topbar.tsx
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

type Summary = {
  subscription: { status: string | null; active: boolean; plan: string | null };
  trialCreditCents: number;
  usage: { script: number; voice: number; lipsync: number; edit: number };
  pendingCents: number;
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
    <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card px-6">
      {/* Izquierda: placeholder título */}
      <div className="text-sm font-medium text-muted-foreground"></div>

      {/* Derecha: consumo + user */}
      <div className="flex items-center gap-4">
        {loading ? (
          <Skeleton className="h-6 w-28 rounded-md" />
        ) : summary ? (
          <Popover>
            <PopoverTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer bg-neutral-800 text-white px-3 py-1 rounded-md"
              >
                Consumo: € {euro(summary.pendingCents ?? 0)}
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
                  <span>€ {euro(summary.pendingCents)}</span>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-muted-foreground">Operaciones (periodo actual):</span>
                  <span>
                    Guiones: {summary.usage.script ?? 0} · Voz: {summary.usage.voice ?? 0} · LipSync:{" "}
                    {summary.usage.lipsync ?? 0} · Edición: {summary.usage.edit ?? 0}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        {user && <UserDropdown user={{ email: user.email ?? "—" }} />}
      </div>
    </header>
  );
}
