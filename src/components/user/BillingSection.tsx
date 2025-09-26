"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
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
import { useT } from "@/lib/i18n";

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

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";

function tsToDate(ts?: string | null): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function statusBadge(
  t: ReturnType<typeof useT>,
  status: string | null,
  cancelAtPeriodEnd?: boolean
) {
  if (!status) return <Badge variant="secondary">{t("billing.status.none")}</Badge>;
  if (status === "trialing")
    return <Badge variant="secondary">{t("billing.status.trialing")}</Badge>;
  if (status === "active" && cancelAtPeriodEnd)
    return <Badge variant="outline">{t("billing.status.cancelAtPeriodEnd")}</Badge>;
  if (status === "active") return <Badge>{t("billing.status.active")}</Badge>;
  if (status === "past_due")
    return <Badge variant="destructive">{t("billing.status.past_due")}</Badge>;
  if (status === "unpaid")
    return <Badge variant="destructive">{t("billing.status.unpaid")}</Badge>;
  if (status === "canceled")
    return <Badge variant="outline">{t("billing.status.canceled")}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

/* ========= Componente ========= */

export default function BillingSection() {
  const t = useT();

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

  const currentWeek = useMemo(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }, []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

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

    fetchAll();

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
        const currentUser = getAuth().currentUser;
        if (!currentUser) throw new Error(t("billing.errors.notAuthenticated"));
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
  }, [user, t]);

  const filteredTasks = useMemo(() => {
    return optimisticTasks.filter((t) => {
      const d = tsToDate(t.createdAt);
      if (!d) return false;
      if (filterRange === "week") {
        if (d < currentWeek.start || d > currentWeek.end) return false;
      }
      if (filterRange === "month") {
        if (d.getMonth() !== new Date().getMonth()) return false;
      }
      if (filterKind !== "all" && t.kind !== filterKind) return false;
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
      <h2 className="text-2xl font-semibold tracking-tight">{t("billing.title")}</h2>

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
                {t("billing.billingPeriod")}
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                {periodStart && periodEnd
                  ? t("billing.period", {
                      start: fmtDate(periodStart),
                      end: fmtDate(periodEnd),
                    })
                  : t("billing.summary.unknown")}
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
                      {t("billing.usage.totalCredits", {
                        value: "",
                      }).trim() || t("billing.usage.creditsUnit")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("billing.usage.totalUsage")}
                    </div>

                    <div className="mt-4">
                      <div className="text-2xl font-semibold">
                        {t("billing.usage.availableCredits", {
                          value: toCredits(summary?.credits?.availableCents ?? 0),
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t("billing.usage.availableHint")}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="text-3xl font-semibold mt-2">
                {t("billing.pricePerMonth", { price: "29,99 €" })}
              </div>
              <div className="text-xs text-muted-foreground mb-5">
                {t("billing.planBlurb")}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("billing.summary.plan")}
                  </span>
                  <Badge variant="outline">
                    {sub?.plan ?? t("billing.summary.unknown")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("billing.summary.status")}
                  </span>
                  {statusBadge(t, sub?.status ?? null, sub?.cancel_at_period_end)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("billing.summary.renewal")}
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
                        const currentUser = getAuth().currentUser;
                        if (!currentUser) throw new Error(t("billing.errors.notAuthenticated"));
                        const idToken = await currentUser.getIdToken();
                        const res = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${idToken}` },
                        });
                        if (!res.ok) throw new Error(t("billing.errors.checkout"));
                      } catch (err) {
                        console.error(err);
                        toast.error(t("billing.errors.openCheckout"));
                        setOpenCheckout(false);
                      }
                    }}
                  >
                    {t("billing.actions.startTrial")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={async () => {
                      toast.loading(t("billing.actions.openingPortal"));
                      const currentUser = getAuth().currentUser;
                      if (!currentUser) return alert(t("billing.errors.mustLogin"));
                      const idToken = await currentUser.getIdToken();
                      const res = await fetch("/api/stripe/portal", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${idToken}` },
                      });
                      const data = await res.json();
                      if (res.ok) {
                        window.location.href = data.url;
                      } else {
                        alert(data.error || t("billing.errors.openPortal"));
                      }
                    }}
                  >
                    {t("billing.actions.manage")}
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
                <SelectValue placeholder={t("billing.filters.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("billing.filters.all")}</SelectItem>
                <SelectItem value="script">{t("billing.filters.script")}</SelectItem>
                <SelectItem value="audio">{t("billing.filters.audio")}</SelectItem>
                <SelectItem value="video">{t("billing.filters.video")}</SelectItem>
                <SelectItem value="edit">{t("billing.filters.edit")}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterRange}
              onValueChange={(v: any) => setFilterRange(v)}
            >
              <SelectTrigger className="sm:w-[160px] w-full">
                <SelectValue placeholder={t("billing.filters.range")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{t("billing.filters.week")}</SelectItem>
                <SelectItem value="month">{t("billing.filters.month")}</SelectItem>
                <SelectItem value="all">{t("billing.filters.allHistory")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla responsiva */}
          <div className="rounded-2xl border overflow-x-auto">
            <Table className="w-full sm:min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] sm:w-[140px]">
                    {t("billing.table.type")}
                  </TableHead>
                  <TableHead>{t("billing.table.jobId")}</TableHead>
                  <TableHead className="w-[80px] sm:w-[120px]">
                    {t("billing.table.cost")}
                  </TableHead>
                  <TableHead className="w-[140px] sm:w-[200px]">
                    {t("billing.table.processedAt")}
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
                      {t("billing.table.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((titem) => (
                    <TableRow key={titem.id}>
                      <TableCell className="capitalize">
                        {titem.kind === "script"
                          ? t("billing.kinds.script")
                          : titem.kind === "audio"
                          ? t("billing.kinds.audio")
                          : titem.kind === "video"
                          ? t("billing.kinds.video")
                          : titem.kind === "edit"
                          ? t("billing.kinds.edit")
                          : titem.kind}
                      </TableCell>
                      <TableCell className="truncate max-w-[100px] sm:max-w-[140px]">
                        {titem.id}
                      </TableCell>
                      <TableCell>
                        {toCredits(titem.chargedCents)} {t("billing.usage.creditsUnit")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(() => {
                          const d = tsToDate(titem.createdAt);
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

      {/* Modal Stripe Checkout */}
      <CheckoutRedirectModal
        open={openCheckout}
        onClose={() => setOpenCheckout(false)}
        plan="ACCESS"
      />
    </section>
  );
}
