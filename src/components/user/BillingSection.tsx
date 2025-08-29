"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import {
  doc,
  onSnapshot,
  type FirestoreDataConverter,
  type DocumentData,
  collection,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmbeddedCheckoutModal from "@/components/user/EmbeddedCheckoutModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startOfWeek, endOfWeek } from "date-fns";

/* ========= Tipos ========= */

type FireTimestamp = { seconds: number; nanoseconds: number };

export interface SubscriptionInfo {
  id?: string | null;
  plan?: string | null;
  status?: string;
  active?: boolean;
  renewal?: Date | null;
  lastUpdated?: Date | null;
  lastPayment?: Date | null;
  trial_start?: Date | null;
  trial_end?: Date | null;
  amount?: number | null;
  currency?: string | null;
  start_date?: Date | null;
  cancel_at_period_end?: boolean;
  canceled_at?: Date | null;
  customerId?: string | null;
  raw?: any;
}

interface UserDoc {
  stripeCustomerId?: string;
  subscription?: SubscriptionInfo;
  usage?: { tokens?: number; euros?: number };
}
const userConverter: FirestoreDataConverter<UserDoc> = {
  toFirestore: (data: UserDoc) => data as DocumentData,
  fromFirestore: (snap, options) => snap.data(options) as UserDoc,
};

/** Tareas (Firestore /tasks) */
type Task = {
  id: string;
  kind: "script" | "audio" | "video" | "edit" | string;
  chargedCents: number;
  creditedCents: number;
  currency: string;
  freeQty: number;
  paidQty: number;
  quantity: number;
  unitCents: number;
  createdAt: string | null;   // ✅ ahora es string
  updatedAt?: string | null; // si también la devuelves
  jobId?: string;
};

/* ========= Helpers ========= */

const euro = (cents?: number | null) =>
  (Math.max(0, cents ?? 0) / 100).toFixed(2);

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "-";

