// src/app/dashboard/billing/BillingSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
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
import { toast } from "sonner";

/* ========= Tipos ========= */

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
  createdAt: string | null;
  updatedAt?: string | null;
  jobId?: string;
};

/* ========= Helpers ========= */

const toCredits = (cents?: number | null) =>
  Math.floor(Math.max(0, cents ?? 0) / 10);

function tsToDate(ts?: string | null): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/* ========= Componente ========= */

interface BillingSectionProps {
  /** Función de traducción (opcional). Si no se provee, se mostrará la clave. */
  t?: (key: string, values?: Record<string, string | number>) => string;
}

export default function BillingSection({ t }: BillingSectionProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [docData, setDocData] = useState<UserDoc | null>(null);
  const [stripeData, setStripeData] = useState<any | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [openCheckout, setOpenCheckout] = useState(false);

  const [summary, setSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([]);

  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<"week" | "month" | "all">(
    "week"
  );

  // Locale consistente para fechas/hora
  const locale = useMemo(
    () => (typeof navigator !== "undefined" ? navigator.language : "es-ES"),
    []
  );

  // Helper i18n tolerante (funciona con t global o namespaced 'billing')
  const T = (key: string, values?: Record<string, string | number>) => {
    if (typeof t !== "function") return key;

    try {
      // Intento 1: clave tal cual
      const v1 = t(key, values);
      if (v1 !== key) return v1;
    } catch {
      /* noop */
    }

    if (key.startsWith("billing.")) {
      // Intento 2: quitar prefijo si t es namespaced
      const k2 = key.slice("billing.".length);
      try {
        const v2 = t(k2, values);
        if (v2 !== k2) return v2;
      } catch {
        /* noop */
      }
    } else {
      // Intento 3: añadir prefijo si t es global
      const k3 = `billing.${key}`;
      try {
        const v3 = t(k3, values);
        if (v3 !== k3) return v3;
      } catch {
        /* noop */
      }
    }

    // Fallback: muestra la clave
    return key;
  };

  const fmtDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString(locale, {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })
      : "—";

  const currentWeek = useMemo(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }, []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // status badge con i18n
  const statusBadge = (status: string | null, cancelAtPeriodEnd?: boolean) => {
    if (!status)
      return <Badge variant="secondary">{T("billing.status.none")}</Badge>;
    if (status === "trialing")
      return <Badge variant="secondary">{T("billing.status.trialing")}</Badge>;
    if (status === "active" && cancelAtPeriodEnd)
      return (
        <Badge variant="outline">{T("billing.status.cancelAtPeriodEnd")}</Badge>
      );
    if (status === "active") return <Badge>{T("billing.status.active")}</Badge>;
    if (status === "past_due")
      return (
        <Badge variant="destructive">{T("billing.status.past_due")}</Badge>
      );
    if (status === "unpaid")
      return <Badge variant="destructive">{T("billing.status.unpaid")}</Badge>;
    if (status === "canceled")
      return <Badge variant="outline">{T("billing.status.canceled")}</Badge>;
    return <Badge variant="secondary">{T("billing.status.unknown")}</Badge>;
  };

  // Fetch paralelo: usuario, stripe, summary
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
          (async () => {
            const docResp = await fetch(`/api/firebase/users/${user.uid}`, {
              headers: { Authorization: `Bearer ${idToken}` },
              signal: ctrl.signal,
            });
            if (!docResp.ok) return null;
            const doc = await docResp.json();
            if (!doc?.stripeCustomerId) return null;
            return fetch(
              `/api/stripe/customer?customerId=${encodeURIComponent(
                doc.stripeCustomerId
              )}`,
              { signal: ctrl.signal }
            );
          })(),
          fetch("/api/billing/summary", {
            headers: { Authorization: `Bearer ${idToken}` },
            signal: ctrl.signal,
          }),
        ]);

        if (!active) return;

        if (userRes.status === "fulfilled" && userRes.value?.ok) {
          setDocData(await userRes.value.json());
        }
        if (
          stripeRes.status === "fulfilled" &&
          stripeRes.value &&
          stripeRes.value.ok
        ) {
          setStripeData(await stripeRes.value.json());
        }
        if (summaryRes.status === "fulfilled" && summaryRes.value?.ok) {
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

    void fetchAll();

    return () => {
      active = false;
      ctrl.abort();
    };
  }, [user]);

  // Fetch tasks
  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();

    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("No autenticado");
        const idToken = await currentUser.getIdToken();

        const res = await fetch(`/api/firebase/users/${user.uid}/tasks`, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: ctrl.signal,
        });

        if (res.ok) {
          const data: Task[] = await res.json();
          setTasks(data);
          setOptimisticTasks(data);
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

  const filteredTasks = useMemo(() => {
    return optimisticTasks.filter((tItem) => {
      const d = tsToDate(tItem.createdAt);
      if (!d) return false;
      if (filterRange === "week") {
        if (d < currentWeek.start || d > currentWeek.end) return false;
      }
      if (filterRange === "month") {
        const now = new Date();
        if (d.getFullYear() !== now.getFullYear()) return false;
        if (d.getMonth() !== now.getMonth()) return false;
      }
      if (filterKind !== "all" && tItem.kind !== filterKind) return false;
      return true;
    });
  }, [optimisticTasks, filterKind, filterRange, currentWeek]);

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
          ? new Date(stripeData.trial_end)
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

  return (
    <section className="space-y-6 px-4 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        {T("billing.sectionTitle")}
      </h2>

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
                {T("billing.period.title")}
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
                      {sub?.status === "trialing"
                        ? 0
                        : toCredits(summary?.pendingUsageCents ?? 0)}{" "}
                      {T("billing.credits")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {T("billing.usage.total")}
                    </div>

                    <div className="mt-4">
                      <div className="text-2xl font-semibold">
                        {toCredits(summary?.credits?.availableCents ?? 0)}{" "}
                        {T("billing.credits")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {T("billing.usage.available")}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="text-3xl font-semibold mt-2">
                {T("billing.plan.price", { price: "29,99 €" })}
              </div>
              <div className="text-xs text-muted-foreground mb-5">
                {T("billing.plan.subtitle")}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {T("billing.labels.plan")}
                  </span>
                  <Badge variant="outline">{sub?.plan ?? "—"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {T("billing.labels.status")}
                  </span>
                  {statusBadge(sub?.status ?? null, sub?.cancel_at_period_end)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {T("billing.labels.renewal")}
                  </span>
                  <Badge variant="secondary">
                    {sub?.status === "trialing"
                      ? fmtDate(sub?.trial_end ?? null)
                      : fmtDate(sub?.renewal ?? null)}
                  </Badge>
                </div>
              </div>

              <div className="pt-4">
                {!sub?.active ? (
                  <Button
                    className="w-full"
                    onClick={async () => {
                      setOpenCheckout(true);
                      try {
                        const currentUser = auth.currentUser;
                        if (!currentUser) throw new Error("No autenticado");
                        const idToken = await currentUser.getIdToken();
                        const res = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${idToken}` },
                        });
                        if (!res.ok) throw new Error("Error en checkout");
                      } catch (err) {
                        console.error(err);
                        toast.error(T("billing.errors.checkout"));
                        setOpenCheckout(false);
                      }
                    }}
                  >
                    {T("billing.actions.startTrial")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={async () => {
                      toast.loading(T("billing.portal.opening"));
                      const currentUser = auth.currentUser;
                      if (!currentUser) return alert(T("billing.errors.auth"));
                      const idToken = await currentUser.getIdToken();
                      const res = await fetch("/api/stripe/portal", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${idToken}` },
                      });
                      const data = await res.json();
                      if (res.ok) {
                        window.location.href = data.url;
                      } else {
                        alert(data.error || T("billing.errors.portal"));
                      }
                    }}
                  >
                    {T("billing.actions.manage")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="lg:col-span-8">
          {/* Controles de filtro */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="sm:w-[160px] w-full">
                <SelectValue
                  placeholder={T("billing.filters.kind.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {T("billing.filters.kind.all")}
                </SelectItem>
                <SelectItem value="script">
                  {T("billing.filters.kind.script")}
                </SelectItem>
                <SelectItem value="audio">
                  {T("billing.filters.kind.audio")}
                </SelectItem>
                <SelectItem value="video">
                  {T("billing.filters.kind.video")}
                </SelectItem>
                <SelectItem value="edit">
                  {T("billing.filters.kind.edit")}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterRange}
              onValueChange={(v: any) => setFilterRange(v)}
            >
              <SelectTrigger className="sm:w-[160px] w-full">
                <SelectValue
                  placeholder={T("billing.filters.range.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">
                  {T("billing.filters.range.week")}
                </SelectItem>
                <SelectItem value="month">
                  {T("billing.filters.range.month")}
                </SelectItem>
                <SelectItem value="all">
                  {T("billing.filters.range.all")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla responsiva */}
          <div className="rounded-2xl border overflow-x-auto">
            <Table className="w-full sm:min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] sm:w-[140px]">
                    {T("billing.table.headers.kind")}
                  </TableHead>
                  <TableHead>{T("billing.table.headers.jobId")}</TableHead>
                  <TableHead className="w-[80px] sm:w-[120px]">
                    {T("billing.table.headers.cost")}
                  </TableHead>
                  <TableHead className="w-[140px] sm:w-[200px]">
                    {T("billing.table.headers.processedAt")}
                  </TableHead>
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
                      {T("billing.table.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((tItem) => (
                    <TableRow key={tItem.id}>
                      <TableCell className="capitalize">
                        {tItem.kind === "script"
                          ? T("billing.taskKind.script")
                          : tItem.kind === "audio"
                          ? T("billing.taskKind.audio")
                          : tItem.kind === "video"
                          ? T("billing.taskKind.video")
                          : tItem.kind === "edit"
                          ? T("billing.taskKind.edit")
                          : tItem.kind}
                      </TableCell>
                      <TableCell className="truncate max-w-[100px] sm:max-w-[140px]">
                        {tItem.jobId || tItem.id}
                      </TableCell>
                      <TableCell>
                        {toCredits(tItem.chargedCents)} {T("billing.credits")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(() => {
                          const d = tsToDate(tItem.createdAt);
                          return d
                            ? d.toLocaleString(locale, {
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

      {/* Modal Stripe Checkout */}
      <CheckoutRedirectModal
        open={openCheckout}
        onClose={() => setOpenCheckout(false)}
        plan="ACCESS"
      />
    </section>
  );
}