function tsToDate(ts?: string | null): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function statusBadge(status: string | null, cancelAtPeriodEnd?: boolean) {
  if (!status) return <Badge variant="secondary">Sin suscripción</Badge>;
  if (status === "trialing") return <Badge variant="secondary">En prueba</Badge>;
  if (status === "active" && cancelAtPeriodEnd)
    return <Badge variant="outline">Se cancela al final</Badge>;
  if (status === "active") return <Badge>Activa</Badge>;
  if (status === "past_due")
    return <Badge variant="destructive">Pago vencido</Badge>;
  if (status === "unpaid") return <Badge variant="destructive">Impago</Badge>;
  if (status === "canceled") return <Badge variant="outline">Cancelada</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

/* ========= Componente ========= */

export default function BillingSection() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [docData, setDocData] = useState<UserDoc | null>(null);
  const [stripeData, setStripeData] = useState<any | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [openCheckout, setOpenCheckout] = useState(false);

  // NUEVO: summary desde Stripe
  const [summary, setSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // NUEVO: filtros
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<"week" | "month" | "all">(
    "week" // 👈 por defecto semana actual
  );

  const currentWeek = useMemo(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }, []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // 🔥 Optimización: fetch paralelo con AbortController
  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    let active = true;

    const fetchAll = async () => {
      try {
        setLoadingStripe(true);
        setLoadingSummary(true);

        const idToken = await user.getIdToken();

        const [userRes, stripeRes, summaryRes] = await Promise.allSettled([
          fetch(`/api/firebase/users/${user.uid}`, {
            headers: { Authorization: `Bearer ${idToken}` },
            signal: ctrl.signal,
          }),
          fetch(`/api/stripe/email?email=${encodeURIComponent(user.email!)}`, {
            signal: ctrl.signal,
          }),
          fetch("/api/billing/summary", {
            headers: { Authorization: `Bearer ${idToken}` },
            signal: ctrl.signal,
          }),
        ]);

        if (!active) return;

        if (userRes.status === "fulfilled" && userRes.value.ok) {
          setDocData(await userRes.value.json());
        }
        if (stripeRes.status === "fulfilled" && stripeRes.value.ok) {
          setStripeData(await stripeRes.value.json());
        }
        if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
          setSummary(await summaryRes.value.json());
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("❌ Error en fetch paralelo:", err);
        }
      } finally {
        if (active) {
          setLoadingStripe(false);
          setLoadingSummary(false);
        }
      }
    };

    fetchAll();

    return () => {
      active = false;
      ctrl.abort();
    };
  }, [user]);

  // 🔥 Obtener tasks (detalle histórico)
  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();

    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const currentUser = getAuth().currentUser;
        if (!currentUser) throw new Error("No autenticado");
        const idToken = await currentUser.getIdToken();

        const res = await fetch(`/api/firebase/users/${user.uid}/tasks`, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: ctrl.signal,
        });

        if (res.ok) {
          const data: Task[] = await res.json();
          setTasks(data);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error fetching tasks:", err);
        }
      } finally {
        setLoadingTasks(false);
      }
    };

    void fetchTasks();

    return () => ctrl.abort();
  }, [user]);

  const sub = useMemo(() => {
    const fromStripe =
      stripeData && {
        plan: stripeData.plan,
        status: stripeData.status as string | undefined,
        active:
          stripeData.status === "active" || stripeData.status === "trialing",
        renewal: stripeData.end_date ? new Date(stripeData.end_date) : null,
        trial_start: stripeData.trial_start
          ? new Date(stripeData.trial_start)
          : null,
        trial_end: stripeData.trial_end
          ? new Date(stripeData.trial_end * 1000)
          : null,
        cancel_at_period_end: !!stripeData.cancel_at_period_end,
        start_date: stripeData.start_date
          ? new Date(stripeData.start_date)
          : null,
      };
    return (fromStripe as SubscriptionInfo) ?? docData?.subscription ?? null;
  }, [stripeData, docData?.subscription]);

  const periodStart = sub?.start_date ?? sub?.trial_start ?? null;
  const periodEnd =
    sub?.status === "trialing" ? sub?.trial_end ?? null : sub?.renewal ?? null;

  // 🔥 Filtrar tareas en memoria
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const d = tsToDate(t.createdAt);

      if (!d) return false;

      // 🔹 Filtro por rango
      if (filterRange === "week") {
        if (d < currentWeek.start || d > currentWeek.end) return false;
      }
      if (filterRange === "month") {
        if (d.getMonth() !== new Date().getMonth()) return false;
      }

      // 🔹 Filtro por tipo
      if (filterKind !== "all" && t.kind !== filterKind) return false;

      return true;
    });
  }, [tasks, filterKind, filterRange, currentWeek]);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Suscripción</h2>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Columna izquierda */}
        <div className="lg:col-span-4 space-y-6">
          {loadingStripe ? (
            <div className="rounded-2xl border bg-card p-5 space-y-4 animate-pulse">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-[72px] w-full rounded-xl" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-40" />
              <div className="space-y-3 pt-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 transition-all duration-200">
              <div className="text-sm text-muted-foreground mb-1">
                Periodo de facturación
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                {periodStart && periodEnd
                  ? `${fmtDate(periodStart)} - ${fmtDate(periodEnd)}`
                  : "—"}
              </div>

              <div className="rounded-xl border bg-muted/40 px-6 py-6 text-center mb-5">
                {loadingSummary ? (
                  <Skeleton className="h-7 w-28 mx-auto rounded-md" />
                ) : (
                  <>
                    <div className="text-3xl font-semibold">
                      {euro(summary?.pendingUsageCents ?? 0)} €
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Uso total
                    </div>
                  </>
                )}
              </div>

              <div className="text-3xl font-semibold mt-2">29,99 €/mes</div>
              <div className="text-xs text-muted-foreground mb-5">
                Acceso a la plataforma. Prueba de 7 días.
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge variant="outline">{sub?.plan ?? "—"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  {statusBadge(sub?.status ?? null, sub?.cancel_at_period_end)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Renovación</span>
                  <Badge variant="secondary">
                    {sub?.status === "trialing"
                      ? fmtDate(sub?.trial_end ?? null)
                      : fmtDate(sub?.renewal ?? null)}
                  </Badge>
                </div>
              </div>

              <div className="pt-4">
                {!sub?.active ? (
                  <Button className="w-full" onClick={() => setOpenCheckout(true)}>
                    Empezar prueba GRATUITA
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" asChild>
                    <a
                      href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Gestionar suscripción
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: tabla */}
        <div className="lg:col-span-8">
          {/* Controles de filtro */}
          <div className="flex items-center justify-between mb-3 gap-3">
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="script">Guiones</SelectItem>
                <SelectItem value="audio">Audios</SelectItem>
                <SelectItem value="video">Vídeos</SelectItem>
                <SelectItem value="edit">Ediciones</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRange} onValueChange={(v: any) => setFilterRange(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Rango" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana actual</SelectItem>
                <SelectItem value="month">Mes actual</SelectItem>
                <SelectItem value="all">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead>ID del trabajo</TableHead>
                  <TableHead className="w-[120px]">Coste</TableHead>
                  <TableHead className="w-[200px]">Fecha de procesado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Skeleton className="h-6 w-1/2 mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-sm text-muted-foreground"
                    >
                      No hay tareas registradas en este periodo.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((t) => (
                    <TableRow key={t.id} className="animate-fade-in">
                      <TableCell className="capitalize">
                        {t.kind === "script"
                          ? "Guión"
                          : t.kind === "audio"
                          ? "Audio"
                          : t.kind === "video"
                          ? "Vídeo"
                          : t.kind === "edit"
                          ? "Edición"
                          : t.kind}
                      </TableCell>
                      <TableCell>{t.id}</TableCell>
                      <TableCell>{euro(t.chargedCents ?? 0)}€</TableCell>
                      <TableCell>
                        {(() => {
                          const d = tsToDate(t.createdAt);
                          return d
                            ? d.toLocaleString(undefined, {
                                day: "2-digit",
                                month: "short",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—";
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Modal Stripe Embedded */}
      {user?.email && (
        <EmbeddedCheckoutModal
          open={openCheckout}
          uid={user.uid}
          onClose={() => setOpenCheckout(false)}
        />
      )}
    </section>
  );
}
